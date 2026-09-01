import { useState, useEffect, useRef } from 'react'
import { ref, onValue, set, update, remove, push, serverTimestamp, onDisconnect } from 'firebase/database'
import { db } from '../../shared/firebase'
import { encodeFileKey } from '../../shared/fileKeys'

function encodeFileKeys(files) {
  return Object.fromEntries(Object.entries(files).map(([k, v]) => [encodeFileKey(k), v]))
}

function encodeWorkspaceFiles(files) {
  const fileMap = Array.isArray(files)
    ? Object.fromEntries(files.map(file => [file.name, file.content]))
    : files
  return encodeFileKeys(fileMap ?? {})
}

function getAttemptEntries(session, anonymousId, taskId) {
  return Object.values(session?.attemptLog?.[anonymousId]?.[taskId] ?? {})
    .sort((a, b) => (a.attemptNumber ?? 0) - (b.attemptNumber ?? 0))
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
    const unsub = onValue(connRef, snap => setConnected(snap.val() === true))
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

    const unsub = onValue(r, snap => {
      setSession(snap.exists() ? snap.val() : null)
      setLoading(false)
    })

    return () => unsub()
  }, [enabled, lessonId])

  // ─── Teacher helpers ──────────────────────────────────────────────────────

  async function createSession() {
    await set(ref(db, `sessions/${lessonId}`), {
      lessonId,
      state:                 'waiting',
      currentTaskId:         1,
      createdAt:             Date.now(),
      startedAt:             null,
      currentTaskStartedAt:  null,
      endedAt:               null,
      activeStudentView:     null,
      teacherLive:           null,
      isPaused:              false,
      sandboxCode:           null,
      sandboxCodePushedAt:   null,
      sandboxFiles:          null,
      sandboxFilesUpdatedAt: null,
      sandboxExplainer:      null,
      sandboxPreviousTaskId: null,
      lessonOverrideTasks:   null,
      explainerShowComplete: false,
      taskStartTimes:        {},
      students:              {},
      supportRevealLog:      null,
      fullscreenRequestedAt: null,
      videoCallLink:         null,
    })
  }

  async function restartSession() {
    await createSession()
  }

  async function startSession() {
    const now = Date.now()
    await update(ref(db, `sessions/${lessonId}`), {
      state:                'active',
      startedAt:            now,
      currentTaskStartedAt: now,
      endedAt:              null,
      [`taskStartTimes/${session?.currentTaskId ?? 1}`]: now,
    })
  }

  async function endSession() {
    await update(ref(db, `sessions/${lessonId}`), {
      state:                 'ended',
      endedAt:               Date.now(),
      activeStudentView:     null,
      teacherLive:           null,
      sandboxCode:           null,
      sandboxCodePushedAt:   null,
      sandboxFiles:          null,
      sandboxFilesUpdatedAt: null,
      sandboxExplainer:      null,
      sandboxPreviousTaskId: null,
      lessonOverrideTasks:   null,
      explainerShowComplete: false,
      students:              null,
      overrideLog:           null,
      supportRevealLog:      null,
      fullscreenRequestedAt: null,
      videoCallLink:         null,
    })
    // When the teacher closes the tab, remove the session entirely so the
    // lesson becomes available for solo study without a stale "ended" record.
    onDisconnect(ref(db, `sessions/${lessonId}`)).remove()
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
      [`taskStartTimes/${taskId}`]: now,
    }
    for (const anonymousId of Object.keys(session?.students ?? {})) {
      updates[`students/${anonymousId}/checkPassed`]           = null
      updates[`students/${anonymousId}/lastRunStatus`]         = null
      updates[`students/${anonymousId}/currentOutput`]         = ''
      updates[`students/${anonymousId}/currentCode`]           = ''
      updates[`students/${anonymousId}/currentArcadeDesign`]   = null
      updates[`students/${anonymousId}/currentSpriteState`]    = null
      updates[`students/${anonymousId}/currentCursor`]         = null
      updates[`students/${anonymousId}/currentBlockDrag`]      = null
      updates[`students/${anonymousId}/currentCodeArrangeSlots`] = null
      updates[`students/${anonymousId}/currentFiles`]          = null
      updates[`students/${anonymousId}/currentAnswer`]         = null
      updates[`students/${anonymousId}/currentSelection`]      = null
      updates[`students/${anonymousId}/currentActivity`]       = null
      updates[`students/${anonymousId}/currentActiveFile`]     = null
      updates[`students/${anonymousId}/checkOverridePassed`]    = null
      updates[`students/${anonymousId}/checkOverrideHint`]      = null
      updates[`students/${anonymousId}/checkOverridePushedAt`]  = null
      updates[`students/${anonymousId}/needsHelp`]              = null
      updates[`students/${anonymousId}/currentTopicId`]         = null
      updates[`students/${anonymousId}/sentToTopicId`]          = null
      updates[`students/${anonymousId}/sentToTopicPushedAt`]    = null
      updates[`students/${anonymousId}/teacherMessage`]         = null
      updates[`students/${anonymousId}/teacherMessagePushedAt`] = null
      updates[`students/${anonymousId}/teacherEditRequestedAt`]  = null
      updates[`students/${anonymousId}/teacherEditAcceptedAt`]  = null
      updates[`students/${anonymousId}/teacherLiveCode`]        = null
      updates[`students/${anonymousId}/teacherLiveFiles`]       = null
      updates[`students/${anonymousId}/teacherLiveActiveFile`]  = null
      updates[`students/${anonymousId}/teacherLiveWorkspace`]   = null
      updates[`students/${anonymousId}/teacherLiveArcadeDesign`] = null
      updates[`students/${anonymousId}/teacherEditApplyCode`]   = null
      updates[`students/${anonymousId}/teacherEditApplyFiles`]  = null
      updates[`students/${anonymousId}/teacherEditApplyArcadeDesign`] = null
      updates[`students/${anonymousId}/teacherEditAppliedAt`]   = null
      updates[`students/${anonymousId}/teacherStageRequestedAt`]  = null
      updates[`students/${anonymousId}/teacherStagePendingAction`] = null
      updates[`students/${anonymousId}/teacherStageAcceptedAt`]   = null
      updates[`students/${anonymousId}/teacherHighlights`]        = null
    }
    await update(ref(db, `sessions/${lessonId}`), updates)
  }

  function buildOverrideRecord(anonymousId, taskId) {
    if (taskId == null) return null
    if (session?.overrideLog?.[anonymousId]?.[taskId]) return null
    if (session?.students?.[anonymousId]?.checkPassed === true) return null

    const entries = getAttemptEntries(session, anonymousId, taskId)
    if (entries.some(entry => entry.passed)) return null

    const attemptNumber = countAttemptRuns(entries)
    return {
      taskId,
      overriddenAt:        serverTimestamp(),
      attemptNumber,
      previousCheckState:  attemptNumber > 0 ? 'failed' : 'unattempted',
    }
  }

  async function overrideStudentCheck(anonymousId, passed, hint = null, taskId = session?.currentTaskId) {
    const now = Date.now()
    const updates = {
      [`students/${anonymousId}/checkOverridePassed`]:   passed,
      [`students/${anonymousId}/checkOverrideHint`]:     hint || null,
      [`students/${anonymousId}/checkOverridePushedAt`]: now,
    }
    if (passed) {
      const record = buildOverrideRecord(anonymousId, taskId)
      if (record) updates[`overrideLog/${anonymousId}/${taskId}`] = record
    }
    await update(ref(db, `sessions/${lessonId}`), updates)
  }

  async function recordClassAdvanceOverrides(taskId, anonymousIds = Object.keys(session?.students ?? {})) {
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
      updates.sandboxCode        = code
      updates.sandboxCodePushedAt = Date.now()
    }
    if (files != null) {
      const filesMap             = Object.fromEntries(files.map(f => [f.name, f.content]))
      updates.sandboxFiles        = encodeFileKeys(filesMap)
      updates.sandboxFilesUpdatedAt = Date.now()
    }
    await update(ref(db, `sessions/${lessonId}`), updates)
  }

  async function exitSandbox() {
    const updates = {
      state:                 'active',
      currentTaskStartedAt:  Date.now(),
      sandboxCode:           null,
      sandboxCodePushedAt:   null,
      sandboxFiles:          null,
      sandboxFilesUpdatedAt: null,
      sandboxExplainer:      null,
      sandboxPreviousTaskId: null,
    }
    // Going live can silently move the class onto the sandbox module's first
    // task (see TeacherView.handleGoLiveSandbox) so the right editor/module
    // renders; restore whatever task was actually active before that jump.
    if (session?.sandboxPreviousTaskId != null && session.sandboxPreviousTaskId !== session?.currentTaskId) {
      updates.currentTaskId = session.sandboxPreviousTaskId
    }
    await update(ref(db, `sessions/${lessonId}`), updates)
  }

  async function pushSandboxCode(code) {
    await update(ref(db, `sessions/${lessonId}`), {
      sandboxCode:        code,
      sandboxCodePushedAt: Date.now(),
    })
  }

  async function pushSandboxFiles(files) {
    const filesMap = Object.fromEntries(files.map(f => [f.name, f.content]))
    await update(ref(db, `sessions/${lessonId}`), {
      sandboxFiles:          encodeFileKeys(filesMap),
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
      remoteResetAction:   action,
      remoteResetPushedAt: Date.now(),
    })
  }

  async function dismissHelp(anonymousId) {
    await set(ref(db, `sessions/${lessonId}/students/${anonymousId}/needsHelp`), null)
  }

  async function sendMessageToStudent(anonymousId, message) {
    await update(ref(db, `sessions/${lessonId}/students/${anonymousId}`), {
      teacherMessage:         message || null,
      teacherMessagePushedAt: Date.now(),
    })
  }

  async function requestTeacherEdit(anonymousId) {
    await update(ref(db, `sessions/${lessonId}/students/${anonymousId}`), {
      teacherEditRequestedAt: Date.now(),
      teacherEditAcceptedAt:  null,
      teacherLiveCode:        null,
      teacherLiveFiles:       null,
      teacherLiveActiveFile:  null,
      teacherLiveWorkspace:   null,
      teacherLiveArcadeDesign: null,
      teacherEditApplyCode:   null,
      teacherEditApplyFiles:  null,
      teacherEditApplyArcadeDesign: null,
      teacherEditAppliedAt:   null,
    })
  }

  async function pushTeacherLiveCode(anonymousId, edit) {
    const payload = typeof edit === 'string' ? { code: edit } : (edit ?? {})
    const updates = {}
    if ('code' in payload) updates.teacherLiveCode = payload.code ?? null
    if ('files' in payload) updates.teacherLiveFiles = payload.files ? encodeWorkspaceFiles(payload.files) : null
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
      teacherEditAcceptedAt:  null,
      teacherLiveCode:        null,
      teacherLiveFiles:       null,
      teacherLiveActiveFile:  null,
      teacherLiveWorkspace:   null,
      teacherLiveArcadeDesign: null,
      teacherEditApplyCode:   payload.code ?? null,
      teacherEditApplyFiles:  payload.files ? encodeWorkspaceFiles(payload.files) : null,
      teacherEditApplyArcadeDesign: payload.arcadeDesign ?? null,
      teacherEditAppliedAt:   Date.now(),
      currentCode:            payload.code ?? null,
      currentFiles:           payload.files ? encodeWorkspaceFiles(payload.files) : null,
      currentArcadeDesign:    payload.arcadeDesign ?? null,
    })
  }

  async function cancelTeacherEdit(anonymousId) {
    await update(ref(db, `sessions/${lessonId}/students/${anonymousId}`), {
      teacherEditRequestedAt: null,
      teacherEditAcceptedAt:  null,
      teacherLiveCode:        null,
      teacherLiveFiles:       null,
      teacherLiveActiveFile:  null,
      teacherLiveWorkspace:   null,
      teacherLiveArcadeDesign: null,
    })
  }

  async function requestTeacherStage(anonymousId, action) {
    await update(ref(db, `sessions/${lessonId}/students/${anonymousId}`), {
      teacherStageRequestedAt:  Date.now(),
      teacherStagePendingAction: action,
      teacherStageAcceptedAt:   null,
    })
  }

  async function clearTeacherStage(anonymousId) {
    await update(ref(db, `sessions/${lessonId}/students/${anonymousId}`), {
      teacherStageRequestedAt:  null,
      teacherStagePendingAction: null,
      teacherStageAcceptedAt:   null,
    })
  }

  async function pushTeacherHighlight(anonymousId, { file, from, to, emoji, note } = {}) {
    const newRef = push(ref(db, `sessions/${lessonId}/students/${anonymousId}/teacherHighlights`))
    await set(newRef, {
      file:      encodeFileKey(file),
      from,
      to,
      emoji,
      note:      note || null,
      createdAt: Date.now(),
    })
    return newRef.key
  }

  async function removeTeacherHighlight(anonymousId, highlightId) {
    await set(ref(db, `sessions/${lessonId}/students/${anonymousId}/teacherHighlights/${highlightId}`), null)
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
      joinedAt:      Date.now(),
      currentCode:   '',
      currentArcadeDesign: null,
      currentSpriteState: null,
      currentOutput: '',
      currentAnswer: null,
      lastRunStatus: null,
      checkPassed:   null,
      lastRunAt:     null,
    })
  }

  async function writeStudentRun(anonymousId, { code, files, output, answer, status, checkPassed }) {
    const updates = {
      lastRunStatus: status,
      lastRunAt:     Date.now(),
    }
    if (checkPassed !== undefined) updates.checkPassed = checkPassed
    if (code  != null) updates.currentCode   = code
    if (files != null) updates.currentFiles  = encodeFileKeys(files)
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

    const serialized = typeof submission === 'string' ? submission : JSON.stringify(submission ?? null)
    const basePath = `sessions/${lessonId}/attemptLog/${anonymousId}/${taskId}`

    if (cached && cached.serialized === serialized) {
      const nextRetries = cached.retries + 1
      const updates = { retries: nextRetries }
      if (passed) {
        updates.passed = true
        updates.passedAt = serverTimestamp()
      }
      await update(ref(db, `${basePath}/${cached.key}`), updates)
      attemptCacheRef.current[cacheKey] = { ...cached, retries: nextRetries, passed: passed || cached.passed }
      return
    }

    const attemptNumber = (cached?.attemptNumber ?? 0) + 1
    const newRef = push(ref(db, basePath))
    await set(newRef, {
      submission,
      passed,
      suggestion: suggestion || null,
      attemptNumber,
      retries: 0,
      loggedAt: serverTimestamp(),
      passedAt: passed ? serverTimestamp() : null,
    })
    attemptCacheRef.current[cacheKey] = { serialized, key: newRef.key, attemptNumber, retries: 0, passed }
  }

  async function writeStudentAnswer(anonymousId, answer) {
    await set(ref(db, `sessions/${lessonId}/students/${anonymousId}/currentAnswer`), answer)
  }

  async function writeStudentCode(anonymousId, code) {
    await set(ref(db, `sessions/${lessonId}/students/${anonymousId}/currentCode`), code)
  }

  async function writeStudentArcadeDesign(anonymousId, design) {
    await set(ref(db, `sessions/${lessonId}/students/${anonymousId}/currentArcadeDesign`), design ?? null)
  }

  async function writeStudentSpriteState(anonymousId, spriteState) {
    await set(ref(db, `sessions/${lessonId}/students/${anonymousId}/currentSpriteState`), spriteState ?? null)
  }

  async function writeStudentCursor(anonymousId, cursor) {
    await set(ref(db, `sessions/${lessonId}/students/${anonymousId}/currentCursor`), cursor ?? null)
  }

  async function writeStudentBlockDrag(anonymousId, blockDrag) {
    await set(ref(db, `sessions/${lessonId}/students/${anonymousId}/currentBlockDrag`), blockDrag ?? null)
  }

  // Live tile-placement state for the code_arrange task type — mirrors
  // writeStudentCursor/writeStudentBlockDrag above. The assembled code itself
  // (currentCode/currentFiles) only ever updates once every blank is filled
  // (see CodeArrangeTaskContainer), so without this field a teacher watching
  // a student mid-arrangement would see stale code from a previous task
  // instead of the tiles actually being placed.
  async function writeStudentCodeArrangeSlots(anonymousId, slotState) {
    await set(ref(db, `sessions/${lessonId}/students/${anonymousId}/currentCodeArrangeSlots`), slotState ?? null)
  }

  async function writeStudentFiles(anonymousId, files) {
    await set(ref(db, `sessions/${lessonId}/students/${anonymousId}/currentFiles`), encodeFileKeys(files))
  }

  async function writeStudentOutput(anonymousId, output) {
    await set(ref(db, `sessions/${lessonId}/students/${anonymousId}/currentOutput`), output)
  }

  async function writeStudentInteraction(anonymousId, { selection, activity, activeFile } = {}) {
    const updates = {}
    if (selection !== undefined) updates.currentSelection = selection
    if (activity !== undefined) updates.currentActivity = activity
    if (activeFile !== undefined) updates.currentActiveFile = activeFile
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

  async function recordSupportStageReveal(anonymousId, taskId, stageIndex, { source = 'student', stageLabel = '', attemptNumber = null } = {}) {
    if (!anonymousId || taskId == null || stageIndex == null) return
    if (session?.supportRevealLog?.[anonymousId]?.[taskId]?.[stageIndex]) return
    const entries = getAttemptEntries(session, anonymousId, taskId)
    const countedAttempts = countAttemptRuns(entries)
    await set(ref(db, `sessions/${lessonId}/supportRevealLog/${anonymousId}/${taskId}/${stageIndex}`), {
      taskId,
      stageIndex,
      stageLabel: stageLabel || null,
      source: source === 'teacher' ? 'teacher' : 'student',
      attemptNumber: attemptNumber ?? countedAttempts,
      revealedAt: serverTimestamp(),
    })
  }

  async function writeStudentPresence(anonymousId, { windowFocused, lastActivityAt, visiblePanes, isFullscreen } = {}) {
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
    await set(ref(db, `sessions/${lessonId}/students/${anonymousId}/inPersonalSandbox`), inPersonalSandbox || null)
  }

  async function requestHelp(anonymousId) {
    await set(ref(db, `sessions/${lessonId}/students/${anonymousId}/needsHelp`), true)
  }

  async function setStudentTopic(anonymousId, topicId) {
    await set(ref(db, `sessions/${lessonId}/students/${anonymousId}/currentTopicId`), topicId || null)
  }

  async function sendToTopic(anonymousId, topicId) {
    await update(ref(db, `sessions/${lessonId}/students/${anonymousId}`), {
      sentToTopicId:       topicId || null,
      sentToTopicPushedAt: Date.now(),
    })
  }

  async function acceptTeacherEdit(anonymousId) {
    await set(ref(db, `sessions/${lessonId}/students/${anonymousId}/teacherEditAcceptedAt`), Date.now())
  }

  async function declineTeacherEdit(anonymousId) {
    await update(ref(db, `sessions/${lessonId}/students/${anonymousId}`), {
      teacherEditRequestedAt: null,
      teacherEditAcceptedAt:  null,
    })
  }

  async function acceptTeacherStage(anonymousId) {
    await set(ref(db, `sessions/${lessonId}/students/${anonymousId}/teacherStageAcceptedAt`), Date.now())
  }

  async function declineTeacherStage(anonymousId) {
    await update(ref(db, `sessions/${lessonId}/students/${anonymousId}`), {
      teacherStageRequestedAt:  null,
      teacherStagePendingAction: null,
      teacherStageAcceptedAt:   null,
    })
  }

  return {
    session,
    loading,
    connected,
    // teacher
    createSession, restartSession, startSession, endSession,
    setTaskId, enterSandbox, exitSandbox, pushSandboxCode, pushSandboxFiles, pushSandboxExplainer,
    pushLessonOverride, clearLessonOverride,
    setPaused, requestFullscreenForAll, setExplainerShowComplete, setActiveStudentView, setTeacherLive, updateTeacherLive, renameStudent, removeStudent, pushResetToStudent, overrideStudentCheck, recordClassAdvanceOverrides, dismissHelp,
    sendToTopic, sendMessageToStudent, updateVideoCallLink, sendVideoCallLink,
    requestTeacherEdit, pushTeacherLiveCode, commitTeacherEdit, cancelTeacherEdit,
    requestTeacherStage, clearTeacherStage,
    pushTeacherHighlight, removeTeacherHighlight,
    // student
    registerPresence, joinSession, registerJoining, unregisterJoining,
    writeStudentRun, logAttempt, writeStudentAnswer, writeStudentCode, writeStudentArcadeDesign, writeStudentSpriteState, writeStudentCursor, writeStudentBlockDrag, writeStudentCodeArrangeSlots, writeStudentFiles, writeStudentOutput, writeStudentInteraction, recordStudentCarryFallback, recordSupportStageReveal, writeStudentPersonalSandbox, writeStudentPresence, requestHelp,
    setStudentTopic, acceptTeacherEdit, declineTeacherEdit, acceptTeacherStage, declineTeacherStage,
  }
}
