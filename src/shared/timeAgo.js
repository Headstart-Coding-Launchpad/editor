// Short relative-time label for timestamps the teacher or a student sees at a
// glance ("Just now", "4m ago"). Shared so the student grid and the shared-work
// gallery read the same way rather than each rounding differently.
export function formatTimeAgo(ts, now = Date.now()) {
  if (!ts) return null
  const secs = Math.floor((now - ts) / 1000)
  if (secs < 10) return 'Just now'
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  return `${hrs}h ago`
}

// A clock reading for a number of seconds: "2:05", or "1:02:05" past an hour. Used by the
// teacher's timers, the class countdown and the Admin sessions list.
export function formatClock(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainder = seconds % 60
  if (hours) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
  }
  return `${minutes}:${String(remainder).padStart(2, '0')}`
}
