import { useEffect, useRef, useState } from 'react'
import { findTaskById } from '../../shared/taskUtils'
import { getTaskActivity, isHostedActivityTask } from '../../activities/registry.pure.js'
import { createThrottledMirrorWriter } from '../throttledMirrorWriter'
import { useLatestRef } from './useLatestRef'

// Discrete changes (a bit toggled, an item finished) mirror to students/{id}/currentAnswer after
// this quiet period whether or not a teacher is watching, exactly like quiz answers.
export const ACTIVITY_ANSWER_DEBOUNCE_MS = 300
// Continuous changes (keystrokes, typing a number) only mirror while the teacher is watching
// this student (session.activeStudentView), at most this often.
export const ACTIVITY_CONTINUOUS_THROTTLE_MS = 250

// Tolerant load of a stored/serialised activity state. Definitions' deserialize is already
// tolerant; this also guards a definition that throws.
export function deserializeActivityState(definition, task, raw) {
  if (!definition) return null
  try {
    return definition.deserialize(raw ?? '', task) ?? definition.initialState(task)
  } catch {
    return definition.initialState(task)
  }
}

export function solutionOrInitialState(definition, task) {
  return definition?.solutionState
    ? definition.solutionState(task)
    : (definition?.initialState(task) ?? null)
}

