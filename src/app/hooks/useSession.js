import { useState, useEffect, useRef } from 'react'
import { ref, onValue, set, update, remove, serverTimestamp, onDisconnect } from 'firebase/database'
import { db } from '../../shared/firebase'

// Firebase keys cannot contain dots — encode/decode file names like "index.html"
function encodeFileKeys(files) {
  return Object.fromEntries(
    Object.entries(files).map(([k, v]) => [k.replace(/\./g, '__dot__'), v])
  )
}

export function decodeFileKey(key) {
  return key.replace(/__dot__/g, '.')
}

/**
 * Subscribes to a Firebase session and exposes helpers for reading/writing state.
 * Used by both the teacher view and the student view.
 */
export function useSession(lessonId) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(null)
  const sessionRef = useRef(null)

  useEffect(() => {
    const connRef = ref(db, '.info/connected')
    const unsub = onValue(connRef, snap => setConnected(snap.val() === true))
    return () => unsub()
  }, [])

  useEffect(() => {
    if (!lessonId) return
    const r = ref(db, `sessions/${lessonId}`)
    sessionRef.current = r

    const unsub = onValue(r, snap => {
      setSession(snap.exists() ? snap.val() : null)
      setLoading(false)
    })

    return () => unsub()
  }, [lessonId])

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
      students:              {},
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
      students:              null,
    })
    // When the teacher closes the tab, remove the session entirely so the
    // lesson becomes available for solo study without a stale "ended" record.
    onDisconnect(ref(db, `sessions/${lessonId}`)).remove()
  }

  async function setTaskId(taskId) {
    const updates = { currentTaskId: taskId, currentTaskStartedAt: Date.now() }
    for (const anonymousId of Object.keys(session?.students ?? {})) {
      updates[`students/${anonymousId}/checkPassed`]    = false
      updates[`students/${anonymousId}/lastRunStatus`]  = null
      updates[`students/${anonymousId}/currentOutput`]  = ''
      updates[`students/${anonymousId}/currentCode`]    = ''
      updates[`students/${anonymousId}/currentFiles`]   = null
      updates[`students/${anonymousId}/currentAnswer`]  = null
      updates[`students/${anonymousId}/currentSelection`] = null
      updates[`students/${anonymousId}/currentActivity`] = null
      updates[`students/${anonymousId}/currentActiveFile`] = null
    }
    await update(ref(db, `sessions/${lessonId}`), updates)
  }

  async function enterSandbox({ code = null, files = null } = {}) {
    const updates = { state: 'sandbox' }
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
    await update(ref(db, `sessions/${lessonId}`), {
      state:                 'active',
      currentTaskStartedAt:  Date.now(),
      sandboxCode:           null,
      sandboxCodePushedAt:   null,
      sandboxFiles:          null,
      sandboxFilesUpdatedAt: null,
    })
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

  async function setPaused(isPaused) {
    await update(ref(db, `sessions/${lessonId}`), { isPaused })
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
    })
    onDisconnect(r2).set(null)
  }

  async function updateTeacherLive(payload) {
    await update(ref(db, `sessions/${lessonId}/teacherLive`), {
      updatedAt: Date.now(),
      ...payload,
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

  // ─── Student helpers ──────────────────────────────────────────────────────

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
      currentOutput: '',
      currentAnswer: null,
      lastRunStatus: null,
      checkPassed:   false,
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

  async function writeStudentCode(anonymousId, code) {
    await set(ref(db, `sessions/${lessonId}/students/${anonymousId}/currentCode`), code)
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

  async function writeStudentPersonalSandbox(anonymousId, inPersonalSandbox) {
    await set(ref(db, `sessions/${lessonId}/students/${anonymousId}/inPersonalSandbox`), inPersonalSandbox || null)
  }

  return {
    session,
    loading,
    connected,
    // teacher
    createSession, restartSession, startSession, endSession,
    setTaskId, enterSandbox, exitSandbox, pushSandboxCode, pushSandboxFiles,
    setPaused, setActiveStudentView, setTeacherLive, updateTeacherLive, renameStudent, removeStudent, pushResetToStudent,
    // student
    registerPresence, joinSession, writeStudentRun, writeStudentCode, writeStudentFiles, writeStudentOutput, writeStudentInteraction, writeStudentPersonalSandbox,
  }
}
