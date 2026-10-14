// Slow-mo use for the session report. Pure.
//
// The student's client writes `sessions/{lessonId}/students/{id}/slowMoLog/{taskId}`
// `{ runs, steps, lastAt }` (src/app/hooks/useSlowMoLog.js): how many slow-mo runs they started
// and how many times they pressed Step on that task (Scratch slow-mo, task.slowMo). The report
// shows it per student per task. Counts only, never code.

export const SLOW_MO_USE_KINDS = Object.freeze(['run', 'step'])

function count(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

/**
 * The report's per-student slow-mo fields for one task —
 * `{ slowMoUsed: true, slowMoRuns, slowMoSteps }` — or `{}` when the student never used it there.
 */
export function slowMoReportFields(raw) {
  if (!raw || typeof raw !== 'object') return {}
  const runs = count(raw.runs)
  const steps = count(raw.steps)
  if (runs === 0 && steps === 0) return {}
  return { slowMoUsed: true, slowMoRuns: runs, slowMoSteps: steps }
}

/** The task summary's `slowMoUsedCount`: students who used slow-mo, or {} for none. */
export function summarizeSlowMoUse(perStudent) {
  const used = (perStudent ?? []).filter((task) => task?.slowMoUsed).length
  return used > 0 ? { slowMoUsedCount: used } : {}
}