/**
 * State, persistence, live sync, grading, remote reset and teacher edits for the current
 * task when it is a hosted activity (taskType 'activity'). Owned by useStudentCodeState so it
 * shares the session writers, check feedback and teacher-live publishing with every other task
 * kind. The write rules live here once for every activity:
 *
 * - every change persists to the per-task aux file `__activity_state__` (in-memory store in
 *   presentation/preview, via createStudentPersistence);
 * - discrete changes write `currentAnswer` debounced, always (live lesson only);
 * - continuous changes write `currentAnswer` throttled, only while activeStudentView is this
 *   student, and the latest state is flushed the moment the teacher starts watching;
 * - submit grades with the definition and reports through applyCheckFeedback,
 *   writeStudentRun({ answer, status, checkPassed }) and logAttempt;
 * - remoteResetAction 'starter' / 'complete' load initialState / solutionState;
 * - teacherAnswerEdit replaces the state and is marked teacher assisted, like quiz edits;
 * - the teacher's own Go Live broadcast publishes the serialised state as teacherLive.answer.
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
  const storageFile = definition?.storage?.persist ? definition.storage.filename : null

  function loadState(forTask, forDefinition) {
    if (!forDefinition) return null
    const file = forDefinition.storage?.persist ? forDefinition.storage.filename : null
    const raw = file && actorId ? persistence.readSavedFile(actorId, forTask.id, file) : null
    return deserializeActivityState(forDefinition, forTask, raw)
  }

  // Derived-from-props state: reloaded synchronously when the task (or student) changes so the
  // first render of a new activity task already shows its saved state.
  const key = hosted ? `${actorId ?? ''}:${currentTaskId}:${definition?.id}` : null
  const [entry, setEntry] = useState(() => ({ key, state: hosted ? loadState(task, definition) : null }))
  let current = entry
  if (entry.key !== key) {
    current = { key, state: hosted ? loadState(task, definition) : null }
    setEntry(current)
  }
  const state = current.state
  const stateRef = useRef(state)
  stateRef.current = state

  const taskRef = useLatestRef(task)
  const definitionRef = useLatestRef(definition)
  const phaseRef = useLatestRef(phase)
  const sessionRef = useLatestRef(session)
  const currentTaskIdRef = useLatestRef(currentTaskId)
  const actorIdRef = useLatestRef(actorId)
  const identityIdRef = useLatestRef(identity?.anonymousId ?? null)
  const debounceRef = useRef(null)
  const latestSerializedRef = useRef(null)

  const writesToSession = () =>
    !teacherPresentation && phaseRef.current === 'lesson' && !!actorIdRef.current
  const isWatchedNow = () =>
    !teacherPresentation &&
    !!identityIdRef.current &&
    sessionRef.current?.activeStudentView === identityIdRef.current

  // Created once; each write re-checks the watch at write time so a trailing throttled write
  // can never land after the teacher stopped watching.
  const writersRef = useRef(null)
  if (!writersRef.current) {
    writersRef.current = {
      continuous: createThrottledMirrorWriter({
        intervalMs: ACTIVITY_CONTINUOUS_THROTTLE_MS,
        write: (serialized) => {
          if (isWatchedNow() && writesToSession()) {
            writersRef.current.write(actorIdRef.current, serialized)
          }
        },
      }),
      teacherLive: createThrottledMirrorWriter({
        intervalMs: ACTIVITY_CONTINUOUS_THROTTLE_MS,
        write: (serialized) => writersRef.current.publish(serialized),
      }),
    }
  }
  writersRef.current.write = (id, serialized) => writeStudentAnswer?.(id, serialized)
  writersRef.current.publish = (serialized) => {
    if (teacherPresentation && canPublishTeacherLive()) publishTeacherLive({ answer: serialized })
  }

  // Leaving the task drops any pending mirror write: currentAnswer is per current task, so a
  // late write would land on the next task's card. The state itself is already saved locally.
  useEffect(
    () => () => {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
      writersRef.current?.continuous.cancel()
      writersRef.current?.teacherLive.cancel()
      latestSerializedRef.current = null
    },
    [key]
  )

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
    setEntry((prev) => (prev.key === key ? { key, state: next } : prev))
    const file = definitionRef.current?.storage?.persist
      ? definitionRef.current.storage.filename
      : null
    if (file && actorIdRef.current) {
      persistence.saveHtmlFile(
        actorIdRef.current,
        currentTaskIdRef.current,
        file,
        definitionRef.current.serialize(next)
      )
    }
  }

  function writeDiscrete(serialized) {
    writersRef.current.continuous.cancel()
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      if (writesToSession()) writersRef.current.write(actorIdRef.current, serialized)
    }, ACTIVITY_ANSWER_DEBOUNCE_MS)
  }

  function sync(next, kind) {
    const def = definitionRef.current
    const serialized = def.serialize(next)
    latestSerializedRef.current = serialized
    if (teacherPresentation) writersRef.current.teacherLive.push(serialized)
    if (!writesToSession()) return
    if (kind === 'discrete') writeDiscrete(serialized)
    else if (isWatchedNow()) writersRef.current.continuous.push(serialized)
  }

  function supersedeTeacherAnswerEdit() {
    if (!identityIdRef.current || !sessionRef.current?.students?.[identityIdRef.current]) return
    if (!sessionRef.current.students[identityIdRef.current].teacherAnswerEdit) return
    clearTeacherAnswerEdit?.(identityIdRef.current)
  }

  async function submit(stateArg, { fromTeacher = false } = {}) {
    const def = definitionRef.current
    const currentTask = taskRef.current
    if (!def || !currentTask || def.completion === 'none') return null
    const submitted = stateArg ?? stateRef.current
    const graded = def.isGraded(currentTask)
    const result = graded ? def.grade(currentTask, submitted) : { passed: true, suggestion: null }
    const passed = !!result.passed
    const suggestion = passed ? '' : String(result.suggestion ?? '')
    applyCheckFeedback(passed, suggestion)
    setRunStatus?.('submitted')
    const serialized = def.serialize(submitted)
    latestSerializedRef.current = serialized
    clearTimeout(debounceRef.current)
    debounceRef.current = null
    writersRef.current.continuous.cancel()
    writersRef.current.teacherLive.cancel()
    if (canPublishTeacherLive()) {
      publishTeacherLive({
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
      await writeStudentRun(actor, { answer: serialized, status: 'submitted', checkPassed: passed })
      if (graded) {
        logAttempt(actor, taskId, {
          submission: def.buildSubmission(currentTask, submitted),
          passed,
          suggestion,
          teacherAssisted: fromTeacher || !!teacherAssistedTaskIdsRef?.current?.has(taskId),
        })
      }
    }
    return { passed, suggestion }
  }

  function handleChange(nextOrUpdater) {
    const def = definitionRef.current
    if (!def) return
    const prev = stateRef.current
    const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(prev) : nextOrUpdater
    if (next === prev || next === undefined) return
    supersedeTeacherAnswerEdit()
    commit(next)
    const kind = def.classifyChange(prev, next) === 'continuous' ? 'continuous' : 'discrete'
    sync(next, kind)
    if (def.completion === 'auto' && kind === 'discrete' && def.grade(taskRef.current, next).passed) {
      submit(next)
    }
  }

  // The teacher opened this student's live view: publish the latest state straight away so a
  // continuous change made while unwatched is not missing from the modal.
  useEffect(() => {
    if (!hosted || !isWatchedNow() || viewingTaskId !== null) return
    if (!writesToSession()) return
    clearTimeout(debounceRef.current)
    debounceRef.current = null
    writersRef.current.continuous.cancel()
    writersRef.current.write(actorId, definition.serialize(stateRef.current))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.activeStudentView])

  // Teacher reset from StudentModal: 'starter' -> initial setup, 'complete' -> the answer.
  useEffect(() => {
    if (!myStudentData?.remoteResetPushedAt || (phase !== 'lesson' && phase !== 'solo')) return
    if (!hosted || !definition) return
    const action = myStudentData.remoteResetAction
    if (action !== 'starter' && action !== 'complete') return
    const next =
      action === 'complete'
        ? solutionOrInitialState(definition, task)
        : definition.initialState(task)
    commit(next)
    resetCheckFeedback()
    setRunStatus?.(null)
    const serialized = definition.serialize(next)
    latestSerializedRef.current = serialized
    clearTimeout(debounceRef.current)
    debounceRef.current = null
    writersRef.current.continuous.cancel()
    if (writesToSession()) writersRef.current.write(actorId, serialized)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myStudentData?.remoteResetPushedAt])

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
    latestSerializedRef.current = definition.serialize(next)
    if (typeof edit.passed === 'boolean') submit(next, { fromTeacher: true })
    onTeacherAnswerApplied?.(edit.at)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myStudentData?.teacherAnswerEdit?.at, key, phase])

  return {
    task: hosted ? task : null,
    definition,
    state,
    storageFile,
    handleChange,
    submit,
    // Saved state of any activity task (read-only review of an earlier task).
    readSavedState: (otherTask) =>
      isHostedActivityTask(otherTask) ? loadState(otherTask, getTaskActivity(otherTask)) : null,
  }
}
