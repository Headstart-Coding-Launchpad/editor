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
