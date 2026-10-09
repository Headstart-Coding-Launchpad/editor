import { useCallback, useEffect, useRef, useState } from 'react'
import { findTaskById } from '../../shared/taskUtils'
import { getTaskActivity, isHostedActivityTask } from '../../activities/registry.pure.js'
import { deserializeActivityState, solutionOrInitialState } from '../../activities/state.js'
import { createThrottledMirrorWriter } from '../throttledMirrorWriter'
import {
  ANSWER_DRAFT_IDLE_MS,
  buildDraftRecord,
  normalizeDraftText,
  readAnswerDraft,
} from '../../shared/answerDrafts'
import { useLatestRef } from './useLatestRef'

// Discrete changes (a bit toggled, an item finished) mirror to students/{id}/currentAnswer after
// this quiet period whether or not a teacher is watching, exactly like quiz answers.
export const ACTIVITY_ANSWER_DEBOUNCE_MS = 300
// Continuous changes (keystrokes, typing a number) only mirror while the teacher is watching
// this student (session.activeStudentView), at most this often.
export const ACTIVITY_CONTINUOUS_THROTTLE_MS = 250

function storageFileOf(definition) {
  return definition?.storage?.persist ? definition.storage.filename : null
}

/**
 * State, persistence, live sync, grading, remote reset and teacher edits for the current
 * task when it is a hosted activity (taskType 'activity', or a legacy quiz task — see
 * isHostedActivityTask). Owned by useStudentCodeState so it
 * shares the session writers, check feedback and teacher-live publishing with every other task
 * kind. The write rules live here once for every activity:
 *
 * - every change persists to the per-task aux file `__activity_state__` (in-memory store in
 *   presentation/preview, via createStudentPersistence);
 * - discrete changes write `currentAnswer` debounced, always (live lesson and session sandbox;
 *   never solo or presentation);
 * - continuous changes write `currentAnswer` throttled, only while activeStudentView is this
 *   student, and the latest state is flushed the moment the teacher starts watching;
 * - submit grades with the definition and reports through applyCheckFeedback,
 *   writeStudentRun({ answer, status, checkPassed }) and (live lesson only) logAttempt;
 * - an explicit submit (`onSubmit(state)`, the quizzes' "this answer is final") also saves that
 *   state and supersedes a pending teacher edit, but never writes the debounced mirror;
 * - remoteResetAction 'starter' / 'complete' load initialState / solutionState;
 * - teacherAnswerEdit replaces the state and is marked teacher assisted, like quiz edits;
 * - the teacher's own Go Live broadcast publishes the serialised state as teacherLive.answer;
 * - `onDraft(text)` (an unsubmitted answer typed into a submit-to-reveal box: an open short
 *   answer, typed gaps) writes students/{id}/currentDraft in a live lesson only: after
 *   ANSWER_DRAFT_IDLE_MS of no typing, and throttled like continuous changes while
 *   activeStudentView is this student (flushed when the teacher starts watching). Never per
 *   keystroke otherwise. A submit clears it; a draft is never an attempt
 *   (src/shared/answerDrafts.js).
 */
