// Attempt-log entries in the order they happened. The stored `attemptNumber` restarts at 1
// after a student reload (the de-dupe cache is per tab), so on its own it can put a later
// attempt before an earlier one. Server time (`loggedAt`) comes first; the number only breaks
// ties, and an entry with no time sorts last. Shared by the session report and the badge
// timeline so the two never disagree about which attempt was last (#242).
const timeOrInfinity = (at) => (at == null || !Number.isFinite(Number(at)) ? Infinity : Number(at))

export function compareAttemptEntries(a, b) {
  const timeA = timeOrInfinity(a?.loggedAt)
  const timeB = timeOrInfinity(b?.loggedAt)
  if (timeA !== timeB) return timeA < timeB ? -1 : 1
  return (Number(a?.attemptNumber) || 0) - (Number(b?.attemptNumber) || 0)
}
