/**
 * The checks' verdict after the student's last scrub, or null. Written with the scrub's run
 * (`lastScrubPassed`, `lastScrubAt` = that run's `lastRunAt`), so any later Run retires it.
 *
 * @param {{ lastScrubPassed?: boolean, lastScrubAt?: number, lastRunAt?: number }} student
 * @returns {boolean|null}
 */
export function scrubResultOf(student) {
  if (typeof student?.lastScrubPassed !== 'boolean') return null
  return student.lastScrubAt != null && student.lastScrubAt === student.lastRunAt
    ? student.lastScrubPassed
    : null
}
