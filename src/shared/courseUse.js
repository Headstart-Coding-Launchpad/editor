// Turtle course mode (src/modules/turtle/course.js) in the session report. Pure.
//
// The student's client writes `sessions/{lessonId}/students/{id}/courseLog/{taskId}`
// `{ runs, goalRuns, crashes, pickups, lastGoalReached, lastAt }` on each Run of a course task
// (src/app/hooks/useCourseLog.js): how many runs, how many reached the goal (on every map), how
// many crashes (maps crashed, over all runs), and the last run's pickups and goal. Counts only,
// never code.

function count(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

/**
 * One run's entry from its turtle result's course part ({ maps }, src/modules/turtle/courseRun.js):
 * { goal (every map), crashes (maps crashed), pickups (collected over the maps) }, or null.
 */
export function courseLogEntry(course) {
  const maps = Array.isArray(course?.maps) ? course.maps : null
  if (!maps || maps.length === 0) return null
  return {
    goal: maps.every((map) => !!map?.goalReached),
    crashes: maps.filter((map) => map?.crashed).length,
    pickups: maps.reduce((sum, map) => sum + count(map?.pickups), 0),
  }
}

/**
 * The report's per-student course fields for one task —
 * `{ course: { runs, goalReached, goalRuns, crashes, pickups, lastGoalReached } }` — or `{}` when
 * the student never ran it. `goalReached`: on any run; `pickups`: the last run's.
 */
export function courseReportFields(raw) {
  if (!raw || typeof raw !== 'object') return {}
  const runs = count(raw.runs)
  if (runs === 0) return {}
  const goalRuns = count(raw.goalRuns)
  return {
    course: {
      runs,
      goalReached: goalRuns > 0,
      goalRuns,
      crashes: count(raw.crashes),
      pickups: count(raw.pickups),
      lastGoalReached: raw.lastGoalReached === true,
    },
  }
}

/** The task summary's `courseGoalReachedCount` / `courseCrashedCount`, or {} for no course runs. */
export function summarizeCourseUse(perStudent) {
  const ran = (perStudent ?? []).filter((task) => task?.course)
  if (ran.length === 0) return {}
  return {
    courseGoalReachedCount: ran.filter((task) => task.course.goalReached).length,
    courseCrashedCount: ran.filter((task) => task.course.crashes > 0).length,
  }
}
