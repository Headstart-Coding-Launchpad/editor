import { useEffect, useRef } from 'react'

// How often window/keyboard activity is reported. The teacher grid only needs a
// WhatsApp-style "typing" indicator, so one write every couple of seconds is plenty.
const ACTIVITY_WRITE_INTERVAL_MS = 2000

// Minimum gap between self-heal re-registrations while `online` stays missing.
const PRESENCE_HEAL_INTERVAL_MS = 10000

const REPORTING_PHASES = ['lesson', 'sandbox']

/**
 * Reports this student's presence to the teacher: connected, window focused, fullscreen,
 * and recently active. Nothing here touches the editor — it is the browser telling the
 * session what the student's window is doing.
 *
 * Presentation windows report nothing and actively remove themselves from the roster,
 * since a teacher's presentation view must not appear as a student.
 */
export function useStudentPresenceReporting({
  phase,
  identity,
  session,
  connected,
  teacherPresentation,
  registerPresence,
  writeStudentPresence,
  removeStudent,
}) {
  const anonymousId = identity?.anonymousId
  const reporting = !teacherPresentation && !!anonymousId && REPORTING_PHASES.includes(phase)

  // Register Firebase presence so the teacher sees who is connected live. Also
  // re-registers on reconnect (connected flips true) so the online key is restored after
  // a temporary network drop without a page refresh.
  const lastRegisteredAt = useRef(0)
  // Only a joined student (node present) whose `online` key is missing needs healing; an
  // absent node means the teacher removed them, and it must stay removed.
  const needsHeal = !!session?.students?.[anonymousId] && !session.students[anonymousId].online
  const needsHealRef = useRef(needsHeal)
  useEffect(() => {
    needsHealRef.current = needsHeal
  }, [needsHeal])
  useEffect(() => {
    if (!reporting || !connected) return
    lastRegisteredAt.current = Date.now()
    registerPresence(anonymousId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reporting, anonymousId, connected])

  // Self-heal: a late server-side onDisconnect from an old tab/connection can remove `online`
  // after this connection set it, and `connected` never flips, so nothing would restore it.
  // While connected and our own `online` key is missing, register again, at most once per
  // PRESENCE_HEAL_INTERVAL_MS. No writes happen while `online` is present.
  useEffect(() => {
    if (!reporting || !connected || !needsHeal) return
    const heal = () => {
      if (!needsHealRef.current) return
      if (Date.now() - lastRegisteredAt.current < PRESENCE_HEAL_INTERVAL_MS) return
      lastRegisteredAt.current = Date.now()
      try {
        Promise.resolve(registerPresence(anonymousId)).catch(() => {})
      } catch {
        // a failed heal is retried on the next interval
      }
    }
    heal()
    const timer = setInterval(heal, PRESENCE_HEAL_INTERVAL_MS)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reporting, anonymousId, connected, needsHeal])

  // Whether the student's browser window is focused, so the teacher sees "Away" when a
  // student has switched tabs or minimised the window.
  useEffect(() => {
    if (!reporting) return
    const onFocus = () => writeStudentPresence?.(anonymousId, { windowFocused: true })
    const onBlur = () => writeStudentPresence?.(anonymousId, { windowFocused: false })
    writeStudentPresence?.(anonymousId, { windowFocused: document.hasFocus() })
    window.addEventListener('focus', onFocus)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('blur', onBlur)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reporting, anonymousId])

  // Fullscreen state, so the teacher can see who has accepted a "Fullscreen All" request
  // (see StudentGrid/StudentStatusBanners).
  useEffect(() => {
    if (!reporting) return
    const report = () =>
      writeStudentPresence?.(anonymousId, { isFullscreen: !!document.fullscreenElement })
    report()
    document.addEventListener('fullscreenchange', report)
    return () => document.removeEventListener('fullscreenchange', report)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reporting, anonymousId])

  // Mouse/keyboard activity, throttled to one write per ACTIVITY_WRITE_INTERVAL_MS.
  useEffect(() => {
    if (!reporting) return
    let lastWrite = 0
    const record = () => {
      const now = Date.now()
      if (now - lastWrite < ACTIVITY_WRITE_INTERVAL_MS) return
      lastWrite = now
      writeStudentPresence?.(anonymousId, { lastActivityAt: now })
    }
    const events = ['mousemove', 'keydown', 'mousedown']
    events.forEach((event) => window.addEventListener(event, record))
    return () => events.forEach((event) => window.removeEventListener(event, record))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reporting, anonymousId])

  // Presentation windows must not appear as students.
  useEffect(() => {
    if (!teacherPresentation || !anonymousId || !session?.students?.[anonymousId]) return
    removeStudent(anonymousId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherPresentation, anonymousId, session?.students])
}
