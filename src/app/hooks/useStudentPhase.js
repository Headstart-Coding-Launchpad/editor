import { useState, useRef, useEffect } from 'react'

/**
 * Owns the student phase state machine: loading → waiting → name-entry → lesson → sandbox → solo → ended.
 * Also owns currentTaskId and viewingTaskId, which are tightly coupled to phase transitions.
 *
 * onBeforeTaskChange()    — call before currentTaskId is updated (save current work)
 * onPersonalSandboxExit() — call when a forced task/phase change must close personal sandbox
 */
export function useStudentPhase({
  session, sessionLoading,
  identity, identityLoaded,
  lessonId, lessonLoading,
  soloMode, teacherPresentation,
  firstTaskId = null,
  onBeforeTaskChange,
  onPersonalSandboxExit,
  onTaskReset,
  createIdentity,
  updateTimestamp,
  joinSession,
  registerJoining,
  unregisterJoining,
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

  // While in name-entry, write a temporary "joining" marker to Firebase so the teacher
  // can see students who are in the process of entering their name.
  useEffect(() => {
    if (phase !== 'name-entry') return
    const tempId = crypto.randomUUID()
    joiningTempIdRef.current = tempId
    registerJoiningRef.current?.(tempId)
    return () => {
      joiningTempIdRef.current = null
      unregisterJoiningRef.current?.(tempId)
    }
  }, [phase])

  // Sync currentTaskId when firstTaskId resolves — only during loading phase to avoid
  // overwriting a session-driven task that was already applied by the phase-determination effect
  useEffect(() => {
    if (firstTaskId != null && phaseRef.current === 'loading') setCurrentTaskId(firstTaskId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstTaskId])

  // ─── Phase determination ───────────────────────────────────────────────────

  useEffect(() => {
    if ((!soloMode && sessionLoading) || (!teacherPresentation && !identityLoaded) || lessonLoading) return

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

    // No session — go straight to solo or waiting depending on URL mode
    if (!session) {
      if (phaseRef.current === 'lesson' || phaseRef.current === 'sandbox') {
        onPersonalSandboxExit?.()
        onBeforeTaskChange?.()
        onTaskReset?.()
        setPhase('ended')
        return
      }
      if (phaseRef.current === 'name-entry' || phaseRef.current === 'waiting') {
        if (soloMode) { if (!identity) createIdentity('Solo', Date.now()); setPhase('solo') }
        else setPhase('waiting')
        return
      }
      if (phaseRef.current === 'loading') {
        if (soloMode) { if (!identity) createIdentity('Solo', Date.now()); setPhase('solo') }
        else setPhase('waiting')
        return
      }
      // Already solo — stay solo
      if (!identity) createIdentity('Solo', Date.now())
      setPhase('solo')
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
      if (phaseRef.current === 'loading') {
        if (soloMode) { if (!identity) createIdentity('Solo', Date.now()); setPhase('solo') }
        else setPhase('waiting')
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
        if (session.state === 'sandbox') { setPhase('sandbox'); return }
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

    // Returning student — update timestamp and drop in
    updateTimestamp(sessionTs)

    if (session.state === 'sandbox') { setPhase('sandbox'); return }
    setCurrentTaskId(session.currentTaskId ?? 1)
    setPhase('lesson')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoading, identityLoaded, lessonLoading, session?.state, session?.createdAt, session?.currentTaskId, soloMode, teacherPresentation])

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

  // ─── Handlers ─────────────────────────────────────────────────────────────

  async function handleNameSubmit(displayName) {
    setJoinError(null)
    const sessionTs = session.createdAt
    const id = createIdentity(displayName, sessionTs)
    try {
      await joinSession(id.anonymousId, displayName)
    } catch (err) {
      console.warn('Failed to join session:', err)
      setJoinError("Couldn't connect to the class session. Check your connection and try again.")
      return
    }
    // Only remove the joining marker once the real student record is written, so a failed
    // join (and any retry) keeps the teacher's live view showing this student as joining.
    if (joiningTempIdRef.current) {
      unregisterJoining(joiningTempIdRef.current)
      joiningTempIdRef.current = null
    }
    if (!session || session.state === 'ended') { setPhase('waiting'); return }
    if (session.state === 'waiting') { setPhase('waiting'); return }
    if (session.state === 'sandbox') { setPhase('sandbox'); return }
    setCurrentTaskId(session.currentTaskId ?? 1)
    setPhase('lesson')
  }

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
    phase, setPhase,
    currentTaskId, setCurrentTaskId,
    viewingTaskId, setViewingTaskId,
    joinError,
    handleNameSubmit, handleWaitForTeacher, handleGoSolo,
  }
}
