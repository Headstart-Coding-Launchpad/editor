import { useState, useRef, useEffect, useCallback } from 'react'
import { applyNameSuffix, normaliseJoinName, readAdmitName } from '../joiningStudents'

/**
 * Owns the student phase state machine: loading → choice → waiting → name-entry → lesson → sandbox → solo → ended.
 * `choice` is shown when no session exists yet, so the student picks Join Live Lesson (→ waiting/name-entry)
 * or Go Solo (→ solo), rather than being dropped straight into the waiting room.
 * Also owns currentTaskId and viewingTaskId, which are tightly coupled to phase transitions.
 *
 * onBeforeTaskChange()    — call before currentTaskId is updated (save current work)
 * onPersonalSandboxExit() — call when a forced task/phase change must close personal sandbox
 */
/** How long after a session ends a reload by one of its students returns to the end screen. */
export const END_SCREEN_RESTORE_MS = 3 * 60 * 60 * 1000

function isRecentEndScreenReload(session, identity, now = Date.now()) {
  if (!identity?.anonymousId || session?.createdAt == null) return false
  if (identity.lastSessionTimestamp !== session.createdAt) return false
  return session.endedAt != null && now - session.endedAt < END_SCREEN_RESTORE_MS
}

export function useStudentPhase({
  session,
  sessionLoading,
  identity,
  identityLoaded,
  lessonId,
  lessonLoading,
  soloMode,
  teacherPresentation,
  firstTaskId = null,
  onBeforeTaskChange,
  onPersonalSandboxExit,
  onTaskReset,
  createIdentity,
  updateTimestamp,
  joinSession,
  recordStudentReturn,
  registerJoining,
  unregisterJoining,
  setJoiningTypedName,
  subscribeJoiningMarker,
}) {
  const [phase, setPhase] = useState('loading')
  const [currentTaskId, setCurrentTaskId] = useState(firstTaskId ?? 1)
  const [viewingTaskId, setViewingTaskId] = useState(null)
  const [joinError, setJoinError] = useState(null)

  const phaseRef = useRef(phase)
  phaseRef.current = phase

  // Stable refs for joining callbacks so the effect dep array stays on `phase` only
  const registerJoiningRef = useRef(registerJoining)
  registerJoiningRef.current = registerJoining
  const unregisterJoiningRef = useRef(unregisterJoining)
  unregisterJoiningRef.current = unregisterJoining
  // Holds the tempId for the current name-entry phase so handleNameSubmit can
  // eagerly remove the joining marker before writing to students/.
  const joiningTempIdRef = useRef(null)
  // The session (createdAt) this tab already logged a reload-return for, so effect reruns
  // (task changes, state flips) never log another one.
  const returnRecordedForRef = useRef(null)
  // The same tempId as state, so the admit listener below re-subscribes per marker.
  const [joiningTempId, setJoiningTempId] = useState(null)
  const setJoiningTypedNameRef = useRef(setJoiningTypedName)
  setJoiningTypedNameRef.current = setJoiningTypedName
  const subscribeJoiningMarkerRef = useRef(subscribeJoiningMarker)
  subscribeJoiningMarkerRef.current = subscribeJoiningMarker
  // True while a name submit (typed or teacher-admitted) is writing the student record.
  const nameSubmitInFlightRef = useRef(false)
  // The marker whose teacher admit has already been acted on — an admit runs once.
  const admitHandledForRef = useRef(null)

  // While in name-entry, write a temporary "joining" marker to Firebase so the teacher
  // can see students who are in the process of entering their name.
  useEffect(() => {
    if (phase !== 'name-entry') return
    const tempId = crypto.randomUUID()
    joiningTempIdRef.current = tempId
    setJoiningTempId(tempId)
    registerJoiningRef.current?.(tempId)
    return () => {
      joiningTempIdRef.current = null
      setJoiningTempId(null)
      unregisterJoiningRef.current?.(tempId)
    }
  }, [phase])

  // Shares the name being typed on the marker (NameEntry throttles the calls). A no-op
  // once the marker is gone, so a trailing write can't recreate it after a submit.
  const reportTypedName = useCallback((value) => {
    const tempId = joiningTempIdRef.current
    if (!tempId || phaseRef.current !== 'name-entry') return
    const write = setJoiningTypedNameRef.current
    if (!write) return
    Promise.resolve(write(tempId, normaliseJoinName(value))).catch((err) =>
      console.warn('Failed to share typed name:', err)
    )
  }, [])

  // Sync currentTaskId when firstTaskId resolves — only during loading phase to avoid
  // overwriting a session-driven task that was already applied by the phase-determination effect
  useEffect(() => {
    if (firstTaskId != null && phaseRef.current === 'loading') setCurrentTaskId(firstTaskId)
  }, [firstTaskId])

  // ─── Phase determination ───────────────────────────────────────────────────

  useEffect(() => {
    if ((!soloMode && sessionLoading) || (!teacherPresentation && !identityLoaded) || lessonLoading)
      return

    if (teacherPresentation) {
      if (!session) {
        setPhase('waiting')
        return
      }
      if (session.state === 'ended') {
        setPhase('ended')
        return
      }
      if (session.state === 'sandbox') {
        setPhase('sandbox')
        return
      }
      setCurrentTaskId(session.currentTaskId ?? 1)
      setPhase('lesson')
      return
    }

    // Solo URLs stay solo even when a live/waiting session exists for the lesson.
    if (soloMode) {
      if (phaseRef.current === 'solo') return
      if (!identity) createIdentity('Solo', Date.now())
      setPhase('solo')
      return
    }

    // No session — offer the solo-vs-wait choice, unless the student already committed
    // to solo, is mid-name-entry, or has already finished (ended screen).
    if (!session) {
      if (phaseRef.current === 'lesson' || phaseRef.current === 'sandbox') {
        onPersonalSandboxExit?.()
        onBeforeTaskChange?.()
        onTaskReset?.()
        setPhase('ended')
        return
      }
      if (phaseRef.current === 'solo' || phaseRef.current === 'ended') return
      setPhase('choice')
      return
    }

    // Session ended — exit any join flow gracefully
    if (session.state === 'ended') {
      if (phaseRef.current === 'lesson' || phaseRef.current === 'sandbox') {
        onPersonalSandboxExit?.()
        onBeforeTaskChange?.()
        onTaskReset?.()
        setPhase('ended')
        return
      }
      // A student reloading their own end screen gets it back (with their coding moments,
      // which endSession keeps), but only for a while: an old ended session shouldn't hide
      // the Join Live choice next lesson.
      if (phaseRef.current === 'loading' && isRecentEndScreenReload(session, identity)) {
        setPhase('ended')
        return
      }
      if (phaseRef.current === 'loading' || phaseRef.current === 'choice') {
        setPhase('choice')
        return
      }
      if (!identity) createIdentity('Solo', Date.now())
      setPhase('solo')
      return
    }

    // Verify the session belongs to this lesson before proceeding
    if (session.lessonId && session.lessonId !== lessonId) {
      if (!identity) createIdentity('Solo', Date.now())
      setPhase('solo')
      return
    }

    // Solo mode is URL-determined — stay in current phase when session state changes
    if (phaseRef.current === 'solo' || phaseRef.current === 'ended') return

    // Don't interrupt the student while they're entering their name
    if (phaseRef.current === 'name-entry') return

    if (session.state === 'waiting') {
      // Already in waiting room — check if they need to be prompted for name now
      if (phaseRef.current === 'waiting') {
        const alreadyRegistered = identity && identity.lastSessionTimestamp === session.createdAt
        if (!alreadyRegistered) setPhase('name-entry')
        return
      }
      // Fresh arrival in live mode → name entry
      if (soloMode) return
      setPhase('name-entry')
      return
    }

    // Session is active or sandbox
    const sessionTs = session.createdAt
    const isReturning = identity && identity.lastSessionTimestamp === sessionTs

    // Student was in the waiting room and the session just became active
    if (phaseRef.current === 'waiting') {
      if (isReturning) {
        if (session.state === 'sandbox') {
          setPhase('sandbox')
          return
        }
        setCurrentTaskId(session.currentTaskId ?? 1)
        setPhase('lesson')
      } else {
        setPhase('name-entry')
      }
      return
    }

    if (!identity || !isReturning) {
      setPhase('name-entry')
      return
    }

    // Returning student — update timestamp and drop in. Landing here straight from 'loading'
    // is a reload (or a fresh tab) of a student who already joined: log it as a rejoin for
    // the session report. Later reruns of this effect reach here from 'lesson'/'sandbox'.
    if (phaseRef.current === 'loading' && returnRecordedForRef.current !== sessionTs) {
      returnRecordedForRef.current = sessionTs
      recordStudentReturn?.(identity.anonymousId)
    }
    updateTimestamp(sessionTs)

    if (session.state === 'sandbox') {
      setPhase('sandbox')
      return
    }
    setCurrentTaskId(session.currentTaskId ?? 1)
    setPhase('lesson')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    sessionLoading,
    identityLoaded,
    lessonLoading,
    session?.state,
    session?.createdAt,
    session?.currentTaskId,
    soloMode,
    teacherPresentation,
  ])

  // Close teacher presentation window when session ends
  useEffect(() => {
    if (teacherPresentation && !sessionLoading && session?.state === 'ended') window.close()
  }, [teacherPresentation, sessionLoading, session?.state])

  // React to teacher moving to a new task
  useEffect(() => {
    if (!session?.currentTaskId || phase !== 'lesson') return
    if (session.currentTaskId !== currentTaskId) {
      onPersonalSandboxExit?.()
      onBeforeTaskChange?.()
      onTaskReset?.()
      setCurrentTaskId(session.currentTaskId)
      setViewingTaskId(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.currentTaskId])

  // Teacher "Pull in": the teacher writes admit = { name, at } on this device's joining
  // marker, and the student joins exactly as if they had typed that name and pressed Join
  // (duplicate suffixing here, identity + joinSession in handleNameSubmit). The phase logic
  // above ignores session changes during name entry, so this watches the marker itself.
  const handleNameSubmitRef = useRef(null)
  const sessionRef = useRef(session)
  sessionRef.current = session
  useEffect(() => {
    const subscribe = subscribeJoiningMarkerRef.current
    if (!joiningTempId || !subscribe) return
    const unsubscribe = subscribe(joiningTempId, (marker) => {
      if (admitHandledForRef.current === joiningTempId) return
      if (joiningTempIdRef.current !== joiningTempId || phaseRef.current !== 'name-entry') return
      // The student pressed Join themselves and that submit is still in flight.
      if (nameSubmitInFlightRef.current) return
      const name = readAdmitName(marker)
      if (!name) return
      admitHandledForRef.current = joiningTempId
      const existingNames = Object.values(sessionRef.current?.students ?? {}).map(
        (st) => st?.displayName
      )
      handleNameSubmitRef.current?.(applyNameSuffix(name, existingNames))
    })
    return () => unsubscribe?.()
  }, [joiningTempId])

  // ─── Handlers ─────────────────────────────────────────────────────────────

  async function handleNameSubmit(displayName) {
    setJoinError(null)
    const sessionTs = session.createdAt
    const id = createIdentity(displayName, sessionTs)
    nameSubmitInFlightRef.current = true
    try {
      await joinSession(id.anonymousId, displayName)
    } catch (err) {
      console.warn('Failed to join session:', err)
      setJoinError("Couldn't connect to the class session. Check your connection and try again.")
      return
    } finally {
      nameSubmitInFlightRef.current = false
    }
    // Only remove the joining marker once the real student record is written, so a failed
    // join (and any retry) keeps the teacher's live view showing this student as joining.
    if (joiningTempIdRef.current) {
      unregisterJoining(joiningTempIdRef.current)
      joiningTempIdRef.current = null
    }
    if (!session || session.state === 'ended') {
      setPhase('waiting')
      return
    }
    if (session.state === 'waiting') {
      setPhase('waiting')
      return
    }
    if (session.state === 'sandbox') {
      setPhase('sandbox')
      return
    }
    setCurrentTaskId(session.currentTaskId ?? 1)
    setPhase('lesson')
  }

  handleNameSubmitRef.current = handleNameSubmit

  function handleWaitForTeacher() {
    if (session && session.state === 'waiting') {
      setPhase('name-entry')
    } else {
      setPhase('waiting')
    }
  }

  function handleGoSolo() {
    createIdentity('Solo', Date.now())
    setPhase('solo')
  }

  return {
    phase,
    setPhase,
    currentTaskId,
    setCurrentTaskId,
    viewingTaskId,
    setViewingTaskId,
    joinError,
    handleNameSubmit,
    handleWaitForTeacher,
    handleGoSolo,
    reportTypedName,
  }
}
