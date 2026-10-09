import { useState, useEffect, useRef } from 'react'
import {
  ref,
  onValue,
  set,
  update,
  remove,
  push,
  get,
  serverTimestamp,
  onDisconnect,
  runTransaction,
} from 'firebase/database'
import { db } from '../../shared/firebase'
import { clearPeerHelpData } from './usePeerHelp'
import { encodeFileKey, decodeFileKey } from '../../shared/fileKeys'
import { sealTasks } from '../../shared/lessonSeal'
import { compactTurtleResultForSync } from '../../modules/turtle/sync.js'
import { AUTO_REVEAL_MODES, SUPPORT_REVEAL_SOURCES } from '../../shared/taskStages.js'
import {
  buildShareIndexEntry,
  isSnapshotWithinLimit,
  SHARE_PAYLOAD_MAX_BYTES,
} from '../sharedWorkspacePayload'
import {
  applySandboxRun,
  applySandboxRunError,
  applySandboxTime,
  COMPLETE_SHOWN_VIA,
  SANDBOX_SIGNAL_KINDS,
  signalKey,
  SIGNAL_CONTEXTS,
  storedError,
  TOPIC_OPEN_SOURCES,
} from '../../badges/signals'
import {
  archiveExplainerFields,
  archiveWorkFields,
  normaliseSessionArchive,
} from '../../badges/sessionArchive'
import { findShownResponse, normalizeShownText } from '../../shared/shownResponses'
import { AUTO_CHECK_LEAVE, AUTO_CHECK_RESULTS, realAttemptEntries } from '../../shared/autoCheck'
import { liveInkPath } from '../liveInk/liveInkData'
import { normalizePollDraft, pollChoiceIndex } from '../../shared/classPolls.js'
import { createLiveInkWriter as createLessonLiveInkWriter } from '../liveInk/liveInkWriter'
import { buildClassCountdown, extendClassCountdown } from '../../shared/classCountdown'
import { clipRunError } from '../studentHints.js'

// Badge decisions (sessions/{lessonId}/badges/{anonymousId}/{badgeId}). A decision is written
// once; revoking is the only later change (see decideBadge / revokeBadge).
export const BADGE_DECISION_STATUSES = Object.freeze(['awarded', 'dismissed', 'revoked'])
export const BADGE_DECISION_SOURCES = Object.freeze(['rule', 'auto', 'manual'])

// Most `students/{id}/rejoins` entries kept (the latest win), so a flaky connection that
// reloads all lesson can't grow the student node without bound.
export const MAX_STUDENT_REJOINS = 20

// Most code_arrange tile misses (`students/{id}/tileMissLog/{taskId}`) kept per task.
export const MAX_TILE_MISSES_PER_TASK = 100

// A code_arrange attempt's tile placements ({ blankId: tileId }) as stored on the attempt: a JSON
// string, or null when there are none.
function storedPlacements(placements) {
  if (!placements || typeof placements !== 'object' || Array.isArray(placements)) return null
  return Object.keys(placements).length > 0 ? JSON.stringify(placements) : null
}

function encodeFileKeys(files) {
  return Object.fromEntries(Object.entries(files).map(([k, v]) => [encodeFileKey(k), v]))
}

function decodeFileKeys(files) {
  return Object.fromEntries(Object.entries(files ?? {}).map(([k, v]) => [decodeFileKey(k), v]))
}

function encodeWorkspaceFiles(files) {
  const fileMap = Array.isArray(files)
    ? Object.fromEntries(files.map((file) => [file.name, file.content]))
    : files
  return encodeFileKeys(fileMap ?? {})
}

// The attempts a student really ran or submitted: auto-check-on-leave records
// (src/shared/autoCheck.js) are not attempts.
function getAttemptEntries(session, anonymousId, taskId) {
  return realAttemptEntries(Object.values(session?.attemptLog?.[anonymousId]?.[taskId] ?? {})).sort(
    (a, b) => (a.attemptNumber ?? 0) - (b.attemptNumber ?? 0)
  )
}

function countAttemptRuns(entries) {
  return entries.reduce((sum, entry) => sum + 1 + (entry.retries ?? 0), 0)
}

/**
 * Subscribes to a Firebase session and exposes helpers for reading/writing state.
 * Used by both the teacher view and the student view.
 */