export function useActivityState({
  lesson,
  currentTaskId,
  viewingTaskId,
  phase,
  teacherPresentation,
  identity,
  effectiveIdentity,
  session,
  myStudentData,
  persistence,
  writeStudentAnswer,
  writeStudentDraft,
  writeStudentRun,
  logAttempt,
  clearTeacherAnswerEdit,
  applyCheckFeedback,
  resetCheckFeedback,
  setRunStatus,
  canPublishTeacherLive,
  publishTeacherLive,
  teacherAssistedTaskIdsRef,
  onTeacherAnswerApplied,
  livePayloadRef,
}) {
  const task = findTaskById(lesson?.tasks, currentTaskId)
  const hosted = isHostedActivityTask(task)
  const definition = hosted ? getTaskActivity(task) : null
  const actorId = effectiveIdentity?.anonymousId ?? null

  function loadState(forTask, forDefinition) {
    if (!forDefinition || !forTask) return null
    const file = storageFileOf(forDefinition)
    const raw = file && actorId ? persistence.readSavedFile(actorId, forTask.id, file) : null
    return deserializeActivityState(forDefinition, forTask, raw)
  }

  // Derived-from-props state: reloaded synchronously when the task (or student) changes so the
  // first render of a new activity task already shows its saved state.
  const key = hosted ? `${actorId ?? ''}:${currentTaskId}:${definition?.id}` : null
  const [entry, setEntry] = useState(() => ({
    key,
    state: hosted ? loadState(task, definition) : null,
  }))
  let current = entry
  if (entry.key !== key) {
    current = { key, state: hosted ? loadState(task, definition) : null }
    setEntry(current)
  }
  const state = current.state
  const stateRef = useRef(state)
  stateRef.current = state

  const keyRef = useLatestRef(key)
  const taskRef = useLatestRef(task)
  const definitionRef = useLatestRef(definition)
  const phaseRef = useLatestRef(phase)
  const sessionRef = useLatestRef(session)
  const currentTaskIdRef = useLatestRef(currentTaskId)
  const actorIdRef = useLatestRef(actorId)
  const identityIdRef = useLatestRef(identity?.anonymousId ?? null)
  const viewingTaskIdRef = useLatestRef(viewingTaskId ?? null)
  const myStudentDataRef = useLatestRef(myStudentData)
  const debounceRef = useRef(null)
  const persistenceRef = useLatestRef(persistence)
  const callbacksRef = useLatestRef({
    writeStudentAnswer,
    writeStudentDraft,
    writeStudentRun,
    logAttempt,
    clearTeacherAnswerEdit,
    applyCheckFeedback,
    resetCheckFeedback,
    setRunStatus,
    canPublishTeacherLive,
    publishTeacherLive,
    onTeacherAnswerApplied,
  })

  // The session sandbox keeps the quiz rules it always had: answers and runs are mirrored, but
  // attempts are only logged in the live lesson.
  const writesToSession = () =>
    !teacherPresentation &&
    (phaseRef.current === 'lesson' || phaseRef.current === 'sandbox') &&
    !!actorIdRef.current
  const logsAttempts = () => writesToSession() && phaseRef.current === 'lesson'
  const isWatchedNow = () =>
    !teacherPresentation &&
    !!identityIdRef.current &&
    sessionRef.current?.activeStudentView === identityIdRef.current
  const serializeCurrent = () => definitionRef.current?.serialize(stateRef.current) ?? null
  const writeAnswer = (serialized) => {
    if (serialized == null || !writesToSession()) return
    callbacksRef.current.writeStudentAnswer?.(actorIdRef.current, serialized)
  }

  // Created once; each write re-checks the watch at write time so a trailing throttled write
  // can never land after the teacher stopped watching.
  const writersRef = useRef(null)
  if (!writersRef.current) {
    writersRef.current = {
      continuous: createThrottledMirrorWriter({
        intervalMs: ACTIVITY_CONTINUOUS_THROTTLE_MS,
        write: (serialized) => {
          if (isWatchedNow()) writeAnswer(serialized)
        },
      }),
      // The watched-only full-rate draft stream (onDraft).
      draft: createThrottledMirrorWriter({
        intervalMs: ACTIVITY_CONTINUOUS_THROTTLE_MS,
        write: (text) => {
          if (isWatchedNow()) writeDraft(text)
        },
      }),
      teacherLive: createThrottledMirrorWriter({
        intervalMs: ACTIVITY_CONTINUOUS_THROTTLE_MS,
        write: (serialized) => {
          const cb = callbacksRef.current
          if (teacherPresentation && cb.canPublishTeacherLive?.()) {
            cb.publishTeacherLive({ answer: serialized })
          }
        },
      }),
    }
  }

  function cancelPendingWrites() {
    clearTimeout(debounceRef.current)
    debounceRef.current = null
    writersRef.current.continuous.cancel()
  }

  // ─── Answer drafts (onDraft) ───────────────────────────────────────────────
  // latest: the newest draft text typed; written: the text last sent (null when this tab has
  // sent none), so an unchanged draft is never re-sent and a clear is only sent when needed.
  // Until this tab sends one, the stored draft (e.g. from before a reload) counts as written.
  const draftRef = useRef({ latest: '', written: null, timer: null })
  const draftsAllowed = () =>
    !teacherPresentation &&
    phaseRef.current === 'lesson' &&
    !!actorIdRef.current &&
    viewingTaskIdRef.current === null

  function writeDraft(text) {
    const draft = draftRef.current
    const value = normalizeDraftText(text)
    if (!draftsAllowed()) return
    const stored =
      draft.written ?? readAnswerDraft(myStudentDataRef.current, currentTaskIdRef.current) ?? ''
    if (stored === value) return
    draft.written = value || ''
    callbacksRef.current.writeStudentDraft?.(
      actorIdRef.current,
      buildDraftRecord(currentTaskIdRef.current, value)
    )
  }

  function cancelDraftWrites() {
    const draft = draftRef.current
    clearTimeout(draft.timer)
    draft.timer = null
    writersRef.current.draft.cancel()
  }

  // A submit (or a reset) ends the draft: drop pending writes and clear a stored one.
  function clearDraft() {
    cancelDraftWrites()
    draftRef.current.latest = ''
    writeDraft('')
  }

  function handleDraft(text) {
    const draft = draftRef.current
    draft.latest = normalizeDraftText(text)
    if (!draftsAllowed()) return
    // Idle-debounced always (the low-rate write the card reads); full rate while watched.
    clearTimeout(draft.timer)
    draft.timer = setTimeout(() => {
      draft.timer = null
      writeDraft(draft.latest)
    }, ANSWER_DRAFT_IDLE_MS)
    if (isWatchedNow()) writersRef.current.draft.push(draft.latest)
  }

  // Leaving the task drops any pending mirror write: currentAnswer is per current task, so a
  // late write would land on the next task's card. The state itself is already saved locally.
  // A pending draft write is dropped too (the teacher's setTaskId clears currentDraft on a class
  // task change, and keeps it for the report).
  useEffect(
    () => () => {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
      writersRef.current?.continuous.cancel()
      writersRef.current?.teacherLive.cancel()
      writersRef.current?.draft.cancel()
      clearTimeout(draftRef.current.timer)
      draftRef.current = { latest: '', written: null, timer: null }
    },
    [key]
  )

  // Presentation View arriving on an activity task while broadcasting: publish this task's
  // state straight away, so viewers never see the previous task's answer (or nothing) until
  // the teacher's first change.
  useEffect(() => {
    if (!hosted || !teacherPresentation) return
    const cb = callbacksRef.current
    if (cb.canPublishTeacherLive?.()) cb.publishTeacherLive({ answer: serializeCurrent() })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, session?.teacherLive?.active])

  // The teacher-live payload (Go Live start and every tracked publish) carries the activity
  // state as `answer` while this tab is on an activity task.
  if (livePayloadRef) {
    livePayloadRef.current = () => {
      const def = definitionRef.current
      return def ? { answer: def.serialize(stateRef.current) } : {}
    }
  }

  function commit(next) {
    stateRef.current = next
    const commitKey = keyRef.current
    setEntry((prev) => (prev.key === commitKey ? { key: commitKey, state: next } : prev))
    const def = definitionRef.current
    const file = storageFileOf(def)
    if (file && actorIdRef.current) {
      persistenceRef.current.saveHtmlFile(
        actorIdRef.current,
        currentTaskIdRef.current,
        file,
        def.serialize(next)
      )
    }
  }

  function sync(kind) {
    const serialized = serializeCurrent()
    if (teacherPresentation) writersRef.current.teacherLive.push(serialized)
    if (!writesToSession()) return
    if (kind === 'discrete') {
      // Debounced like a quiz answer. The write sends whatever is latest when the timer fires,
      // so a continuous change made meanwhile can never be overwritten by an older snapshot.
      writersRef.current.continuous.cancel()
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null
        writeAnswer(serializeCurrent())
      }, ACTIVITY_ANSWER_DEBOUNCE_MS)
    } else if (isWatchedNow() && debounceRef.current === null) {
      writersRef.current.continuous.push(serialized)
    }
  }

  function supersedeTeacherAnswerEdit() {
    const id = identityIdRef.current
    if (!id || !sessionRef.current?.students?.[id]?.teacherAnswerEdit) return
    callbacksRef.current.clearTeacherAnswerEdit?.(id)
  }

  // `stateArg` is an explicit final answer from the UI (quizzes) or the teacher; without it the
  // current state is submitted (an activity's Check button). Activities with no completion
  // ('none') only record explicit responses (a confidence rating), and are never marked wrong.
  async function submit(stateArg, { fromTeacher = false, supersede = false } = {}) {
    const def = definitionRef.current
    const currentTask = taskRef.current
    if (!def || !currentTask) return null
    if (def.completion === 'none' && stateArg === undefined) return null
    if (supersede && !fromTeacher) supersedeTeacherAnswerEdit()
    if (stateArg !== undefined && stateArg !== stateRef.current) commit(stateArg)
    const submitted = stateArg ?? stateRef.current
    const result = def.grade(currentTask, submitted) ?? {}
    const passed = !!result.passed
    const suggestion = passed ? '' : String(result.suggestion ?? '')
    const cb = callbacksRef.current
    cb.applyCheckFeedback(passed, suggestion)
    cb.setRunStatus?.('submitted')
    const serialized = def.serialize(submitted)
    cancelPendingWrites()
    writersRef.current.teacherLive.cancel()
    // The answer is in: whatever was being typed is no longer a draft.
    if (!fromTeacher) clearDraft()
    if (cb.canPublishTeacherLive?.()) {
      cb.publishTeacherLive({
        answer: serialized,
        runStatus: 'submitted',
        checkPassed: passed,
        checkAttempted: true,
        checkSuggestion: suggestion,
      })
    }
    const taskId = currentTaskIdRef.current
    if (writesToSession()) {
      const actor = actorIdRef.current
      const logs = logsAttempts()
      await cb.writeStudentRun(actor, {
        answer: serialized,
        status: 'submitted',
        checkPassed: passed,
      })
      if (logs) {
        cb.logAttempt(actor, taskId, {
          submission: def.buildSubmission(currentTask, submitted),
          passed,
          suggestion,
          // Ungraded answers can change; log each change so the latest one is reported.
          changeable: def.completion === 'none',
          teacherAssisted: fromTeacher || !!teacherAssistedTaskIdsRef?.current?.has(taskId),
        })
      }
    }
    return { passed, suggestion, itemResults: result.itemResults ?? null }
  }

  function handleChange(nextOrUpdater) {
    const def = definitionRef.current
    if (!def) return
    const prev = stateRef.current
    const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(prev) : nextOrUpdater
    if (next === prev || next === undefined) return
    supersedeTeacherAnswerEdit()
    commit(next)
    const kind =
      def.classifyChange(prev, next, taskRef.current) === 'continuous' ? 'continuous' : 'discrete'
    sync(kind)
    // Activities whose UI submits final answers itself (quizzes) are never auto-submitted here.
    if (
      def.completion === 'auto' &&
      !def.submitsAnswers &&
      kind === 'discrete' &&
      def.grade(taskRef.current, next).passed
    ) {
      submit(next)
    }
  }

  // Stable entry points for the activity UI: they always call the latest implementation, so an
  // event listener bound once never works on a stale task or state.
  const implRef = useRef(null)
  implRef.current = { handleChange, submit, handleDraft }
  const onChange = useCallback((next) => implRef.current.handleChange(next), [])
  const onSubmit = useCallback(
    (next) => implRef.current.submit(next, { supersede: next !== undefined }),
    []
  )
  const onDraft = useCallback((text) => implRef.current.handleDraft(text), [])

  // The teacher opened this student's live view: publish the latest state straight away so a
  // continuous change made while unwatched (or an answer restored after a reload) is not
  // missing from the modal. An untouched activity has nothing to show.
  useEffect(() => {
    if (!hosted || !isWatchedNow() || viewingTaskId !== null) return
    if (!writesToSession() || phaseRef.current !== 'lesson') return
    const def = definitionRef.current
    const serialized = serializeCurrent()
    // An unsubmitted draft is sent straight away too, at full rate from now on.
    if (draftRef.current.latest) {
      cancelDraftWrites()
      writeDraft(draftRef.current.latest)
    }
    if (serialized === def?.serialize(def.initialState(taskRef.current))) return
    cancelPendingWrites()
    writeAnswer(serialized)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.activeStudentView])

  // Teacher reset from StudentModal: 'starter' -> initial setup, 'complete' -> the answer.
  // remoteResetPushedAt is not cleared between tasks, so the value already present when this
  // tab first sees its student record is history (an earlier task, or a reset this reload has
  // already absorbed into the saved state) and is never re-applied.
  const seenResetAtRef = useRef(undefined)
  const resetPushedAt = myStudentData?.remoteResetPushedAt ?? null
  useEffect(() => {
    if (!myStudentData) return
    if (seenResetAtRef.current === undefined) {
      seenResetAtRef.current = resetPushedAt
      return
    }
    if (!resetPushedAt || resetPushedAt === seenResetAtRef.current) return
    if (phase !== 'lesson' && phase !== 'solo') return
    const def = definitionRef.current
    const currentTask = taskRef.current
    if (!hosted || !def || !currentTask) return
    const action = myStudentData.remoteResetAction
    if (action !== 'starter' && action !== 'complete') return
    seenResetAtRef.current = resetPushedAt
    const next =
      action === 'complete'
        ? solutionOrInitialState(def, currentTask)
        : def.initialState(currentTask)
    commit(next)
    callbacksRef.current.resetCheckFeedback()
    callbacksRef.current.setRunStatus?.(null)
    cancelPendingWrites()
    clearDraft()
    writeAnswer(def.serialize(next))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetPushedAt, !!myStudentData])

  // Teacher "Edit answers" from StudentModal: replace the state and mark it like a quiz edit.
  const appliedTeacherEditAtRef = useRef(null)
  useEffect(() => {
    const edit = myStudentData?.teacherAnswerEdit
    if (!edit?.at || teacherPresentation || !hosted || !definition) return
    if (phase !== 'lesson' || currentTaskId == null) return
    if (appliedTeacherEditAtRef.current === edit.at) return
    appliedTeacherEditAtRef.current = edit.at
    if (edit.taskId != null && String(edit.taskId) !== String(currentTaskId)) return
    if (viewingTaskId !== null || edit.answer == null) return
    teacherAssistedTaskIdsRef?.current?.add(currentTaskId)
    const next = deserializeActivityState(definition, task, edit.answer)
    commit(next)
    // Only a marked edit reports a result. An unmarked (partial) edit is mirrored like the
    // student's own in-progress change (pushTeacherAnswerEdit has usually written it already).
    if (typeof edit.passed === 'boolean') submit(next, { fromTeacher: true })
    else sync('discrete')
    callbacksRef.current.onTeacherAnswerApplied?.(edit.at)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myStudentData?.teacherAnswerEdit?.at, key, phase])

  return {
    task: hosted ? task : null,
    definition,
    state,
    onChange,
    onSubmit,
    // An unsubmitted answer typed so far (text), mirrored as students/{id}/currentDraft.
    onDraft,
    // Saved state of any activity task (read-only review of an earlier task).
    readSavedState: (otherTask) =>
      isHostedActivityTask(otherTask) ? loadState(otherTask, getTaskActivity(otherTask)) : null,
  }
}
