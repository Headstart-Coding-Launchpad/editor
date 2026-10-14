// Scrub use for the session report. Pure.
//
// The student's client writes `sessions/{lessonId}/students/{id}/scrubLog/{taskId}`
// `{ numbers, colours, lastAt }` (src/app/hooks/useScrubLog.js): how many times they changed a
// number (a drag or the slider) and a colour (the picker) by scrubbing on that task (a task's
// `scrub`, src/shared/scrub/). A scrub that ends where it started is not counted. The report
// shows it per student per task, so authors can see whether Modify tasks are used. Counts only,
// never code.

export const SCRUB_USE_KINDS = Object.freeze(['number', 'colour'])

function count(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

/**
 * The report's per-student scrub fields for one task — `{ scrubs, scrubNumbers, scrubColours }`
 * (scrubs is the total) — or `{}` when the student never scrubbed there.
 */
export function scrubReportFields(raw) {
  if (!raw || typeof raw !== 'object') return {}
  const numbers = count(raw.numbers)
  const colours = count(raw.colours)
  if (numbers === 0 && colours === 0) return {}
  return { scrubs: numbers + colours, scrubNumbers: numbers, scrubColours: colours }
}

/** The task summary's `scrubUsedCount`: students who scrubbed, or {} for none. */
export function summarizeScrubUse(perStudent) {
  const used = (perStudent ?? []).filter((task) => task?.scrubs > 0).length
  return used > 0 ? { scrubUsedCount: used } : {}
}
