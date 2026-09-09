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
} from 'firebase/database'
import { db } from '../../shared/firebase'
import { encodeFileKey, decodeFileKey } from '../../shared/fileKeys'
import {
  buildShareIndexEntry,
  isSnapshotWithinLimit,
  SHARE_PAYLOAD_MAX_BYTES,
} from '../sharedWorkspacePayload'

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

function getAttemptEntries(session, anonymousId, taskId) {
  return Object.values(session?.attemptLog?.[anonymousId]?.[taskId] ?? {}).sort(
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
  const sessionRef = useRef(null)
  const attemptCacheRef = useRef({})

  useEffect(() => {
    if (!enabled) {
      setConnected(null)
      return
    }
    const connRef = ref(db, '.info/connected')
    const unsub = onValue(connRef, (snap) => setConnected(snap.val() === true))
    return () => unsub()
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
      videoCallLink: null,
      sharedWorkspaces: null,
    })
    // The payload node lives outside the session, so resetting the session
    // does not clear it on its own.
    await removeSharePayloadsQuietly(`sharedWorkspacePayloads/${lessonId}`)
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
    await update(ref(db, `sessions/${lessonId}`), {
      state: 'ended',
      endedAt: Date.now(),
      activeStudentView: null,
      teacherLive: null,
      sandboxCode: null,
      sandboxCodePushedAt: null,
      sandboxFiles: null,
      sandboxFilesUpdatedAt: null,
      sandboxExplainer: null,
      sandboxPreviousTaskId: null,
      lessonOverrideTasks: null,
      explainerShowComplete: false,
      students: null,
      overrideLog: null,
      supportRevealLog: null,
      taskRatingLog: null,
      fullscreenRequestedAt: null,
      videoCallLink: null,
      sharedWorkspaces: null,
    })
    await removeSharePayloadsQuietly(`sharedWorkspacePayloads/${lessonId}`)
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
      updates[`students/${anonymousId}/teacherStageRequestedAt`] = null
      updates[`students/${anonymousId}/teacherStagePendingAction`] = null
      updates[`students/${anonymousId}/teacherStageAcceptedAt`] = null
      updates[`students/${anonymousId}/teacherHighlights`] = null
      updates[`students/${anonymousId}/teacherPaneCommand`] = null
      // Pending share requests are per-task. Approved shares live in
      // sharedWorkspaces (session level) and deliberately survive this wipe.
      updates[`students/${anonymousId}/shareRequestedAt`] = null
      updates[`students/${anonymousId}/shareRequestTaskId`] = null
      updates[`students/${anonymousId}/shareRequestOrigin`] = null
      updates[`students/${anonymousId}/shareSnapshotRequestedAt`] = null
      pendingShareIds.push(anonymousId)
    }
    await update(ref(db, `sessions/${lessonId}`), updates)
    await Promise.all(
      pendingShareIds.map((anonymousId) =>
        removeSharePayloadsQuietly(`sharedWorkspacePayloads/${lessonId}/pending/${anonymousId}`)
      )
    )
  }

  function buildOverrideRecord(anonymousId, taskId) {
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
      const record = buildOverrideRecord(anonymousId, taskId)
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
      const record = buildOverrideRecord(anonymousId, taskId)
      if (record) updates[`overrideLog/${anonymousId}/${taskId}`] = record
    }
    if (Object.keys(updates).length > 0) {
      await update(ref(db, `sessions/${lessonId}`), updates)
    }
  }

  async function enterSandbox({ code = null, files = null, previousTaskId = null } = {}) {
    const updates = { state: 'sandbox' }
    if (previousTaskId != null) updates.sandboxPreviousTaskId = previousTaskId
    if (code != null) {
      updates.sandboxCode = code
      updates.sandboxCodePushedAt = Date.now()
    }
    if (files != null) {
      const filesMap = Object.fromEntries(files.map((f) => [f.name, f.content]))
      updates.sandboxFiles = encodeFileKeys(filesMap)
      updates.sandboxFilesUpdatedAt = Date.now()
    }
    await update(ref(db, `sessions/${lessonId}`), updates)
  }

  async function exitSandbox() {
    const updates = {
      state: 'active',
      currentTaskStartedAt: Date.now(),
      sandboxCode: null,
      sandboxCodePushedAt: null,
      sandboxFiles: null,
      sandboxFilesUpdatedAt: null,
      sandboxExplainer: null,
      sandboxPreviousTaskId: null,
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
  }

  async function pushSandboxCode(code) {
    await update(ref(db, `sessions/${lessonId}`), {
      sandboxCode: code,
      sandboxCodePushedAt: Date.now(),
    })
  }

  async function pushSandboxFiles(files) {
    const filesMap = Object.fromEntries(files.map((f) => [f.name, f.content]))
    await update(ref(db, `sessions/${lessonId}`), {
      sandboxFiles: encodeFileKeys(filesMap),
      sandboxFilesUpdatedAt: Date.now(),
    })
  }

  async function pushSandboxExplainer(text) {
    await update(ref(db, `sessions/${lessonId}`), {
      sandboxExplainer: text || null,
    })
  }

  async function pushLessonOverride(tasks) {
    await set(ref(db, `sessions/${lessonId}/lessonOverrideTasks`), tasks)
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

  // ─── Student helpers ──────────────────────────────────────────────────────

  async function registerJoining(tempId) {
    const r = ref(db, `sessions/${lessonId}/joiningStudents/${tempId}`)
    onDisconnect(r).remove()
    await set(r, { joinedAt: Date.now() })
  }

  async function unregisterJoining(tempId) {
    await remove(ref(db, `sessions/${lessonId}/joiningStudents/${tempId}`))
  }

  async function registerPresence(anonymousId) {
    const presenceRef = ref(db, `sessions/${lessonId}/students/${anonymousId}/online`)
    await set(presenceRef, true)
    onDisconnect(presenceRef).remove()
  }

  async function joinSession(anonymousId, displayName) {
    await update(ref(db, `sessions/${lessonId}/students/${anonymousId}`), {
      displayName,
      joinedAt: Date.now(),
      currentCode: '',
      currentArcadeDesign: null,
      currentSpriteState: null,
      currentOutput: '',
      currentAnswer: null,
      lastRunStatus: null,
      checkPassed: null,
      lastRunAt: null,
    })
  }

  async function writeStudentRun(
    anonymousId,
    { code, files, output, answer, status, checkPassed }
  ) {
    const updates = {
      lastRunStatus: status,
      lastRunAt: Date.now(),
    }
    if (checkPassed !== undefined) updates.checkPassed = checkPassed
    if (code != null) updates.currentCode = code
    if (files != null) updates.currentFiles = encodeFileKeys(files)
    if (output != null) updates.currentOutput = output
    if (answer != null) updates.currentAnswer = answer
    await update(ref(db, `sessions/${lessonId}/students/${anonymousId}`), updates)
  }

  // Logs one attempt for a task into sessions/{lessonId}/attemptLog/{anonymousId}/{taskId}.
  // Deduplicates on the client: an unchanged submission just bumps "retries" on the
  // existing entry instead of creating a new one, and no further attempts are logged
  // once a task has been passed. Safe without an atomic increment because only this
  // student's own tab ever writes to their own attemptLog entries.
  async function logAttempt(anonymousId, taskId, { submission, passed, suggestion } = {}) {
    const cacheKey = `${anonymousId}:${taskId}`
    const cached = attemptCacheRef.current[cacheKey]
    if (cached?.passed) return

    const serialized =
      typeof submission === 'string' ? submission : JSON.stringify(submission ?? null)
    const basePath = `sessions/${lessonId}/attemptLog/${anonymousId}/${taskId}`

    if (cached && cached.serialized === serialized) {
      const nextRetries = cached.retries + 1
      const updates = { retries: nextRetries }
      if (passed) {
        updates.passed = true
        updates.passedAt = serverTimestamp()
      }
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

  async function writeStudentInteraction(
    anonymousId,
    { selection, activity, activeFile, viewingShareId } = {}
  ) {
    const updates = {}
    if (selection !== undefined) updates.currentSelection = selection
    if (activity !== undefined) updates.currentActivity = activity
    if (activeFile !== undefined) updates.currentActiveFile = activeFile
    if (viewingShareId !== undefined) updates.viewingShareId = viewingShareId
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
    { source = 'student', stageLabel = '', attemptNumber = null } = {}
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
        source: source === 'teacher' ? 'teacher' : 'student',
        attemptNumber: attemptNumber ?? countedAttempts,
        revealedAt: serverTimestamp(),
      }
    )
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

  // Visibility flags for showing Presentation View's live broadcast as a
  // support reference (see docs/agents/classroom-behaviours.md). These are
  // toggles, not one-shot commands — the actual content always comes live
  // from session.teacherLive; the flag just decides whether a student is
  // allowed to see it.
  async function setTeacherLiveReferenceForStudent(anonymousId, visible) {
    await set(
      ref(db, `sessions/${lessonId}/students/${anonymousId}/teacherLiveReferenceVisible`),
      visible || null
    )
  }

  async function setTeacherLiveReferenceForClass(visible) {
    await set(ref(db, `sessions/${lessonId}/teacherLiveReferenceVisibleToAll`), visible || null)
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
    setExplainerShowComplete,
    setActiveStudentView,
    setTeacherLive,
    updateTeacherLive,
    setTeacherLiveReference,
    renameStudent,
    removeStudent,
    pushResetToStudent,
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
    // student
    registerPresence,
    joinSession,
    registerJoining,
    unregisterJoining,
    writeStudentRun,
    logAttempt,
    writeStudentAnswer,
    writeStudentCode,
    writeStudentArcadeDesign,
    writeStudentSpriteState,
    writeStudentCursor,
    writeStudentBlockDrag,
    writeStudentCodeArrangeSlots,
    writeStudentFiles,
    writeStudentOutput,
    writeStudentInteraction,
    recordStudentCarryFallback,
    recordSupportStageReveal,
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
