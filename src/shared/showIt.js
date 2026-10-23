// Show it: the tutor picks up to three students' builds and puts them side by side on the
// presentation window and on every student screen, names hidden.
//
// RTDB shape (docs/agents/runtime-model.md):
//   sessions/{lessonId}/showIt: { studentIds: [anonymousId, ...up to 3], taskId, startedAt }
// or absent. The builds themselves are not copied: each tile reads the student's own
// students/{id} record (currentAnswer / currentCode / currentOutput ...), so it follows the
// build as it changes. setTaskId and createSession clear the node.
//
// Pure and Node-safe.

export const SHOW_IT_MAX = 3

// A short reason the Show it action is unavailable, or null when it can run.
export function showItDisabledReason(studentCount) {
  return studentCount > 0 ? null : 'No students yet'
}

// The ids as stored: unique strings, in order, at most SHOW_IT_MAX.
export function normalizeShowItIds(ids) {
  const seen = new Set()
  const out = []
  for (const id of Array.isArray(ids) ? ids : []) {
    if (typeof id !== 'string' || !id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
    if (out.length === SHOW_IT_MAX) break
  }
  return out
}

// The node as shown: { studentIds, taskId, startedAt } or null when nothing is being shown.
export function getShowIt(session) {
  const raw = session?.showIt
  if (!raw || typeof raw !== 'object') return null
  const studentIds = normalizeShowItIds(raw.studentIds)
  if (studentIds.length === 0 || raw.taskId == null || raw.taskId === '') return null
  return { studentIds, taskId: String(raw.taskId), startedAt: raw.startedAt ?? null }
}

// One tile per picked student, labelled "Build 1/2/3" by position. Students who have since
// left are dropped; only the student record is returned for rendering, never a name or id label.
export function getShowItBuilds(session) {
  const showIt = getShowIt(session)
  if (!showIt) return []
  const builds = []
  for (const id of showIt.studentIds) {
    const student = session?.students?.[id]
    if (student && typeof student === 'object') {
      builds.push({ label: `Build ${builds.length + 1}`, student: { ...student, anonymousId: id } })
    }
  }
  return builds
}
