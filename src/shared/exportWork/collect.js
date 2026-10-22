// Gathers what "Export work" exports for one student, live only (StudentModal during the
// session), from what the tutor already has: the current task's live mirror (currentCode,
// currentFiles, currentTurtleResult, currentSpriteState) and each task's latest logged
// submission (`attemptLog`). Nothing is read from or written to the student's device.
//
// Each module says how to read its own work through its exporter (the optional `exportWork`
// UI hook; see ./exporters.js), so this file never compares lesson types.
import { realAttemptEntries } from '../autoCheck.js'
import { encodeFileKey } from '../fileKeys.js'
import { getEffectiveLessonForTask } from '../composedLesson.js'
import { deriveTaskContext, flattenTasks } from '../taskUtils.js'

function attemptTime(entry) {
  return typeof entry?.loggedAt === 'number' ? entry.loggedAt : 0
}

/**
 * The student's latest logged work on a task, or null: the newest attempt by loggedAt (then
 * attemptNumber). An auto-check on leave (src/shared/autoCheck.js) is not an attempt, but it
 * does hold the work as it stood when the class moved on, so it counts here unless
 * `realOnly` is set.
 */
export function latestSubmission(session, anonymousId, taskId, { realOnly = false } = {}) {
  const all = Object.values(session?.attemptLog?.[anonymousId]?.[taskId] ?? {})
  const entries = (realOnly ? realAttemptEntries(all) : all).filter(
    (entry) => entry?.submission != null && entry.submission !== ''
  )
  if (!entries.length) return null
  return entries.reduce((best, entry) => {
    const diff = attemptTime(entry) - attemptTime(best)
    if (diff > 0) return entry
    if (diff === 0 && (entry.attemptNumber ?? 0) >= (best.attemptNumber ?? 0)) return entry
    return best
  })
}

/** The student's latest Run on a task ({ code, at }, students/{id}/lastRuns), or null. */
export function latestRun(student, taskId) {
  const entry = student?.lastRuns?.[encodeFileKey(String(taskId))]
  if (typeof entry?.code !== 'string' || !entry.code) return null
  return { code: entry.code, at: typeof entry.at === 'number' ? entry.at : 0 }
}

/**
 * The tasks an export can cover, in lesson order: code tasks whose module has an exporter,
 * with groups expanded to their subtasks. `hasExporter(type)` answers from the module registry.
 */
export function exportableTasks(lesson, session, hasExporter) {
  return flattenTasks(lesson?.tasks ?? [])
    .map((task) => {
      const taskLesson = getEffectiveLessonForTask(lesson, task)
      // The task's own context, not the session sandbox's: a sandbox parks on a task.
      const { moduleType, isQuiz, isInformation } = deriveTaskContext(taskLesson, task, {
        state: 'active',
      })
      if (!moduleType || isQuiz || isInformation || !hasExporter(moduleType)) return null
      return { task, taskLesson, moduleType }
    })
    .filter(Boolean)
}

/**
 * The work to export for each candidate task, using `getExporter(type)` (a loaded exporter).
 * The current task uses the live mirror first and falls back to its latest submission; other
 * tasks use their latest submission. Tasks with nothing to export are left out.
 * Returns [{ task, taskLesson, moduleType, exporter, work, source: 'live' | 'submission' }].
 */
export function collectExportItems({ candidates, session, student, getExporter }) {
  const currentTaskId = session?.currentTaskId
  const items = []
  for (const candidate of candidates ?? []) {
    const exporter = getExporter(candidate.moduleType)
    if (!exporter) continue
    const { task } = candidate
    let work = null
    let source = null
    if (currentTaskId != null && String(task.id) === String(currentTaskId)) {
      work = exporter.readLive?.(student, task) ?? null
      if (work) source = 'live'
    }
    if (!work) {
      // The newer of the latest logged attempt and the latest Run (lastRuns): attempts stop at
      // the pass and are never logged on a task without a check (a Take it further, say).
      const attempt = latestSubmission(session, student?.anonymousId, task.id)
      const lastRun = latestRun(student, task.id)
      const useRun = lastRun && (!attempt || lastRun.at > attemptTime(attempt))
      const code = useRun ? lastRun.code : attempt?.submission
      work = code != null ? (exporter.readSubmission?.(code, task) ?? null) : null
      if (work) source = 'submission'
    }
    if (work) items.push({ ...candidate, exporter, work, source })
  }
  return items
}