export function useSession(lessonId, { enabled = true } = {}) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(enabled)
  const [connected, setConnected] = useState(null)
  // Firebase's estimate of (server clock - this device's clock), in ms. Shared deadlines (the
  // class countdown) are written and read in server time so screens with skewed clocks agree.
  const [serverTimeOffset, setServerTimeOffset] = useState(0)
  const serverTimeOffsetRef = useRef(0)
  const sessionRef = useRef(null)
  const attemptCacheRef = useRef({})
  // This tab's first-occurrence guards (badge signals, pasteLog.firstAt), backing up the
  // session snapshot, which lags a write by a round trip.
  const signalSeenRef = useRef(new Set())
  const pasteFirstSeenRef = useRef(new Set())

  useEffect(() => {
    if (!enabled) {
      setConnected(null)
      return
    }
    const connRef = ref(db, '.info/connected')
    const unsub = onValue(connRef, (snap) => setConnected(snap.val() === true))
    const unsubOffset = onValue(ref(db, '.info/serverTimeOffset'), (snap) => {
      const offset = Number(snap.val())
      const next = Number.isFinite(offset) ? offset : 0
      serverTimeOffsetRef.current = next
      setServerTimeOffset(next)
    })
    return () => {
      unsub()
      unsubOffset()
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled || !lessonId) {
      sessionRef.current = null
      setSession(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const r = ref(db, `sessions/${lessonId}`)
    sessionRef.current = r

    const unsub = onValue(r, (snap) => {
      setSession(snap.exists() ? snap.val() : null)
      setLoading(false)
    })

    return () => unsub()
  }, [enabled, lessonId])

  // A new session (createSession clears studentSignals) starts this tab's guards afresh.
  useEffect(() => {
    signalSeenRef.current = new Set()
    pasteFirstSeenRef.current = new Set()
  }, [lessonId, session?.createdAt])

  // ─── Teacher helpers ──────────────────────────────────────────────────────

  async function createSession() {
    await set(ref(db, `sessions/${lessonId}`), {
      lessonId,
      state: 'waiting',
      currentTaskId: 1,
      createdAt: Date.now(),
      startedAt: null,
      currentTaskStartedAt: null,
      endedAt: null,
      activeStudentView: null,
      teacherLive: null,
      isPaused: false,
      sandboxCode: null,
      sandboxCodePushedAt: null,
      sandboxFiles: null,
      sandboxFilesUpdatedAt: null,
      sandboxExplainer: null,
      sandboxPreviousTaskId: null,
      lessonOverrideTasks: null,
      explainerShowComplete: false,
      taskStartTimes: {},
      students: {},
      supportRevealLog: null,
      taskRatingLog: null,
      fullscreenRequestedAt: null,
      nudgeAwayPushedAt: null,
      videoCallLink: null,
      videoCallBroadcastAt: null,
      sharedWorkspaces: null,
      sandboxEnteredAt: null,
      classCountdown: null,
      // Live class polls (src/shared/classPolls.js) belong to one session.
      polls: null,
      activePollId: null,
      // Shown short answers (src/shared/shownResponses.js) belong to one session.
      shownResponses: null,
      // Live badges: decisions, the tutor's badge toggles and the students' signals are
      // session-scoped, so a new session starts without them (set() replaces the node anyway;
      // listed so the reset is explicit).
      badges: null,
      badgeSettings: null,
      studentSignals: null,
    })
    // The payload node lives outside the session, so resetting the session
    // does not clear it on its own.
    await removeSharePayloadsQuietly(`sharedWorkspacePayloads/${lessonId}`)
    // Neither does the teacher-sandbox archive.
    await archiveQuietly(remove(ref(db, sessionArchivePath())))
    // Nor the Presentation annotations.
    await clearLiveInkQuietly()
    // Nor peer help (src/shared/peerHelp.js), which keeps students' work and identities
    // outside the session on purpose.
    await clearPeerHelpData(lessonId)
  }

  async function restartSession() {
    await createSession()
  }

  async function startSession() {
    const now = Date.now()
    await update(ref(db, `sessions/${lessonId}`), {
      state: 'active',
      startedAt: now,
      currentTaskStartedAt: now,
      endedAt: null,
      [`taskStartTimes/${session?.currentTaskId ?? 1}`]: now,
    })
  }

  async function endSession() {
    const endedAt = Date.now()
    // Ending from the teacher sandbox: the open archive visit ends when the session does.
    if (session?.state === 'sandbox' && session?.sandboxEnteredAt != null) {
      await archiveQuietly(
        update(ref(db, archiveVisitPath(session.sandboxEnteredAt)), { exitedAt: endedAt })
      )
    }
    // badges, badgeSettings and studentSignals are deliberately kept: a student who reloads the
    // end screen still sees their badges (see docs/agents/runtime-model.md).
    await update(ref(db, `sessions/${lessonId}`), {
      state: 'ended',
      endedAt,
      activeStudentView: null,
      teacherLive: null,
      sandboxCode: null,
      sandboxCodePushedAt: null,
      sandboxFiles: null,
      sandboxFilesUpdatedAt: null,
      sandboxExplainer: null,
      sandboxPreviousTaskId: null,
      sandboxEnteredAt: null,
      lessonOverrideTasks: null,
      explainerShowComplete: false,
      students: null,
      overrideLog: null,
      supportRevealLog: null,
      taskRatingLog: null,
      fullscreenRequestedAt: null,
      nudgeAwayPushedAt: null,
      videoCallLink: null,
      videoCallBroadcastAt: null,
      sharedWorkspaces: null,
      classCountdown: null,
      // The report (built before this, in handleEndSession) already holds every poll, and
      // the students' answers go with the students node.
      polls: null,
      activePollId: null,
      shownResponses: null,
      // Peer help offers and switches; the rest of peer help is cleared below. The report
      // (built before this, in handleEndSession) already holds the peer help audit.
      peerHelpOffers: null,
      peerHelpSettings: null,
      peerHelperOff: null,
    })
    await removeSharePayloadsQuietly(`sharedWorkspacePayloads/${lessonId}`)
    await clearLiveInkQuietly()
    await clearPeerHelpData(lessonId)
    // When the teacher closes the tab, remove the session entirely so the
    // lesson becomes available for solo study without a stale "ended" record.
    onDisconnect(ref(db, `sessions/${lessonId}`)).remove()
    // Share payloads sit outside the session node, so they need their own
    // disconnect cleanup or they outlive the session that owned them.
    onDisconnect(ref(db, `sharedWorkspacePayloads/${lessonId}`))
      .remove()
      .catch(() => {
        // Non-fatal: worst case a payload subtree outlives its session.
      })
    // The sandbox archive has been read into the saved report by now (handleEndSession builds
    // the report before calling this), so it goes with the session.
    onDisconnect(ref(db, sessionArchivePath()))
      .remove()
      .catch(() => {
        // Non-fatal: worst case an archive outlives its session until the next createSession.
      })
  }

  // Only http(s) links are accepted — this gets rendered as a clickable link/button to
  // students, so reject javascript: and other unsafe schemes at the write boundary.
  function isValidVideoCallLink(url) {
    if (!url) return false
    try {
      const parsed = new URL(url)
      return parsed.protocol === 'http:' || parsed.protocol === 'https:'
    } catch {
      return false
    }
  }

  async function updateVideoCallLink(url) {
    const trimmed = (url ?? '').trim()
    if (trimmed && !isValidVideoCallLink(trimmed)) {
      throw new Error('Video call link must be a valid http(s) URL.')
    }
    await set(ref(db, `sessions/${lessonId}/videoCallLink`), trimmed || null)
  }

  async function sendVideoCallLink(anonymousId) {
    await update(ref(db, `sessions/${lessonId}/students/${anonymousId}`), {
      videoCallLinkPushedAt: Date.now(),
    })
  }

  // "Send to all": one session-wide timestamp that every student screen watches (name entry,
  // waiting room, lesson). Students compare it with the value they saw on load, so a reload
  // doesn't replay an old broadcast (see useVideoCallPrompt).
  async function broadcastVideoCallLink() {
    await set(ref(db, `sessions/${lessonId}/videoCallBroadcastAt`), Date.now())
  }

  // ─── Live class polls (src/shared/classPolls.js) ──────────────────────────
  // One poll is on students' screens at a time (activePollId). Launching a new one closes any
  // poll still open. Answers live on each student's own node (students/{id}/pollResponses),
  // which setTaskId never clears, so a poll can stay open across a task change.

  async function launchPoll(draft) {
    const { poll, error } = normalizePollDraft(draft)
    if (error) throw new Error(error)
    const now = Date.now()
    const pollId = push(ref(db, `sessions/${lessonId}/polls`)).key
    const updates = {
      [`polls/${pollId}`]: {
        question: poll.question,
        options: poll.options,
        status: 'open',
        // Results are public (live bars on the presentation window and, once they've voted,
        // students' screens) unless the teacher ticked "Keep results private".
        showResults: draft?.keepPrivate !== true,
        createdAt: now,
        closedAt: null,
      },
      activePollId: pollId,
    }
    for (const [otherId, other] of Object.entries(session?.polls ?? {})) {
      if (other?.status === 'open') {
        updates[`polls/${otherId}/status`] = 'closed'
        updates[`polls/${otherId}/closedAt`] = now
      }
    }
    await update(ref(db, `sessions/${lessonId}`), updates)
    return pollId
  }

  // Stops answers. The poll stays on screen (activePollId) so its results can be shown.
  async function closePoll(pollId) {
    if (!pollId) return
    await update(ref(db, `sessions/${lessonId}/polls/${pollId}`), {
      status: 'closed',
      closedAt: Date.now(),
    })
  }

  // Results are hidden from students until the teacher shows them.
  async function setPollShowResults(pollId, showResults) {
    if (!pollId) return
    await set(ref(db, `sessions/${lessonId}/polls/${pollId}/showResults`), !!showResults)
  }

  // Takes the poll off every screen, closing it first if it is still open. It stays in
  // `polls` for the report.
  async function dismissPoll() {
    const pollId = session?.activePollId
    const updates = { activePollId: null }
    if (pollId && session?.polls?.[pollId]?.status === 'open') {
      updates[`polls/${pollId}/status`] = 'closed'
      updates[`polls/${pollId}/closedAt`] = Date.now()
    }
    await update(ref(db, `sessions/${lessonId}`), updates)
  }

  // ─── Shown short answers (src/shared/shownResponses.js) ───────────────────
  // Teacher-only: puts a copy of one student's answer on the presentation window. Showing an
  // answer that was hidden reuses its entry (one per student per task).
  async function showResponse(taskId, anonymousId, text, showName) {
    const value = normalizeShownText(text)
    if (taskId == null || taskId === '' || !anonymousId || !value) return
    const existing = findShownResponse(session, taskId, anonymousId)
    const responseId =
      existing?.responseId ?? push(ref(db, `sessions/${lessonId}/shownResponses`)).key
    await set(ref(db, `sessions/${lessonId}/shownResponses/${responseId}`), {
      taskId: String(taskId),
      anonymousId,
      text: value,
      showName: !!showName,
      shownAt: Date.now(),
      hiddenAt: null,
    })
  }

  // Takes the answer off the presentation window; the entry stays for the report.
  async function hideResponse(responseId) {
    if (!responseId) return
    await set(ref(db, `sessions/${lessonId}/shownResponses/${responseId}/hiddenAt`), Date.now())
  }

  async function setShownResponseName(responseId, showName) {
    if (!responseId) return
    await set(ref(db, `sessions/${lessonId}/shownResponses/${responseId}/showName`), !!showName)
  }

  // Student: pick (or change) an answer while the poll is open.
  async function answerPoll(anonymousId, pollId, choice) {
    if (!anonymousId || !pollId) return
    const poll = session?.polls?.[pollId]
    if (!poll || poll.status !== 'open') return
    const index = pollChoiceIndex(poll, choice)
    if (index === null) return
    await set(ref(db, `sessions/${lessonId}/students/${anonymousId}/pollResponses/${pollId}`), {
      choice: index,
      answeredAt: Date.now(),
    })
  }

  async function setTaskId(taskId) {
    const now = Date.now()
    const updates = {
      currentTaskId: taskId,
      currentTaskStartedAt: now,
      explainerShowComplete: false,
      teacherClassPaneCommand: null,
      [`taskStartTimes/${taskId}`]: now,
    }
    const pendingShareIds = []
    for (const anonymousId of Object.keys(session?.students ?? {})) {
      updates[`students/${anonymousId}/checkPassed`] = null
      updates[`students/${anonymousId}/lastRunStatus`] = null
      updates[`students/${anonymousId}/lastRunError`] = null
      updates[`students/${anonymousId}/studentHint`] = null
      updates[`students/${anonymousId}/hintOffer`] = null
      updates[`students/${anonymousId}/currentOutput`] = ''
      updates[`students/${anonymousId}/currentCode`] = ''
      updates[`students/${anonymousId}/currentArcadeDesign`] = null
      updates[`students/${anonymousId}/currentSpriteState`] = null
      updates[`students/${anonymousId}/currentCursor`] = null
      updates[`students/${anonymousId}/currentBlockDrag`] = null
      updates[`students/${anonymousId}/currentCodeArrangeSlots`] = null
      updates[`students/${anonymousId}/currentFiles`] = null
      updates[`students/${anonymousId}/currentAnswer`] = null
      updates[`students/${anonymousId}/currentSelection`] = null
      updates[`students/${anonymousId}/currentActivity`] = null
      updates[`students/${anonymousId}/currentActiveFile`] = null
      updates[`students/${anonymousId}/checkOverridePassed`] = null
      updates[`students/${anonymousId}/checkOverrideHint`] = null
      updates[`students/${anonymousId}/checkOverridePushedAt`] = null
      updates[`students/${anonymousId}/needsHelp`] = null
      updates[`students/${anonymousId}/currentTopicId`] = null
      updates[`students/${anonymousId}/sentToTopicId`] = null
      updates[`students/${anonymousId}/sentToTopicPushedAt`] = null
      updates[`students/${anonymousId}/teacherMessage`] = null
      updates[`students/${anonymousId}/teacherMessagePushedAt`] = null
      updates[`students/${anonymousId}/thumbsUpPushedAt`] = null
      updates[`students/${anonymousId}/teacherEditRequestedAt`] = null
      updates[`students/${anonymousId}/teacherEditAcceptedAt`] = null
      updates[`students/${anonymousId}/teacherLiveCode`] = null
      updates[`students/${anonymousId}/teacherLiveFiles`] = null
      updates[`students/${anonymousId}/teacherLiveActiveFile`] = null
      updates[`students/${anonymousId}/teacherLiveWorkspace`] = null
      updates[`students/${anonymousId}/teacherLiveArcadeDesign`] = null
      updates[`students/${anonymousId}/teacherEditApplyCode`] = null
      updates[`students/${anonymousId}/teacherEditApplyFiles`] = null
      updates[`students/${anonymousId}/teacherEditApplyArcadeDesign`] = null
      updates[`students/${anonymousId}/teacherEditAppliedAt`] = null
      updates[`students/${anonymousId}/teacherAnswerEdit`] = null
      updates[`students/${anonymousId}/remoteRunPushedAt`] = null
      updates[`students/${anonymousId}/remoteRunTaskId`] = null
      updates[`students/${anonymousId}/teacherAssistedTaskId`] = null
      updates[`students/${anonymousId}/teacherStageRequestedAt`] = null
      updates[`students/${anonymousId}/teacherStagePendingAction`] = null
      updates[`students/${anonymousId}/teacherStageAcceptedAt`] = null
      updates[`students/${anonymousId}/teacherHighlights`] = null
      updates[`students/${anonymousId}/teacherPaneCommand`] = null
      // The previous task's panes mean nothing on the new one; the student's StudentView
      // re-reports the new task's panes (its dedupe resets per task).
      updates[`students/${anonymousId}/visiblePanes`] = null
      // Pending share requests are per-task. Approved shares live in
      // sharedWorkspaces (session level) and deliberately survive this wipe.
      updates[`students/${anonymousId}/shareRequestedAt`] = null
      updates[`students/${anonymousId}/shareRequestTaskId`] = null
      updates[`students/${anonymousId}/shareRequestOrigin`] = null
      updates[`students/${anonymousId}/shareSnapshotRequestedAt`] = null
      pendingShareIds.push(anonymousId)
    }
    await update(ref(db, `sessions/${lessonId}`), updates)
    await Promise.all([
      ...pendingShareIds.map((anonymousId) =>
        removeSharePayloadsQuietly(`sharedWorkspacePayloads/${lessonId}/pending/${anonymousId}`)
      ),
      // Presentation annotations belong to the task they were drawn on.
      clearLiveInkQuietly(),
    ])
  }

  // `source`: 'teacher' for a tutor passing the student by hand (counts as complete in the
  // report), 'class_advance' for the record written when the teacher moves the class on (does
  // not count as complete for a graded task; see lessonReport.js).
  function buildOverrideRecord(anonymousId, taskId, source) {
    if (taskId == null) return null
    if (session?.overrideLog?.[anonymousId]?.[taskId]) return null
    if (session?.students?.[anonymousId]?.checkPassed === true) return null

    const entries = getAttemptEntries(session, anonymousId, taskId)
    if (entries.some((entry) => entry.passed)) return null

    const attemptNumber = countAttemptRuns(entries)
    return {
      taskId,
      overriddenAt: serverTimestamp(),
      attemptNumber,
      previousCheckState: attemptNumber > 0 ? 'failed' : 'unattempted',
      source,
    }
  }

  async function overrideStudentCheck(
    anonymousId,
    passed,
    hint = null,
    taskId = session?.currentTaskId
  ) {
    const now = Date.now()
    const updates = {
      [`students/${anonymousId}/checkOverridePassed`]: passed,
      [`students/${anonymousId}/checkOverrideHint`]: hint || null,
      [`students/${anonymousId}/checkOverridePushedAt`]: now,
    }
    if (passed) {
      const record = buildOverrideRecord(anonymousId, taskId, 'teacher')
      if (record) updates[`overrideLog/${anonymousId}/${taskId}`] = record
    }
    await update(ref(db, `sessions/${lessonId}`), updates)
  }

  async function recordClassAdvanceOverrides(
    taskId,
    anonymousIds = Object.keys(session?.students ?? {})
  ) {
    if (taskId == null) return
    const updates = {}
    for (const anonymousId of anonymousIds) {
      const student = session?.students?.[anonymousId] ?? {}
      if (student.checkPassed === true || student.checkOverridePassed === true) continue
      const record = buildOverrideRecord(anonymousId, taskId, 'class_advance')
      if (record) updates[`overrideLog/${anonymousId}/${taskId}`] = record
    }
    if (Object.keys(updates).length > 0) {
      await update(ref(db, `sessions/${lessonId}`), updates)
    }
  }

  async function enterSandbox({ code = null, files = null, previousTaskId = null } = {}) {
    const now = Date.now()
    const updates = { state: 'sandbox' }
    if (previousTaskId != null) updates.sandboxPreviousTaskId = previousTaskId
    // Identifies this visit in the sandbox archive; kept if the class is already in the sandbox.
    const alreadyIn = session?.state === 'sandbox' && session?.sandboxEnteredAt != null
    const enteredAt = alreadyIn ? session.sandboxEnteredAt : now
    updates.sandboxEnteredAt = enteredAt
    let filesMap = null
    if (code != null) {
      updates.sandboxCode = code
      updates.sandboxCodePushedAt = now
    }
    if (files != null) {
      filesMap = Object.fromEntries(files.map((f) => [f.name, f.content]))
      updates.sandboxFiles = encodeFileKeys(filesMap)
      updates.sandboxFilesUpdatedAt = now
    }
    await update(ref(db, `sessions/${lessonId}`), updates)
    if (!alreadyIn) {
      // "After Task N" is the task the teacher left, not the one handleGoLiveSandbox may have
      // jumped to for a composed lesson's module.
      await archiveQuietly(
        set(ref(db, archiveVisitPath(enteredAt)), {
          enteredAt,
          exitedAt: null,
          previousTaskId: previousTaskId ?? session?.currentTaskId ?? null,
          explainer: session?.sandboxExplainer ?? null,
        })
      )
    }
    const work = filesMap != null ? { files: filesMap } : code != null ? { code } : null
    if (work) await appendArchivePush(enteredAt, archiveWorkFields(work), now)
  }

  async function exitSandbox() {
    const now = Date.now()
    const updates = {
      state: 'active',
      currentTaskStartedAt: now,
      sandboxCode: null,
      sandboxCodePushedAt: null,
      sandboxFiles: null,
      sandboxFilesUpdatedAt: null,
      sandboxExplainer: null,
      sandboxPreviousTaskId: null,
      sandboxEnteredAt: null,
    }
    // Going live can silently move the class onto the sandbox module's first
    // task (see TeacherView.handleGoLiveSandbox) so the right editor/module
    // renders; restore whatever task was actually active before that jump.
    if (
      session?.sandboxPreviousTaskId != null &&
      session.sandboxPreviousTaskId !== session?.currentTaskId
    ) {
      updates.currentTaskId = session.sandboxPreviousTaskId
    }
    await update(ref(db, `sessions/${lessonId}`), updates)
    if (session?.sandboxEnteredAt != null) {
      await archiveQuietly(
        update(ref(db, archiveVisitPath(session.sandboxEnteredAt)), { exitedAt: now })
      )
    }
  }

  async function pushSandboxCode(code) {
    const now = Date.now()
    await update(ref(db, `sessions/${lessonId}`), {
      sandboxCode: code,
      sandboxCodePushedAt: now,
    })
    await appendArchivePush(currentSandboxVisitId(), archiveWorkFields({ code }), now)
  }

  async function pushSandboxFiles(files) {
    const now = Date.now()
    const filesMap = Object.fromEntries(files.map((f) => [f.name, f.content]))
    await update(ref(db, `sessions/${lessonId}`), {
      sandboxFiles: encodeFileKeys(filesMap),
      sandboxFilesUpdatedAt: now,
    })
    await appendArchivePush(currentSandboxVisitId(), archiveWorkFields({ files: filesMap }), now)
  }

  async function pushSandboxExplainer(text) {
    const now = Date.now()
    await update(ref(db, `sessions/${lessonId}`), {
      sandboxExplainer: text || null,
    })
    const visitId = currentSandboxVisitId()
    if (visitId == null) return
    const fields = archiveExplainerFields(text || '')
    await archiveQuietly(
      update(ref(db, archiveVisitPath(visitId)), { explainer: fields.explainer || null })
    )
    await appendArchivePush(visitId, fields, now)
  }

  // ─── Teacher-sandbox archive ──────────────────────────────────────────────
  //
  // sessionArchive/{lessonId} sits outside the session node (like sharedWorkspacePayloads), so
  // sandbox code never streams to every client, and nothing subscribes to it. Teacher read and
  // write only. One visit per teacher sandbox, keyed by the visit's enteredAt
  // (session.sandboxEnteredAt while it is open). Shapes and the 20 KB cap:
  // src/badges/sessionArchive.js. Every write is best-effort: a failed archive write (e.g.
  // database.rules.json not deployed yet) must never break the sandbox itself.

  function sessionArchivePath() {
    return `sessionArchive/${lessonId}`
  }

  function archiveVisitPath(visitId) {
    return `${sessionArchivePath()}/visits/${visitId}`
  }

  function currentSandboxVisitId() {
    return session?.state === 'sandbox' ? (session?.sandboxEnteredAt ?? null) : null
  }

  async function archiveQuietly(promise) {
    try {
      await promise
    } catch (err) {
      console.warn('[badges] could not write the sandbox archive', err)
    }
  }

  async function appendArchivePush(visitId, fields, at = Date.now()) {
    if (visitId == null || !fields || Object.keys(fields).length === 0) return
    await archiveQuietly(
      set(push(ref(db, `${archiveVisitPath(visitId)}/pushes`)), { at, ...fields })
    )
  }

  // A student's latest sandbox work, copied teacher-side from their existing currentCode /
  // currentFiles when a sandbox run updates it (see useSandboxArchiveSnapshots). `files` is a
  // decoded filename → content map (or an array of { name, content }). Overwrites the student's
  // previous snapshot in this visit.
  async function archiveSandboxStudentSnapshot(anonymousId, { code, files, at = Date.now() } = {}) {
    const visitId = currentSandboxVisitId()
    if (visitId == null || !anonymousId) return
    const fields = archiveWorkFields({ code, files })
    if (Object.keys(fields).length === 0) return
    await archiveQuietly(
      set(ref(db, `${archiveVisitPath(visitId)}/studentSnapshots/${anonymousId}`), {
        at,
        ...fields,
      })
    )
  }

  // One-shot read for the session report; never subscribed. A visit still open, or left open by
  // ending the session from the sandbox, takes `endedAt` as its exit time.
  async function readSessionArchive({ endedAt } = {}) {
    const snap = await get(ref(db, sessionArchivePath()))
    return normaliseSessionArchive(snap.val(), {
      endedAt: endedAt ?? session?.endedAt ?? Date.now(),
    })
  }

  // ─── Live badges: decisions and settings (teacher) ─────────────────────────

  function badgeDecisionPath(anonymousId, badgeId) {
    return `sessions/${lessonId}/badges/${anonymousId}/${badgeId}`
  }

  /**
   * Records the tutor's decision on one badge for one student as a write-if-absent transaction,
   * so two teacher tabs (or an auto-award racing a dismissal) can never both write.
   * `decision`: { status: 'awarded' | 'dismissed', source: 'rule' | 'auto' | 'manual', reason,
   * taskId, announce, bulkId, badge }. `badge` is an Admin-catalogue badge's display snapshot
   * ({ emoji, title, blurb }; see catalogueBadgeSnapshot), stored because students can't read
   * Firestore `badgeCatalogue`. `replaceStatuses` lists existing statuses this decision may
   * replace (e.g. ['dismissed', 'revoked'] for a manual award after a dismissal); by default any
   * existing decision wins. Resolves to { committed, decision }: the decision now stored.
   */
  async function decideBadge(anonymousId, badgeId, decision = {}, { replaceStatuses = [] } = {}) {
    if (!anonymousId || !badgeId) return { committed: false, decision: null }
    const status = decision.status === 'dismissed' ? 'dismissed' : 'awarded'
    const record = {
      status,
      source: BADGE_DECISION_SOURCES.includes(decision.source) ? decision.source : 'manual',
      reason: decision.reason ?? null,
      taskId: decision.taskId ?? null,
      announce: status === 'awarded' && decision.announce !== false,
      bulkId: decision.bulkId ?? null,
      decidedAt: serverTimestamp(),
    }
    if (decision.badge?.emoji && decision.badge?.title) {
      record.badge = {
        emoji: decision.badge.emoji,
        title: decision.badge.title,
        blurb: decision.badge.blurb ?? '',
      }
    }
    const result = await runTransaction(
      ref(db, badgeDecisionPath(anonymousId, badgeId)),
      (current) =>
        current == null || replaceStatuses.includes(current.status) ? record : undefined
    )
    return { committed: !!result?.committed, decision: result?.snapshot?.val() ?? null }
  }

  /**
   * Revokes an awarded badge: an explicit status change on the existing decision, silent to the
   * student. A missing or not-awarded decision is left alone. Resolves to { committed, decision }.
   */
  async function revokeBadge(anonymousId, badgeId) {
    if (!anonymousId || !badgeId) return { committed: false, decision: null }
    const result = await runTransaction(
      ref(db, badgeDecisionPath(anonymousId, badgeId)),
      (current) =>
        current?.status === 'awarded'
          ? { ...current, status: 'revoked', revokedAt: serverTimestamp() }
          : undefined
    )
    return { committed: !!result?.committed, decision: result?.snapshot?.val() ?? null }
  }

  /** The tutor's session badge toggles; only the keys given change. */
  async function setBadgeSettings({ autoAward, soundsOff } = {}) {
    const updates = {}
    if (autoAward !== undefined) updates.autoAward = !!autoAward
    if (soundsOff !== undefined) updates.soundsOff = !!soundsOff
    if (Object.keys(updates).length === 0) return
    await update(ref(db, `sessions/${lessonId}/badgeSettings`), updates)
  }

  // Sealed like the lesson document (src/shared/lessonSeal.js); applyLessonOverride unseals.
  async function pushLessonOverride(tasks) {
    await set(ref(db, `sessions/${lessonId}/lessonOverrideTasks`), sealTasks(tasks))
  }

  async function clearLessonOverride() {
    await set(ref(db, `sessions/${lessonId}/lessonOverrideTasks`), null)
  }

  async function setPaused(isPaused) {
    await update(ref(db, `sessions/${lessonId}`), { isPaused })
  }

  // Browsers only allow entering fullscreen from a direct user gesture, so this can't
  // force students into fullscreen — it just timestamps a request that each student's
  // client shows as a one-click prompt (see StudentStatusBanners).
  async function requestFullscreenForAll() {
    await update(ref(db, `sessions/${lessonId}`), { fullscreenRequestedAt: Date.now() })
  }

  // Same one-click-prompt mechanism as requestFullscreenForAll, targeted at a single
  // student — the per-student mirror of the class-wide broadcast above.
  async function requestFullscreenForStudent(anonymousId) {
    await update(ref(db, `sessions/${lessonId}/students/${anonymousId}`), {
      fullscreenRequestedAt: Date.now(),
    })
  }

  // Nudges draw an Away student's attention back to the lesson: the student's
  // client flashes its tab title/favicon, plays a chime and (if permission was
  // granted) shows an OS notification — see useNudgeAlert. The class-wide
  // version only alerts students whose window is unfocused when it arrives.
  async function nudgeStudent(anonymousId) {
    await update(ref(db, `sessions/${lessonId}/students/${anonymousId}`), {
      nudgePushedAt: Date.now(),
    })
  }

  // A transient "you're on the right track" 👍 for one student: their client pops a short
  // toast and a gentle chime (see useThumbsUp). Not a badge, not shown to the class and not
  // in session reports. Cleared on task change.
  async function sendThumbsUp(anonymousId) {
    await update(ref(db, `sessions/${lessonId}/students/${anonymousId}`), {
      thumbsUpPushedAt: Date.now(),
    })
  }

  // Teacher's per-student "every task" reference: 'first' | 'support' | 'solution',
  // or null to turn it off. Applied by the student's client as each task loads
  // (see autoRevealStage in useStudentCodeState).
  async function setAutoRevealStage(anonymousId, mode) {
    await update(ref(db, `sessions/${lessonId}/students/${anonymousId}`), {
      autoRevealStage: AUTO_REVEAL_MODES.includes(mode) ? mode : null,
    })
  }

  // The teacher's class countdown (sessions/{lessonId}/classCountdown): one shared deadline in
  // server time that every student screen and the presentation window count down to. It
  // survives task changes; only clearClassCountdown, createSession and endSession remove it.
  // Reaching zero locks nothing (see useClassCountdown).
  function serverNow() {
    return Date.now() + serverTimeOffsetRef.current
  }

  async function startClassCountdown(durationMs) {
    const countdown = buildClassCountdown(durationMs, serverNow())
    if (!countdown) return
    await set(ref(db, `sessions/${lessonId}/classCountdown`), countdown)
  }

  // "+1 min": pushes the deadline back; a countdown that already hit zero restarts from now.
  async function addClassCountdownTime(extraMs) {
    const next = extendClassCountdown(session?.classCountdown, extraMs, serverNow())
    if (!next) return
    await set(ref(db, `sessions/${lessonId}/classCountdown`), next)
  }

  async function clearClassCountdown() {
    await set(ref(db, `sessions/${lessonId}/classCountdown`), null)
  }

  async function nudgeAwayStudents() {
    await update(ref(db, `sessions/${lessonId}`), { nudgeAwayPushedAt: Date.now() })
  }

  async function setExplainerShowComplete(showComplete) {
    await update(ref(db, `sessions/${lessonId}`), { explainerShowComplete: !!showComplete })
  }

  async function setActiveStudentView(anonymousId) {
    const r2 = ref(db, `sessions/${lessonId}/activeStudentView`)
    await set(r2, anonymousId || null)
    if (anonymousId) {
      // Clear on unexpected disconnect
      onDisconnect(r2).set(null)
    }
  }

  async function setTeacherLive(payload) {
    const r2 = ref(db, `sessions/${lessonId}/teacherLive`)
    if (!payload) {
      await set(r2, null)
      return
    }
    await set(r2, {
      active: true,
      updatedAt: Date.now(),
      ...payload,
      ...(payload.files != null ? { files: encodeFileKeys(payload.files) } : {}),
    })
    onDisconnect(r2).set(null)
  }

  async function updateTeacherLive(payload) {
    await update(ref(db, `sessions/${lessonId}/teacherLive`), {
      updatedAt: Date.now(),
      ...payload,
      ...(payload.files != null ? { files: encodeFileKeys(payload.files) } : {}),
    })
  }

  // Presentation View's code as a soft, dismissible support reference — a
  // separate node from teacherLive, published continuously while Presentation
  // is open regardless of whether the "Go Live" force takeover (teacherLive)
  // is toggled on. See docs/agents/classroom-behaviours.md.
  async function setTeacherLiveReference(payload) {
    const r2 = ref(db, `sessions/${lessonId}/teacherLiveReference`)
    if (!payload) {
      await set(r2, null)
      return
    }
    await set(r2, {
      active: true,
      updatedAt: Date.now(),
      ...payload,
      ...(payload.files != null ? { files: encodeFileKeys(payload.files) } : {}),
    })
    onDisconnect(r2).set(null)
  }

  async function renameStudent(anonymousId, newName) {
    await set(ref(db, `sessions/${lessonId}/students/${anonymousId}/displayName`), newName)
  }

  async function removeStudent(anonymousId) {
    if (session?.activeStudentView === anonymousId) {
      await set(ref(db, `sessions/${lessonId}/activeStudentView`), null)
    }
    await remove(ref(db, `sessions/${lessonId}/students/${anonymousId}`))
  }

  // Teacher edits a student's Match / Fill in the Gaps answer or Code Arrange
  // tiles from StudentModal. currentAnswer/currentCodeArrangeSlots update
  // straight away so every teacher view reflects the edit; teacherAnswerEdit
  // is the push the student's own tab applies (keyed on `at`, same pattern as
  // remoteResetPushedAt). teacherAssistedTaskId marks the task as assisted on
  // the teacher side only — the student just sees their normal result.
  async function pushTeacherAnswerEdit(anonymousId, { answer, codeArrangeSlots, passed } = {}) {
    const taskId = session?.currentTaskId ?? null
    const updates = {
      teacherAnswerEdit: {
        answer: answer ?? null,
        codeArrangeSlots: codeArrangeSlots ?? null,
        passed: typeof passed === 'boolean' ? passed : null,
        taskId,
        at: Date.now(),
      },
      teacherAssistedTaskId: taskId,
    }
    if (answer != null) updates.currentAnswer = answer
    if (codeArrangeSlots != null) updates.currentCodeArrangeSlots = codeArrangeSlots
    await update(ref(db, `sessions/${lessonId}/students/${anonymousId}`), updates)
  }

  // Student superseded a pending teacher answer edit with their own change, so
  // a reload must not re-apply the teacher's older version (last write wins).
  async function clearTeacherAnswerEdit(anonymousId) {
    await set(ref(db, `sessions/${lessonId}/students/${anonymousId}/teacherAnswerEdit`), null)
  }

  // Teacher presses Run for a student from StudentModal: the student's own
  // browser runs their current code exactly as if they had pressed Run.
  // remoteRunTaskId stops a request made for one task running on another.
  async function pushRemoteRun(anonymousId) {
    await update(ref(db, `sessions/${lessonId}/students/${anonymousId}`), {
      remoteRunPushedAt: Date.now(),
      remoteRunTaskId: session?.currentTaskId ?? null,
    })
  }

  // Student consumed a remote Run request, so a reload never runs it again.
  async function clearRemoteRun(anonymousId) {
    await set(ref(db, `sessions/${lessonId}/students/${anonymousId}/remoteRunPushedAt`), null)
  }

  async function pushResetToStudent(anonymousId, action) {
    await update(ref(db, `sessions/${lessonId}/students/${anonymousId}`), {
      remoteResetAction: action,
      remoteResetPushedAt: Date.now(),
    })
  }

  async function dismissHelp(anonymousId) {
    await set(ref(db, `sessions/${lessonId}/students/${anonymousId}/needsHelp`), null)
  }

  // ─── Workspace sharing ────────────────────────────────────────────────────
  //
  // Two nodes, deliberately split (see docs/agents/runtime-model.md):
  //   sessions/{lessonId}/sharedWorkspaces      — small index, streams to all
  //   sharedWorkspacePayloads/{lessonId}/...    — content, fetched on demand
  //
  // Every client subscribes to the whole session node, so putting workspace
  // content there would push it to all 30 students on every unrelated write.

  // Share payloads live outside the session node, so clearing them is a second
  // write that can fail independently (most commonly: database.rules.json not
  // deployed yet). Session lifecycle must not break because auxiliary cleanup
  // failed, so every caller below is best-effort.
  async function removeSharePayloadsQuietly(path) {
    try {
      await remove(ref(db, path))
    } catch (err) {
      console.warn('[sharing] could not clear share payloads at', path, err)
    }
  }

  function pendingSharePath(anonymousId) {
    return `sharedWorkspacePayloads/${lessonId}/pending/${anonymousId}`
  }

  function approvedSharePath(shareId) {
    return `sharedWorkspacePayloads/${lessonId}/approved/${shareId}`
  }

  function encodeSnapshot(snapshot) {
    return {
      ...snapshot,
      files: encodeFileKeys(snapshot.files ?? {}),
    }
  }

  function decodeSnapshot(snapshot) {
    if (!snapshot) return null
    return { ...snapshot, files: decodeFileKeys(snapshot.files) }
  }

  // Student writes the payload first, then raises the flag. A teacher must
  // never see a request badge for a request whose content has not landed.
  async function requestWorkspaceShare(anonymousId, snapshot, origin = 'student') {
    if (!isSnapshotWithinLimit(snapshot)) {
      throw new Error(
        `This workspace is too large to share (limit ${Math.round(SHARE_PAYLOAD_MAX_BYTES / 1024)}KB).`
      )
    }
    await set(ref(db, pendingSharePath(anonymousId)), encodeSnapshot(snapshot))
    await update(ref(db, `sessions/${lessonId}/students/${anonymousId}`), {
      shareRequestedAt: Date.now(),
      shareRequestTaskId: snapshot.taskId ?? null,
      shareRequestOrigin: origin,
      shareSnapshotRequestedAt: null,
    })
  }

  async function cancelWorkspaceShare(anonymousId) {
    await update(ref(db, `sessions/${lessonId}/students/${anonymousId}`), {
      shareRequestedAt: null,
      shareRequestTaskId: null,
      shareRequestOrigin: null,
    })
    await remove(ref(db, pendingSharePath(anonymousId)))
  }

  // Teacher asks a student's client for a fresh snapshot. Needed because
  // currentCode is only up to date while activeStudentView matches, so the
  // teacher cannot build a snapshot for an unwatched student.
  async function requestShareSnapshot(anonymousId) {
    await update(ref(db, `sessions/${lessonId}/students/${anonymousId}`), {
      shareSnapshotRequestedAt: Date.now(),
    })
  }

  async function readPendingShare(anonymousId) {
    const snap = await get(ref(db, pendingSharePath(anonymousId)))
    return decodeSnapshot(snap.val())
  }

  async function readSharedWorkspace(shareId) {
    const snap = await get(ref(db, approvedSharePath(shareId)))
    return decodeSnapshot(snap.val())
  }

  // Copy the payload across before writing the index entry, so a student never
  // sees a gallery row whose content is not there yet.
  async function approveWorkspaceShare(anonymousId, { student, task } = {}) {
    const snap = await get(ref(db, pendingSharePath(anonymousId)))
    const payload = snap.val()
    if (!payload) throw new Error('That share is no longer available.')

    const shareId = push(ref(db, `sessions/${lessonId}/sharedWorkspaces`)).key
    await set(ref(db, approvedSharePath(shareId)), payload)
    await set(
      ref(db, `sessions/${lessonId}/sharedWorkspaces/${shareId}`),
      buildShareIndexEntry({
        sharerId: anonymousId,
        sharerName: student?.displayName ?? session?.students?.[anonymousId]?.displayName,
        task,
        taskId: payload.taskId ?? null,
        lessonType: payload.lessonType ?? null,
        sharedBy:
          session?.students?.[anonymousId]?.shareRequestOrigin === 'teacher'
            ? 'teacher'
            : 'student',
      })
    )
    await cancelWorkspaceShare(anonymousId)
    return shareId
  }

  // Declining is silent by design — the request simply clears.
  async function declineWorkspaceShare(anonymousId) {
    await cancelWorkspaceShare(anonymousId)
  }

  async function removeSharedWorkspace(shareId) {
    await set(ref(db, `sessions/${lessonId}/sharedWorkspaces/${shareId}`), null)
    await remove(ref(db, approvedSharePath(shareId)))
  }

  async function removeAllSharedWorkspaces() {
    await set(ref(db, `sessions/${lessonId}/sharedWorkspaces`), null)
    await remove(ref(db, `sharedWorkspacePayloads/${lessonId}/approved`))
  }

  async function sendMessageToStudent(anonymousId, message) {
    await update(ref(db, `sessions/${lessonId}/students/${anonymousId}`), {
      teacherMessage: message || null,
      teacherMessagePushedAt: Date.now(),
    })
  }

  async function requestTeacherEdit(anonymousId) {
    await update(ref(db, `sessions/${lessonId}/students/${anonymousId}`), {
      teacherEditRequestedAt: Date.now(),
      teacherEditAcceptedAt: null,
      teacherLiveCode: null,
      teacherLiveFiles: null,
      teacherLiveActiveFile: null,
      teacherLiveWorkspace: null,
      teacherLiveArcadeDesign: null,
      teacherEditApplyCode: null,
      teacherEditApplyFiles: null,
      teacherEditApplyArcadeDesign: null,
      teacherEditAppliedAt: null,
    })
  }

  async function pushTeacherLiveCode(anonymousId, edit) {
    const payload = typeof edit === 'string' ? { code: edit } : (edit ?? {})
    const updates = {}
    if ('code' in payload) updates.teacherLiveCode = payload.code ?? null
    if ('files' in payload)
      updates.teacherLiveFiles = payload.files ? encodeWorkspaceFiles(payload.files) : null
    if ('activeFile' in payload) updates.teacherLiveActiveFile = payload.activeFile ?? null
    if ('workspace' in payload) updates.teacherLiveWorkspace = payload.workspace ?? null
    if ('arcadeDesign' in payload) updates.teacherLiveArcadeDesign = payload.arcadeDesign ?? null
    if (Object.keys(updates).length > 0) {
      await update(ref(db, `sessions/${lessonId}/students/${anonymousId}`), updates)
    }
  }

  async function commitTeacherEdit(anonymousId, edit) {
    const payload = typeof edit === 'string' ? { code: edit } : (edit ?? {})
    await update(ref(db, `sessions/${lessonId}/students/${anonymousId}`), {
      teacherEditRequestedAt: null,
      teacherEditAcceptedAt: null,
      teacherLiveCode: null,
      teacherLiveFiles: null,
      teacherLiveActiveFile: null,
      teacherLiveWorkspace: null,
      teacherLiveArcadeDesign: null,
      teacherEditApplyCode: payload.code ?? null,
      teacherEditApplyFiles: payload.files ? encodeWorkspaceFiles(payload.files) : null,
      teacherEditApplyArcadeDesign: payload.arcadeDesign ?? null,
      teacherEditAppliedAt: Date.now(),
      currentCode: payload.code ?? null,
      currentFiles: payload.files ? encodeWorkspaceFiles(payload.files) : null,
      currentArcadeDesign: payload.arcadeDesign ?? null,
    })
  }

  async function cancelTeacherEdit(anonymousId) {
    await update(ref(db, `sessions/${lessonId}/students/${anonymousId}`), {
      teacherEditRequestedAt: null,
      teacherEditAcceptedAt: null,
      teacherLiveCode: null,
      teacherLiveFiles: null,
      teacherLiveActiveFile: null,
      teacherLiveWorkspace: null,
      teacherLiveArcadeDesign: null,
    })
  }

  async function requestTeacherStage(anonymousId, action) {
    await update(ref(db, `sessions/${lessonId}/students/${anonymousId}`), {
      teacherStageRequestedAt: Date.now(),
      teacherStagePendingAction: action,
      teacherStageAcceptedAt: null,
    })
  }

  async function clearTeacherStage(anonymousId) {
    await update(ref(db, `sessions/${lessonId}/students/${anonymousId}`), {
      teacherStageRequestedAt: null,
      teacherStagePendingAction: null,
      teacherStageAcceptedAt: null,
    })
  }

  async function pushTeacherHighlight(anonymousId, { file, from, to, emoji, note } = {}) {
    const newRef = push(ref(db, `sessions/${lessonId}/students/${anonymousId}/teacherHighlights`))
    await set(newRef, {
      file: encodeFileKey(file),
      from,
      to,
      emoji,
      note: note || null,
      createdAt: Date.now(),
    })
    return newRef.key
  }

  async function removeTeacherHighlight(anonymousId, highlightId) {
    await set(
      ref(db, `sessions/${lessonId}/students/${anonymousId}/teacherHighlights/${highlightId}`),
      null
    )
  }

  // Draws attention to (mode: 'highlight') or immediately switches (mode: 'force') one or
  // more tabs/panels — e.g. Electronics' Breadboard/MicroPython tabs, Scratch's
  // Blocks/Stage tabs, or the Instructions/explainer pane on any lesson type — on a single
  // student's screen. Cleared automatically once the student's own reported visiblePanes
  // shows they've looked at every named pane (see StudentView's effective-pane-command
  // derivation), or explicitly by the teacher via clearTeacherPaneCommand.
  async function pushTeacherPaneCommand(anonymousId, { mode = 'highlight', panes = [] } = {}) {
    await set(ref(db, `sessions/${lessonId}/students/${anonymousId}/teacherPaneCommand`), {
      mode: mode === 'force' ? 'force' : 'highlight',
      panes: Array.isArray(panes) ? panes : [],
      pushedAt: Date.now(),
    })
  }

  async function clearTeacherPaneCommand(anonymousId) {
    await set(ref(db, `sessions/${lessonId}/students/${anonymousId}/teacherPaneCommand`), null)
  }

  // Whole-class equivalent of pushTeacherPaneCommand/clearTeacherPaneCommand — lives on
  // the session root (like teacherLive/activeStudentView) rather than per-student, so
  // every connected student's client evaluates the same node.
  async function pushClassPaneCommand({ mode = 'highlight', panes = [] } = {}) {
    await set(ref(db, `sessions/${lessonId}/teacherClassPaneCommand`), {
      mode: mode === 'force' ? 'force' : 'highlight',
      panes: Array.isArray(panes) ? panes : [],
      pushedAt: Date.now(),
    })
  }

  async function clearClassPaneCommand() {
    await set(ref(db, `sessions/${lessonId}/teacherClassPaneCommand`), null)
  }

  // ─── Presentation annotations (liveInk/{lessonId}) ─────────────────────────
  // Pointer, ink and highlights from the Presentation window. A top-level node, not part of
  // the session: every client streams sessions/{lessonId} in full, and the pointer moves at
  // ~12Hz. See src/app/liveInk and docs/agents/runtime-model.md.

  // Separate subscription for LiveInkProvider; returns the unsubscribe function.
  function subscribeLiveInk(callback) {
    if (!lessonId) return () => {}
    return onValue(ref(db, liveInkPath(lessonId)), (snap) =>
      callback(snap.exists() ? snap.val() : null)
    )
  }

  // The Presentation window's writer (pointer/strokes/highlights/clear).
  function createLiveInkWriter() {
    return lessonId ? createLessonLiveInkWriter(lessonId) : null
  }

  async function clearLiveInkQuietly() {
    try {
      await remove(ref(db, liveInkPath(lessonId)))
    } catch (err) {
      console.warn('[liveInk] could not clear the annotations', err)
    }
  }

  // ─── Student helpers ──────────────────────────────────────────────────────

  // joinedAt is a server timestamp so a teacher's admit.at (also server time) can be
  // compared with it without clock skew between the two devices.
  async function registerJoining(tempId) {
    const r = ref(db, `sessions/${lessonId}/joiningStudents/${tempId}`)
    onDisconnect(r).remove()
    await set(r, { joinedAt: serverTimestamp() })
  }

  async function unregisterJoining(tempId) {
    await remove(ref(db, `sessions/${lessonId}/joiningStudents/${tempId}`))
  }

  // The name the student is typing on NameEntry, for the teacher grid's joining list.
  // '' removes the field. The rules reject it once the marker itself is gone.
  async function setJoiningTypedName(tempId, typedName) {
    const value = typeof typedName === 'string' && typedName ? typedName : null
    await set(ref(db, `sessions/${lessonId}/joiningStudents/${tempId}/typedName`), value)
  }

  // Teacher "Pull in": the student's own device acts on this (useStudentPhase).
  async function admitJoiningStudent(tempId, name) {
    await set(ref(db, `sessions/${lessonId}/joiningStudents/${tempId}/admit`), {
      name,
      at: serverTimestamp(),
    })
  }

  // A dedicated listener on one joining marker; the phase logic ignores session changes
  // during name entry, so the student watches its own marker for a teacher admit here.
  function subscribeJoiningMarker(tempId, callback) {
    return onValue(ref(db, `sessions/${lessonId}/joiningStudents/${tempId}`), (snap) =>
      callback(snap.val())
    )
  }

  async function registerPresence(anonymousId) {
    const presenceRef = ref(db, `sessions/${lessonId}/students/${anonymousId}/online`)
    await set(presenceRef, true)
    onDisconnect(presenceRef).remove()
  }

  // `joinedAt` is the latest name entry (overwritten on every join). The join history for the
  // session report lives beside it: `firstJoinedAt` / `firstJoinTaskId` are written once (the
  // transaction only commits while firstJoinedAt is absent), and every later join or
  // reload-return appends `{ at, taskId }` to `rejoins`, capped at MAX_STUDENT_REJOINS.
  async function joinSession(anonymousId, displayName) {
    const now = Date.now()
    await update(ref(db, `sessions/${lessonId}/students/${anonymousId}`), {
      displayName,
      joinedAt: now,
      currentCode: '',
      currentArcadeDesign: null,
      currentSpriteState: null,
      currentOutput: '',
      currentAnswer: null,
      lastRunStatus: null,
      lastRunError: null,
      studentHint: null,
      hintOffer: null,
      checkPassed: null,
      lastRunAt: null,
    })
    const taskId = session?.currentTaskId ?? null
    try {
      const result = await runTransaction(
        ref(db, `sessions/${lessonId}/students/${anonymousId}/firstJoinedAt`),
        (current) => (current == null ? now : undefined)
      )
      if (result?.committed) {
        await update(ref(db, `sessions/${lessonId}/students/${anonymousId}`), {
          firstJoinTaskId: taskId,
        })
      } else {
        await appendStudentRejoin(anonymousId, { at: now, taskId })
      }
    } catch (err) {
      // The join itself succeeded; losing the report's join history must not block the student.
      console.warn('Failed to record join history:', err)
    }
  }

  async function appendStudentRejoin(anonymousId, entry) {
    await runTransaction(
      ref(db, `sessions/${lessonId}/students/${anonymousId}/rejoins`),
      (current) => [...Object.values(current ?? {}), entry].slice(-MAX_STUDENT_REJOINS)
    )
  }

  // A returning student's reload (no name entry, so no joinSession) logs a rejoin, but only
  // when a first join is on record: a student the teacher removed, or one who joined before
  // join history existed, gets nothing (and no stray student node is recreated).
  async function recordStudentReturn(anonymousId) {
    if (!anonymousId) return
    try {
      const studentPath = `sessions/${lessonId}/students/${anonymousId}`
      const first = await get(ref(db, `${studentPath}/firstJoinedAt`))
      if (first?.val?.() == null) return
      await appendStudentRejoin(anonymousId, {
        at: Date.now(),
        taskId: session?.currentTaskId ?? null,
      })
    } catch (err) {
      console.warn('Failed to record student return:', err)
    }
  }

  async function writeStudentRun(
    anonymousId,
    { code, files, output, answer, status, checkPassed, errorText }
  ) {
    const updates = {
      lastRunStatus: status,
      lastRunAt: Date.now(),
      // The crashed run's error line for the teacher's "Error" chip (src/app/studentHints.js);
      // every run replaces it, so a later clean run clears it.
      lastRunError: status === 'error' ? clipRunError(errorText) : null,
    }
    if (checkPassed !== undefined) updates.checkPassed = checkPassed
    if (code != null) updates.currentCode = code
    if (files != null) updates.currentFiles = encodeFileKeys(files)
    if (output != null) updates.currentOutput = output
    if (answer != null) updates.currentAnswer = answer
    await update(ref(db, `sessions/${lessonId}/students/${anonymousId}`), updates)
  }

  // The hint on the student's check-feedback banner and any unopened "Want a hint?" offer,
  // mirrored for the teacher's card, modal and common-hints strip (src/app/studentHints.js).
  // Only the keys present in `state` are written.
  async function writeStudentHintState(anonymousId, state) {
    const updates = {}
    for (const key of ['studentHint', 'hintOffer']) {
      if (state?.[key] !== undefined) updates[key] = state[key]
    }
    if (!Object.keys(updates).length) return
    await update(ref(db, `sessions/${lessonId}/students/${anonymousId}`), updates)
  }

  // Logs one attempt for a task into sessions/{lessonId}/attemptLog/{anonymousId}/{taskId}.
  // Deduplicates on the client: an unchanged submission just bumps "retries" on the
  // existing entry instead of creating a new one, and no further attempts are logged
  // once a task has been passed. Safe without an atomic increment because only this
  // student's own tab ever writes to their own attemptLog entries.
  // `error` marks a run that produced a real console error: true, or the error's name
  // ('NameError') when the run handler could read it (see runErrorFor in src/badges/signals.js).
  //
  // `auto: 'leave'` logs the auto-check made when the teacher moves the class on before this
  // student passed (src/shared/autoCheck.js): a separate record with the verdict in `autoResult`
  // ('passed' | 'failed' | 'not_run') and `passed: false`, which never de-duplicates, bumps
  // retries or touches the de-dupe cache, so it never stands in for a real attempt.
  //
  // `changeable: true` (ungraded activities a student can re-answer: polls, confidence) keeps
  // logging after a pass, so the report and the live poll split see the student's latest answer.
  //
  // `placements` (code_arrange: { blankId: tileId }) is stored beside the submission as a JSON
  // string (authored ids needn't be valid RTDB keys); a retry keeps the first entry's.
  async function logAttempt(
    anonymousId,
    taskId,
    {
      submission,
      passed,
      suggestion,
      teacherAssisted,
      error,
      auto,
      autoResult,
      changeable,
      placements,
    } = {}
  ) {
    const cacheKey = `${anonymousId}:${taskId}`
    const cached = attemptCacheRef.current[cacheKey]
    if (cached?.passed && !changeable) return

    const serialized =
      typeof submission === 'string' ? submission : JSON.stringify(submission ?? null)
    const basePath = `sessions/${lessonId}/attemptLog/${anonymousId}/${taskId}`

    if (auto === AUTO_CHECK_LEAVE) {
      await set(push(ref(db, basePath)), {
        submission: serialized,
        passed: false,
        suggestion: suggestion || null,
        auto: AUTO_CHECK_LEAVE,
        autoResult: AUTO_CHECK_RESULTS.includes(autoResult) ? autoResult : 'not_run',
        attemptNumber: 0,
        retries: 0,
        loggedAt: serverTimestamp(),
      })
      return
    }

    if (cached && cached.serialized === serialized) {
      const nextRetries = cached.retries + 1
      const updates = { retries: nextRetries }
      if (passed) {
        updates.passed = true
        updates.passedAt = serverTimestamp()
      }
      if (teacherAssisted) updates.teacherAssisted = true
      if (storedError(error)) updates.error = storedError(error)
      await update(ref(db, `${basePath}/${cached.key}`), updates)
      attemptCacheRef.current[cacheKey] = {
        ...cached,
        retries: nextRetries,
        passed: passed || cached.passed,
      }
      return
    }

    const attemptNumber = (cached?.attemptNumber ?? 0) + 1
    const newRef = push(ref(db, basePath))
    // Write the already-serialized string, not the raw submission: an object-shaped
    // submission (Scratch workspace state, a filesystem tree, an HTML file map) can
    // contain values the Realtime Database's set() rejects (e.g. undefined), and since
    // callers never await/catch this, that rejection used to vanish silently — the
    // attempt just never reached the report. A string is always writable.
    await set(newRef, {
      submission: serialized,
      passed,
      suggestion: suggestion || null,
      teacherAssisted: teacherAssisted ? true : null,
      error: storedError(error),
      placements: storedPlacements(placements),
      attemptNumber,
      retries: 0,
      loggedAt: serverTimestamp(),
      passedAt: passed ? serverTimestamp() : null,
    })
    attemptCacheRef.current[cacheKey] = {
      serialized,
      key: newRef.key,
      attemptNumber,
      retries: 0,
      passed,
    }
  }

  // Marks this tab's latest logged attempt on a task as having errored, for an error reported
  // after the attempt was logged (Arcade: the game iframe reports its error after Run, once the
  // code checks have already been logged). No-op when this tab has logged no attempt there.
  async function flagAttemptError(anonymousId, taskId, error = true) {
    const cached = attemptCacheRef.current[`${anonymousId}:${taskId}`]
    if (!cached?.key || !storedError(error)) return
    await update(
      ref(db, `sessions/${lessonId}/attemptLog/${anonymousId}/${taskId}/${cached.key}`),
      {
        error: storedError(error),
      }
    )
  }

  async function writeStudentAnswer(anonymousId, answer) {
    await set(ref(db, `sessions/${lessonId}/students/${anonymousId}/currentAnswer`), answer)
  }

  async function writeStudentCode(anonymousId, code) {
    await set(ref(db, `sessions/${lessonId}/students/${anonymousId}/currentCode`), code)
  }

  async function writeStudentArcadeDesign(anonymousId, design) {
    await set(
      ref(db, `sessions/${lessonId}/students/${anonymousId}/currentArcadeDesign`),
      design ?? null
    )
  }

  async function writeStudentTurtleResult(anonymousId, turtleResult) {
    await set(
      ref(db, `sessions/${lessonId}/students/${anonymousId}/currentTurtleResult`),
      compactTurtleResultForSync(turtleResult)
    )
  }

  async function writeStudentSpriteState(anonymousId, spriteState) {
    await set(
      ref(db, `sessions/${lessonId}/students/${anonymousId}/currentSpriteState`),
      spriteState ?? null
    )
  }

  async function writeStudentCursor(anonymousId, cursor) {
    await set(ref(db, `sessions/${lessonId}/students/${anonymousId}/currentCursor`), cursor ?? null)
  }

  async function writeStudentBlockDrag(anonymousId, blockDrag) {
    await set(
      ref(db, `sessions/${lessonId}/students/${anonymousId}/currentBlockDrag`),
      blockDrag ?? null
    )
  }

  // Live tile-placement state for the code_arrange task type — mirrors
  // writeStudentCursor/writeStudentBlockDrag above. The assembled code itself
  // (currentCode/currentFiles) only ever updates once every blank is filled
  // (see CodeArrangeTaskContainer), so without this field a teacher watching
  // a student mid-arrangement would see stale code from a previous task
  // instead of the tiles actually being placed.
  async function writeStudentCodeArrangeSlots(anonymousId, slotState) {
    await set(
      ref(db, `sessions/${lessonId}/students/${anonymousId}/currentCodeArrangeSlots`),
      slotState ?? null
    )
  }

  async function writeStudentFiles(anonymousId, files) {
    await set(
      ref(db, `sessions/${lessonId}/students/${anonymousId}/currentFiles`),
      encodeFileKeys(files)
    )
  }

  async function writeStudentOutput(anonymousId, output) {
    await set(ref(db, `sessions/${lessonId}/students/${anonymousId}/currentOutput`), output)
  }

  // Mirrors an in-progress input() prompt live: currentInputPrompt lets a
  // watching teacher know a prompt is pending at all (OutputPanel's own
  // inputPrompt is purely local runtime state, never otherwise synced),
  // currentInput is the value typed so far, per keystroke — same
  // watched-only-while-activeStudentView-matches gating as currentCode.
  // `output`, when given, is written in the same update so an echoed input
  // line (or a cleared run) and the prompt row change together on the
  // teacher's screen instead of in two separately-arriving writes.
  async function writeStudentInputState(anonymousId, { prompt, value, output } = {}) {
    const updates = {
      currentInputPrompt: prompt ?? null,
      currentInput: value ?? '',
    }
    if (typeof output === 'string') updates.currentOutput = output
    await update(ref(db, `sessions/${lessonId}/students/${anonymousId}`), updates)
  }

  async function writeStudentInteraction(
    anonymousId,
    { selection, activity, activeFile, viewingShareId, watchingLive } = {}
  ) {
    const updates = {}
    if (selection !== undefined) updates.currentSelection = selection
    if (activity !== undefined) updates.currentActivity = activity
    if (activeFile !== undefined) updates.currentActiveFile = activeFile
    if (viewingShareId !== undefined) updates.viewingShareId = viewingShareId
    // 'look' | 'try' | null: watching or trying a "Show to class" broadcast (teacher's roster).
    if (watchingLive !== undefined) updates.watchingLive = watchingLive
    if (Object.keys(updates).length > 0) {
      await update(ref(db, `sessions/${lessonId}/students/${anonymousId}`), updates)
    }
  }

  async function recordStudentCarryFallback(anonymousId, taskId, fallback) {
    if (!fallback || taskId == null) return
    if (session?.carryFallbackLog?.[anonymousId]?.[taskId]) return
    await set(ref(db, `sessions/${lessonId}/carryFallbackLog/${anonymousId}/${taskId}`), {
      ...fallback,
      taskId,
      fallbackAt: serverTimestamp(),
    })
  }

  async function recordSupportStageReveal(
    anonymousId,
    taskId,
    stageIndex,
    { source = 'student', stageLabel = '', attemptNumber = null, pinnedAt = null } = {}
  ) {
    if (!anonymousId || taskId == null || stageIndex == null) return
    if (session?.supportRevealLog?.[anonymousId]?.[taskId]?.[stageIndex]) return
    const entries = getAttemptEntries(session, anonymousId, taskId)
    const countedAttempts = countAttemptRuns(entries)
    await set(
      ref(db, `sessions/${lessonId}/supportRevealLog/${anonymousId}/${taskId}/${stageIndex}`),
      {
        taskId,
        stageIndex,
        stageLabel: stageLabel || null,
        source: SUPPORT_REVEAL_SOURCES.includes(source) ? source : 'student',
        attemptNumber: attemptNumber ?? countedAttempts,
        revealedAt: serverTimestamp(),
        // A pinned live-code reference's pin (see TEACHER_LIVE_PIN_REVEAL_KEY).
        ...(pinnedAt != null ? { pinnedAt } : {}),
      }
    )
  }

  // A large paste into this student's editor (see handleEditorPaste in
  // useStudentCodeState). Lives on the student's own node so students can write
  // it; per task, so the report can say where it happened.
  // `firstAt` (server time, set once per task) orders the first paste against a pass for the
  // badge guards; `lastAt` keeps being overwritten.
  async function recordStudentPaste(anonymousId, taskId, { chars = 0 } = {}) {
    if (!anonymousId || taskId == null) return
    const prev = session?.students?.[anonymousId]?.pasteLog?.[taskId]
    const firstKey = `${anonymousId}:${taskId}`
    const isFirst = !prev?.firstAt && !pasteFirstSeenRef.current.has(firstKey)
    pasteFirstSeenRef.current.add(firstKey)
    await update(ref(db, `sessions/${lessonId}/students/${anonymousId}/pasteLog/${taskId}`), {
      count: (prev?.count ?? 0) + 1,
      chars: (prev?.chars ?? 0) + chars,
      lastAt: Date.now(),
      ...(isFirst ? { firstAt: serverTimestamp() } : {}),
    })
  }

  // A code_arrange tile the student dropped into a blank where it is known to be wrong (tile
  // feedback): `{ slotId, tileId, at }` pushed under the student's own node, per task, for the
  // report's tileMisses. Not an attempt. Capped per task so a student flicking tiles about can't
  // grow the session without bound.
  async function recordStudentTileMiss(anonymousId, taskId, { slotId, tileId } = {}) {
    if (!anonymousId || taskId == null || !slotId || !tileId) return
    const existing = session?.students?.[anonymousId]?.tileMissLog?.[taskId]
    if (existing && Object.keys(existing).length >= MAX_TILE_MISSES_PER_TASK) return
    await set(push(ref(db, `sessions/${lessonId}/students/${anonymousId}/tileMissLog/${taskId}`)), {
      slotId: String(slotId),
      tileId: String(tileId),
      at: serverTimestamp(),
    })
  }

  // ─── Live badges: student signals ─────────────────────────────────────────
  //
  // sessions/{lessonId}/studentSignals/{anonymousId}, written by the student's own client only
  // (see useStudentBadgeSignals for the gating: never the presentation window, Builder preview or
  // solo). No code is stored here. The first-occurrence writes check the session snapshot and a
  // this-tab set before writing, and the rules refuse a second write (!data.exists()), so each is
  // written at most once; a refused write is expected and swallowed. Shapes and the mapping to
  // badge timeline events: docs/agents/runtime-model.md, "Badge data".

  function signalsPath(anonymousId) {
    return `sessions/${lessonId}/studentSignals/${anonymousId}`
  }

  function mySignals(anonymousId) {
    return session?.studentSignals?.[anonymousId] ?? null
  }

  // Writes `value` at `sessions/{lessonId}/studentSignals/{anonymousId}/{subPath}` unless this tab
  // or the snapshot has already seen it. Resolves to true when a write was sent.
  async function writeSignalOnce(anonymousId, subPath, value, { existing } = {}) {
    const seenKey = `${anonymousId}/${subPath}`
    if (existing || signalSeenRef.current.has(seenKey)) return false
    signalSeenRef.current.add(seenKey)
    try {
      await set(ref(db, `${signalsPath(anonymousId)}/${subPath}`), value)
      return true
    } catch {
      // Already written by another tab (the rules allow the first write only).
      return false
    }
  }

  /**
   * The student opened a Topic Library topic, or accepted one the teacher sent (`source:
   * 'teacher'`). First per context, task and topic, except that the student opening a topic
   * the teacher sent still records it as theirs. `via`: 'button' | 'link' | 'card' | 'list' |
   * 'related' | 'teacher'.
   */
  async function recordTopicOpenSignal(
    anonymousId,
    { context = 'task', taskId = null, topicId, source = 'student', via = null } = {}
  ) {
    if (!anonymousId || !topicId || !SIGNAL_CONTEXTS.includes(context)) return false
    const safeSource = TOPIC_OPEN_SOURCES.includes(source) ? source : 'student'
    const subPath = `topics/${context}/${signalKey(taskId)}/${signalKey(topicId)}`
    const existing =
      mySignals(anonymousId)?.topics?.[context]?.[signalKey(taskId)]?.[signalKey(topicId)]
    const upgrade = existing?.source === 'teacher' && safeSource === 'student'
    if (upgrade) signalSeenRef.current.delete(`${anonymousId}/${subPath}`)
    return writeSignalOnce(
      anonymousId,
      subPath,
      { openedAt: serverTimestamp(), source: safeSource, via: via ?? null },
      { existing: existing && !upgrade }
    )
  }

  /** The first use of a listed Keyboard Wizard shortcut (src/badges/shortcuts.js). */
  async function recordShortcutSignal(anonymousId, shortcutId, { context = 'task', taskId } = {}) {
    if (!anonymousId || !shortcutId || !SIGNAL_CONTEXTS.includes(context)) return false
    return writeSignalOnce(
      anonymousId,
      `shortcuts/${signalKey(shortcutId)}`,
      { firstUsedAt: serverTimestamp(), context, taskId: taskId ?? null },
      { existing: mySignals(anonymousId)?.shortcuts?.[signalKey(shortcutId)] }
    )
  }

  /** The student's first accepted code-editor autocomplete suggestion (✨ Autocomplete Ace). */
  async function recordAutocompleteSignal(anonymousId, { context = 'task', taskId } = {}) {
    if (!anonymousId || !SIGNAL_CONTEXTS.includes(context)) return false
    return writeSignalOnce(
      anonymousId,
      'autocomplete',
      { firstUsedAt: serverTimestamp(), context, taskId: taskId ?? null },
      { existing: mySignals(anonymousId)?.autocomplete }
    )
  }

  /** The student's first real edit on a task, `elapsedMs` timed on their own device. */
  async function recordFirstEditSignal(anonymousId, taskId, elapsedMs) {
    if (!anonymousId || taskId == null || !Number.isFinite(elapsedMs)) return false
    return writeSignalOnce(
      anonymousId,
      `firstEdits/${signalKey(taskId)}`,
      { elapsedMs: Math.max(0, Math.round(elapsedMs)), at: serverTimestamp() },
      { existing: mySignals(anonymousId)?.firstEdits?.[signalKey(taskId)] }
    )
  }

  /** Complete code was shown ('show'), previewed ('preview') or reset to by the teacher. */
  async function recordCompleteShownSignal(anonymousId, taskId, via = 'show') {
    if (!anonymousId || taskId == null) return false
    return writeSignalOnce(
      anonymousId,
      `completeShown/${signalKey(taskId)}`,
      { at: serverTimestamp(), via: COMPLETE_SHOWN_VIA.includes(via) ? via : 'show' },
      { existing: mySignals(anonymousId)?.completeShown?.[signalKey(taskId)] }
    )
  }

  // The per-run sandbox counters are transactions on the student's own node, so two quick runs
  // (or a run and a time flush) never lose an update.
  async function updateSandboxCounters(anonymousId, kind, apply) {
    if (!anonymousId || !SANDBOX_SIGNAL_KINDS.includes(kind)) return
    try {
      await runTransaction(ref(db, `${signalsPath(anonymousId)}/sandbox/${kind}`), apply)
    } catch (err) {
      console.warn('[badges] could not record sandbox activity', err)
    }
  }

  /**
   * One run in a sandbox (`kind`: 'session' for the teacher's sandbox, 'personal'): bumps `runs`
   * (and `errorRuns` / `fixes`) and appends `{ at, error, submissionHash }` to `runsLog` (last 20).
   */
  async function recordSandboxRunSignal(anonymousId, kind, { error = false, submissionHash } = {}) {
    await updateSandboxCounters(anonymousId, kind, (current) =>
      applySandboxRun(current, { at: serverTimestamp(), error, submissionHash })
    )
  }

  /** The latest sandbox run turned out to have errored (Arcade reports its error late). */
  async function flagSandboxRunError(anonymousId, kind, error = true) {
    await updateSandboxCounters(anonymousId, kind, (current) =>
      applySandboxRunError(current, error)
    )
  }

  /** Adds time spent in a sandbox (flushed on leaving it, or when the tab is hidden). */
  async function addSandboxTimeSignal(anonymousId, kind, ms) {
    if (!(ms > 0)) return
    await updateSandboxCounters(anonymousId, kind, (current) => applySandboxTime(current, ms))
  }

  // Teacher-authored, task-scoped rating captured live during the session (see
  // src/app/views/teacher/TaskRatingPanel.jsx). Last write wins per task; writing
  // an all-blank rating removes the entry instead of leaving an empty stub, so
  // TaskRatingPanel's "already rated" indicator stays accurate.
  async function setTaskRating(taskId, { rating, whatWorkedWell, whatDidntWork } = {}) {
    if (taskId == null) return
    const path = `sessions/${lessonId}/taskRatingLog/${taskId}`
    const normalizedRating = Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null
    const trimmedWorked = String(whatWorkedWell ?? '').trim()
    const trimmedDidnt = String(whatDidntWork ?? '').trim()
    if (normalizedRating == null && !trimmedWorked && !trimmedDidnt) {
      await remove(ref(db, path))
      return
    }
    await set(ref(db, path), {
      taskId,
      rating: normalizedRating,
      whatWorkedWell: trimmedWorked,
      whatDidntWork: trimmedDidnt,
      submittedAt: serverTimestamp(),
    })
  }

  async function writeStudentPresence(
    anonymousId,
    { windowFocused, lastActivityAt, visiblePanes, isFullscreen } = {}
  ) {
    const updates = {}
    if (windowFocused !== undefined) updates.windowFocused = windowFocused
    if (lastActivityAt !== undefined) updates.lastActivityAt = lastActivityAt
    if (visiblePanes !== undefined) updates.visiblePanes = visiblePanes
    if (isFullscreen !== undefined) updates.isFullscreen = isFullscreen
    if (Object.keys(updates).length > 0) {
      await update(ref(db, `sessions/${lessonId}/students/${anonymousId}`), updates)
    }
  }

  async function writeStudentPersonalSandbox(anonymousId, inPersonalSandbox) {
    await set(
      ref(db, `sessions/${lessonId}/students/${anonymousId}/inPersonalSandbox`),
      inPersonalSandbox || null
    )
  }

  // "Keep showing live code" pins for Presentation View's live broadcast as a
  // support reference (see docs/agents/classroom-behaviours.md). These are
  // toggles, not one-shot commands — the actual content always comes live
  // from session.teacherLiveReference; the pin just decides whether a student
  // sees it, on every task until it is turned off (setTaskId leaves pins alone).
  // A pin is stored as the time it was set, so the student's client can log it
  // once per pin rather than once per task. The one-off "Reveal live code" is a
  // supportRevealLog entry instead (TEACHER_LIVE_REVEAL_KEY), not a flag here.
  async function setTeacherLiveReferenceForStudent(anonymousId, visible) {
    await set(
      ref(db, `sessions/${lessonId}/students/${anonymousId}/teacherLiveReferenceVisible`),
      visible ? Date.now() : null
    )
  }

  async function setTeacherLiveReferenceForClass(visible) {
    await set(
      ref(db, `sessions/${lessonId}/teacherLiveReferenceVisibleToAll`),
      visible ? Date.now() : null
    )
  }

  async function requestHelp(anonymousId) {
    await set(ref(db, `sessions/${lessonId}/students/${anonymousId}/needsHelp`), true)
  }

  async function setStudentTopic(anonymousId, topicId) {
    await set(
      ref(db, `sessions/${lessonId}/students/${anonymousId}/currentTopicId`),
      topicId || null
    )
  }

  async function sendToTopic(anonymousId, topicId) {
    await update(ref(db, `sessions/${lessonId}/students/${anonymousId}`), {
      sentToTopicId: topicId || null,
      sentToTopicPushedAt: Date.now(),
    })
  }

  async function acceptTeacherEdit(anonymousId) {
    await set(
      ref(db, `sessions/${lessonId}/students/${anonymousId}/teacherEditAcceptedAt`),
      Date.now()
    )
  }

  async function declineTeacherEdit(anonymousId) {
    await update(ref(db, `sessions/${lessonId}/students/${anonymousId}`), {
      teacherEditRequestedAt: null,
      teacherEditAcceptedAt: null,
    })
  }

  async function acceptTeacherStage(anonymousId) {
    await set(
      ref(db, `sessions/${lessonId}/students/${anonymousId}/teacherStageAcceptedAt`),
      Date.now()
    )
  }

  async function declineTeacherStage(anonymousId) {
    await update(ref(db, `sessions/${lessonId}/students/${anonymousId}`), {
      teacherStageRequestedAt: null,
      teacherStagePendingAction: null,
      teacherStageAcceptedAt: null,
    })
  }

  return {
    session,
    loading,
    connected,
    serverTimeOffset,
    // teacher
    createSession,
    restartSession,
    startSession,
    endSession,
    setTaskId,
    enterSandbox,
    exitSandbox,
    pushSandboxCode,
    pushSandboxFiles,
    pushSandboxExplainer,
    pushLessonOverride,
    clearLessonOverride,
    setPaused,
    requestFullscreenForAll,
    requestFullscreenForStudent,
    nudgeStudent,
    sendThumbsUp,
    nudgeAwayStudents,
    launchPoll,
    closePoll,
    setPollShowResults,
    dismissPoll,
    showResponse,
    hideResponse,
    setShownResponseName,
    setAutoRevealStage,
    setExplainerShowComplete,
    setActiveStudentView,
    setTeacherLive,
    updateTeacherLive,
    setTeacherLiveReference,
    renameStudent,
    removeStudent,
    pushResetToStudent,
    pushTeacherAnswerEdit,
    clearTeacherAnswerEdit,
    pushRemoteRun,
    clearRemoteRun,
    overrideStudentCheck,
    recordClassAdvanceOverrides,
    dismissHelp,
    requestWorkspaceShare,
    cancelWorkspaceShare,
    requestShareSnapshot,
    readPendingShare,
    readSharedWorkspace,
    approveWorkspaceShare,
    declineWorkspaceShare,
    removeSharedWorkspace,
    removeAllSharedWorkspaces,
    sendToTopic,
    sendMessageToStudent,
    updateVideoCallLink,
    sendVideoCallLink,
    broadcastVideoCallLink,
    startClassCountdown,
    addClassCountdownTime,
    clearClassCountdown,
    requestTeacherEdit,
    pushTeacherLiveCode,
    commitTeacherEdit,
    cancelTeacherEdit,
    requestTeacherStage,
    clearTeacherStage,
    pushTeacherHighlight,
    removeTeacherHighlight,
    pushTeacherPaneCommand,
    clearTeacherPaneCommand,
    pushClassPaneCommand,
    clearClassPaneCommand,
    // Presentation annotations (LiveInkProvider)
    subscribeLiveInk,
    createLiveInkWriter,
    // teacher: live badges and the sandbox archive
    decideBadge,
    revokeBadge,
    setBadgeSettings,
    archiveSandboxStudentSnapshot,
    readSessionArchive,
    admitJoiningStudent,
    // student
    answerPoll,
    registerPresence,
    joinSession,
    recordStudentReturn,
    registerJoining,
    unregisterJoining,
    setJoiningTypedName,
    subscribeJoiningMarker,
    writeStudentRun,
    writeStudentHintState,
    logAttempt,
    flagAttemptError,
    writeStudentAnswer,
    writeStudentCode,
    writeStudentArcadeDesign,
    writeStudentTurtleResult,
    writeStudentSpriteState,
    writeStudentCursor,
    writeStudentBlockDrag,
    writeStudentCodeArrangeSlots,
    writeStudentFiles,
    writeStudentOutput,
    writeStudentInputState,
    writeStudentInteraction,
    recordStudentCarryFallback,
    recordSupportStageReveal,
    recordStudentPaste,
    recordStudentTileMiss,
    // student: live badge signals
    recordTopicOpenSignal,
    recordShortcutSignal,
    recordAutocompleteSignal,
    recordFirstEditSignal,
    recordCompleteShownSignal,
    recordSandboxRunSignal,
    flagSandboxRunError,
    addSandboxTimeSignal,
    setTaskRating,
    writeStudentPersonalSandbox,
    setTeacherLiveReferenceForStudent,
    setTeacherLiveReferenceForClass,
    writeStudentPresence,
    requestHelp,
    setStudentTopic,
    acceptTeacherEdit,
    declineTeacherEdit,
    acceptTeacherStage,
    declineTeacherStage,
  }
}
