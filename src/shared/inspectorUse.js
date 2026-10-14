// HTML Inspector use for the session report. Pure.
//
// The student's client writes `sessions/{lessonId}/students/{id}/inspectorLog/{taskId}`
// `{ opens, selects, lastAt }` (src/app/hooks/useHtmlInspectorLive.js): how many times they turned
// inspect mode on and chose an element on that task. The report shows it per student per task.

export const INSPECTOR_USE_KINDS = Object.freeze(['open', 'select'])

function count(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

/**
 * The report's per-student `inspector` block for one task — `{ used: true, opens, selects }` —
 * or null when the student never used the Inspector there.
 */
export function inspectorReportFields(raw) {
  if (!raw || typeof raw !== 'object') return null
  const opens = count(raw.opens)
  const selects = count(raw.selects)
  if (opens === 0 && selects === 0) return null
  return { used: true, opens, selects }
}

/** The task summary's `inspectorUsedCount`: students who used the Inspector, or {} for none. */
export function summarizeInspectorUse(perStudent) {
  const used = (perStudent ?? []).filter((task) => task?.inspector?.used).length
  return used > 0 ? { inspectorUsedCount: used } : {}
}
