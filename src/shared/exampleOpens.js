// "See example" opens (Markdown example fences, src/shared/markdown/exampleFence.js): which
// students opened a task explainer's worked example, and when. Pure and Node-safe.
//
//   sessions/L/exampleOpenLog/{id}/{taskId}/{index}   { openedAt, lastOpenedAt, opens }
//
// The student writes their own entries (useSession.recordExampleOpen) in a live lesson only;
// `index` is the example's place in the explainer (0-9). The tutor's card and student modal
// show "opened example" (exampleOpenCount), and buildSessionReport records each student's opens
// per task (exampleOpenReportFields). Status only: nothing the student typed is stored.

/** The node path for one example's entry. */
export function exampleOpenPath(lessonId, anonymousId, taskId, index) {
  return `sessions/${lessonId}/exampleOpenLog/${anonymousId}/${taskId}/${index}`
}

/** A raw `opens` count bumped by one (a runTransaction updater). */
export function bumpExampleOpenCount(current) {
  return (Number.isFinite(current) && current > 0 ? current : 0) + 1
}

/**
 * One student's opens on one task, from `exampleOpenLog/{id}/{taskId}`, as a sorted list of
 * `{ example, openedAt, lastOpenedAt, opens }` (`example` counts from 1). Entries with no
 * `openedAt` are dropped.
 */
export function normalizeExampleOpens(raw) {
  if (!raw || typeof raw !== 'object') return []
  return Object.entries(raw)
    .map(([key, entry]) => {
      const index = Number(key)
      if (!Number.isInteger(index) || index < 0 || !entry || typeof entry !== 'object') return null
      if (typeof entry.openedAt !== 'number') return null
      const opens = Number.isFinite(entry.opens) && entry.opens > 0 ? entry.opens : 1
      return {
        example: index + 1,
        openedAt: entry.openedAt,
        ...(typeof entry.lastOpenedAt === 'number' && entry.lastOpenedAt !== entry.openedAt
          ? { lastOpenedAt: entry.lastOpenedAt }
          : {}),
        opens,
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.example - b.example)
}

/** How many of a task's examples this student has opened (0 when none, or no log). */
export function exampleOpenCount(session, anonymousId, taskId) {
  if (!anonymousId || taskId == null) return 0
  return normalizeExampleOpens(session?.exampleOpenLog?.[anonymousId]?.[taskId]).length
}

/** The anonymous ids with any example open, for the report's student list. */
export function exampleOpenStudentIds(session) {
  return Object.keys(session?.exampleOpenLog ?? {})
}

/**
 * The session report's per-student task field: `{ exampleOpens: [{ example, openedAt,
 * afterMs?, lastOpenedAt?, opens }] }`, or `{}` when the student opened none. `afterMs` is the
 * time from the task starting for the class (`taskStartTimes[taskId]`) to the first open.
 */
export function exampleOpenReportFields(session, anonymousId, taskId) {
  const opens = normalizeExampleOpens(session?.exampleOpenLog?.[anonymousId]?.[taskId])
  if (opens.length === 0) return {}
  const startedAt = session?.taskStartTimes?.[taskId]
  return {
    exampleOpens: opens.map((entry) =>
      typeof startedAt === 'number'
        ? { ...entry, afterMs: Math.max(0, entry.openedAt - startedAt) }
        : entry
    ),
  }
}

/** The task summary field: how many students opened an example, or `{}` when nobody did. */
export function summarizeExampleOpens(perStudentTasks) {
  const count = perStudentTasks.filter((task) => (task?.exampleOpens ?? []).length > 0).length
  return count > 0 ? { exampleOpenStudentCount: count } : {}
}
