// Scrub use for the session report. Pure.
//
// The student's client writes `sessions/{lessonId}/students/{id}/scrubLog/{taskId}`
// `{ numbers, colours, booleans, lastAt }` (src/app/hooks/useScrubLog.js): how many times they
// changed a number (a drag or the slider), a colour (the picker) and a True / False (a click) by
// scrubbing on that task (a task's
// `scrub`, src/shared/scrub/). A scrub that ends where it started is not counted. The report
// shows it per student per task, so authors can see whether Modify tasks are used. Counts only,
// never code.

import { isFailedScrubAttempt } from '../autoCheck.js'

export const SCRUB_USE_KINDS = Object.freeze(['number', 'colour', 'boolean'])

function count(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

/**
 * The report's per-student scrub fields for one task — `{ scrubs, scrubNumbers, scrubColours,
 * scrubBooleans? }` (scrubs is the total; scrubBooleans only when there were flips) — or `{}`
 * when the student never scrubbed there.
 */
export function scrubReportFields(raw) {
  if (!raw || typeof raw !== 'object') return {}
  const numbers = count(raw.numbers)
  const colours = count(raw.colours)
  const booleans = count(raw.booleans)
  if (numbers === 0 && colours === 0 && booleans === 0) return {}
  return {
    scrubs: numbers + colours + booleans,
    scrubNumbers: numbers,
    scrubColours: colours,
    ...(booleans > 0 ? { scrubBooleans: booleans } : {}),
  }
}

/** The task summary's `scrubUsedCount`: students who scrubbed, or {} for none. */
export function summarizeScrubUse(perStudent) {
  const used = (perStudent ?? []).filter((task) => task?.scrubs > 0).length
  return used > 0 ? { scrubUsedCount: used } : {}
}

/**
 * The per-student `scrubChecks` for one task: how many live-scrub releases failed their checks
 * (attemptLog entries with `source: 'scrub'` that did not pass, each counting its retries).
 * They are not attempts, so `attempts`, `retries` and the common failures leave them out; the
 * entries stay in `distinctAttempts`. `{}` when there were none.
 */
export function scrubCheckFields(entries) {
  let total = 0
  for (const entry of entries ?? []) {
    if (isFailedScrubAttempt(entry)) total += 1 + count(entry.retries)
  }
  return total > 0 ? { scrubChecks: total } : {}
}

/** The task summary's `scrubChecks`: failed scrub releases across students, or {} for none. */
export function summarizeScrubChecks(perStudent) {
  const total = (perStudent ?? []).reduce((sum, task) => sum + count(task?.scrubChecks), 0)
  return total > 0 ? { scrubChecks: total } : {}
}
