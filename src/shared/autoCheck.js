// Auto-checked attempts: attemptLog entries the student's own tab writes without the student
// pressing Run or Submit. Today there is one kind, `auto: 'leave'`: when the teacher moves a live
// class on and the student never passed the graded task, their current work is graded without a
// run (checks.js evaluateTaskWithoutRun) and logged with the verdict in `autoResult`.
//
// A leave attempt is a record of where the student got to, not an attempt: it is stored with
// `passed: false` (so a reader that does not know the flag never counts it as a pass) and every
// reader of attemptLog that counts attempts, retries, errors or passes (the report, the live
// badge timeline, the teacher's override and reveal records) skips it with isAutoAttempt. Pure
// and Node-safe.

export const AUTO_CHECK_LEAVE = 'leave'

// The verdicts a leave attempt carries in `autoResult` (checks.js NO_RUN_RESULTS).
export const AUTO_CHECK_RESULTS = Object.freeze(['passed', 'failed', 'not_run'])

/** Whether an attemptLog entry was written by an auto-check rather than a Run or Submit. */
export function isAutoAttempt(entry) {
  return !!entry && typeof entry === 'object' && entry.auto != null
}

/** Whether an attemptLog entry is an auto-check-on-leave record. */
export function isLeaveAttempt(entry) {
  return isAutoAttempt(entry) && entry.auto === AUTO_CHECK_LEAVE
}

/** The entries a student actually ran or submitted. */
export function realAttemptEntries(entries) {
  return (entries ?? []).filter((entry) => !isAutoAttempt(entry))
}

/** The most recent leave attempt (by loggedAt, then list order), or null. */
export function latestLeaveAttempt(entries) {
  let latest = null
  for (const entry of entries ?? []) {
    if (!isLeaveAttempt(entry)) continue
    const at = typeof entry.loggedAt === 'number' ? entry.loggedAt : -Infinity
    const latestAt = latest && typeof latest.loggedAt === 'number' ? latest.loggedAt : -Infinity
    if (!latest || at >= latestAt) latest = entry
  }
  return latest
}

/** A leave attempt's verdict; anything unrecognised reads as 'not_run'. */
export function leaveAttemptResult(entry) {
  return AUTO_CHECK_RESULTS.includes(entry?.autoResult) ? entry.autoResult : 'not_run'
}
