// Show it: the tutor picks up to three students' builds and puts them side by side on the
// presentation window and on every student screen, names hidden.
//
// RTDB shape (docs/agents/runtime-model.md):
//   sessions/{lessonId}/showIt: { studentIds: [anonymousId, ...up to 3], taskId, startedAt,
//                                 view?: 'side' | 'single', index?: 0-2 }
// `view` is the tutor's choice and drives every screen: 'side' (all builds side by side) or
// 'single' (one build, full size; `index` is which). Absent = the task's default, 'single' for
// an activity whose definition says `showIt: 'single'` (a big view), otherwise 'side'.
// or absent. The builds themselves are not copied: each tile reads the student's own
// students/{id} record (currentAnswer / currentCode / currentOutput ...), so it follows the
// build as it changes. setTaskId and createSession clear the node.
//
// Pure and Node-safe.

import { getTaskActivity } from '../activities/registry.pure.js'

export const SHOW_IT_MAX = 3
export const SHOW_IT_VIEWS = ['side', 'single']

// The view a task opens in when the tutor has not chosen one: 'single' for an activity whose
// definition sets `showIt: 'single'` (its view is too large for a third of the screen).
export function defaultShowItView(task) {
  return getTaskActivity(task)?.showIt === 'single' ? 'single' : 'side'
}

// The index of the build shown in the single view, kept inside the builds that exist.
export function clampShowItIndex(index, count) {
  const n = Number.isInteger(index) ? index : 0
  return Math.max(0, Math.min(n, Math.max(0, count - 1)))
}

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

// The node as shown: { studentIds, taskId, startedAt, view, index } (view null when the tutor
// has not chosen) or null when nothing is being shown.
export function getShowIt(session) {
  const raw = session?.showIt
  if (!raw || typeof raw !== 'object') return null
  const studentIds = normalizeShowItIds(raw.studentIds)
  if (studentIds.length === 0 || raw.taskId == null || raw.taskId === '') return null
  return {
    studentIds,
    taskId: String(raw.taskId),
    startedAt: raw.startedAt ?? null,
    view: SHOW_IT_VIEWS.includes(raw.view) ? raw.view : null,
    index: Number.isInteger(raw.index) && raw.index >= 0 ? raw.index : 0,
  }
}

// "Not today" (#302, Ryan 2026-10-27): a child can say their build isn't shown to the class
// this session. students/{id}/showItOptOut: true; the node goes with the session.
export function isShowItOptedOut(student) {
  return student?.showItOptOut === true
}

// The picked students who said "not today", for the tutor's Show it button.
export function optedOutOf(students) {
  return (Array.isArray(students) ? students : []).filter(isShowItOptedOut)
}

// One tile per picked student, labelled "Build 1/2/3" by position. Students who have since
// left, or who said "not today" after being picked, are dropped; only the student record is returned for rendering, never a name or id label.
export function getShowItBuilds(session) {
  const showIt = getShowIt(session)
  if (!showIt) return []
  const builds = []
  for (const id of showIt.studentIds) {
    const student = session?.students?.[id]
    if (student && typeof student === 'object' && !isShowItOptedOut(student)) {
      builds.push({ label: `Build ${builds.length + 1}`, student: { ...student, anonymousId: id } })
    }
  }
  return builds
}
