// Sessions a tutor never ended (the tab crashed or was closed mid-lesson) stay in the Realtime
// Database: ending a session is what arms its clean-up. Each tutor tab marks itself present on
// the session (teacherPresence/{tabId}, removed on disconnect) and the disconnect stamps
// teacherLeftAt, so a session with no tutor tab for STALE_AFTER_TEACHER_LEFT_MS is stale.
// Sessions from before the marker fall back to their age.
export const STALE_AFTER_TEACHER_LEFT_MS = 2 * 60 * 60 * 1000
export const STALE_WITHOUT_MARKER_MS = 12 * 60 * 60 * 1000

/**
 * True when a waiting or active session has had no tutor for long enough to be abandoned.
 * `byAge: false` skips the age fallback (students only trust the tutor-left stamp).
 */
export function isStaleSession(session, now = Date.now(), { byAge = true } = {}) {
  if (!session || !session.state || session.state === 'ended') return false
  const present = session.teacherPresence && Object.keys(session.teacherPresence).length > 0
  if (present) return false
  if (typeof session.teacherLeftAt === 'number') {
    return now - session.teacherLeftAt > STALE_AFTER_TEACHER_LEFT_MS
  }
  return (
    byAge &&
    typeof session.createdAt === 'number' &&
    now - session.createdAt > STALE_WITHOUT_MARKER_MS
  )
}
