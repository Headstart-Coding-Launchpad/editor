/**
 * Turtle course mode checks (./course.js): they read the course part of a run's turtle result
 * (`context.turtle.course`, see ./courseRun.js), so like every Turtle check they need a run
 * (contextKey 'turtle' is a run-only context key in ../checks.js). With several maps, each check
 * must hold on every map.
 *
 * - course_goal_reached: the vehicle ends on the goal.
 * - course_no_crash: it never hits a wall (a map that didn't run counts as a miss).
 * - course_pickups: it collects at least `min` pickups (default: all of them).
 * - course_max_moves: it uses at most `max` moves (every forward / backward / goto, every turn
 *   and every circle counts as one).
 */
export const COURSE_CHECK_TYPES = [
  'course_goal_reached',
  'course_no_crash',
  'course_pickups',
  'course_max_moves',
]

// Kid-friendly hints the Builder fills in for a new course check (authors can change them).
export const COURSE_CHECK_HINTS = {
  course_goal_reached:
    'Watch where the vehicle stops. Which move takes it off the route to the goal?',
  course_no_crash:
    'Use wall_ahead() to look before you move: only drive forward when the way is clear.',
  course_pickups: 'Some pickups are still on the map. Can your route drive over every star?',
  course_max_moves: 'It works, but it takes a lot of moves. Can a loop or a longer forward() help?',
}

function readMaps(context) {
  const maps = context?.turtle?.course?.maps
  return Array.isArray(maps) && maps.length > 0 ? maps : null
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function ran(map) {
  return map && map.status !== 'not_run'
}

export function evaluateCourseCheck(check, context = {}) {
  const maps = readMaps(context)
  if (!maps) return false

  if (check.type === 'course_goal_reached') {
    return maps.every((map) => ran(map) && !!map.goalReached)
  }

  if (check.type === 'course_no_crash') {
    return maps.every((map) => ran(map) && !map.crashed)
  }

  if (check.type === 'course_pickups') {
    const min = toNumber(check.min)
    return maps.every((map) => {
      if (!ran(map)) return false
      const total = Number(map.pickupsTotal) || 0
      const needed = min === null ? total : Math.min(min, total)
      return (Number(map.pickups) || 0) >= needed
    })
  }

  if (check.type === 'course_max_moves') {
    const max = toNumber(check.max)
    if (max === null) return false
    return maps.every((map) => ran(map) && (Number(map.moves) || 0) <= max)
  }

  return false
}

// Check-type registry definitions (see ../checkRegistry.js), registered with the Turtle ones.
export const COURSE_CHECKS = COURSE_CHECK_TYPES.map((type) => ({
  type,
  owner: 'module:turtle',
  timing: 'on_run',
  requiresRun: false,
  submitAllowed: false,
  contextKey: 'turtle',
  evaluate: (check, _output, context = {}) => evaluateCourseCheck(check, context),
  // A course check needs a Turtle task with a course to drive round.
  validate: (_check, { n, task, moduleDefinition } = {}) => {
    if (moduleDefinition && moduleDefinition.type !== 'turtle') {
      return [`Task ${n} has a ${type} check, but course checks only work in Turtle tasks`]
    }
    if (task && (task.course === undefined || task.course === null)) {
      return [`Task ${n} has a ${type} check but no course: add a course (a map to drive round)`]
    }
    return []
  },
}))
