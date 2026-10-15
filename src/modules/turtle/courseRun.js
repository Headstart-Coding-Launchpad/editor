/**
 * Running a Turtle task (the runtime's run, ./index.js, and the Builder's preview): a plain task
 * runs once; a course task (./course.js) runs the student's code once per map, each with a fresh
 * turtle at that map's start, one after another. The results are merged into one run result.
 *
 * - Several maps: the output gets a "── Map 2 of 3 ──" line before each map's own output.
 * - The first map's run carries `firstRunOptions` (the name-tag panel capture, slow-mo
 *   recording), so the panel and slow-mo follow map 1; later maps run plainly.
 * - A run that errors (a real Python error) ends there: later maps are 'not_run'. A crash is not
 *   an error (the program just stopped), so the next map still runs.
 * - Stop (or slow-mo's step cap) on any map makes the whole run 'stopped'.
 *
 * The merged result is the first map's result (output variables, name-tag panel, slow-mo, and
 * `turtle.state` / `commands` / `calls` for the usual Turtle checks) with:
 * - `status`: 'error' if any map's run errored, else 'success';
 * - `turtle.course`: { type, vehicle, taskId, maps: [map result] }, where a map result is the
 *   map's outcome (courseDrive.js result: goalReached, crashed, crash, pickups, pickupsTotal,
 *   moves, stopped, message) plus its run `status` and its own drawing (`commands`, `state`).
 *
 * Student-made maps (course.studentMap): when map 1's run sets the student's own map
 * (turtle.course_map), that map replaces the task's maps: the run ends there and the result has
 * one map, carrying the map text (`studentMap`). Code that doesn't set one drives every map.
 */
import { buildTurtleProgram } from './shim.js'
import { buildCourseWorld, codeCallsCourseMap, courseRunSpec, getTaskCourse } from './course.js'

export function courseMapHeading(index, count) {
  return `── Map ${index + 1} of ${count} ──\n`
}

/**
 * Runs `code` for `task`. `runPython(program, options)` is the Pyodide runner
 * (../python/pyodide.js); `getStopCount()` tells whether Stop was pressed between maps.
 */
export async function runTurtleTask(
  code,
  task,
  { runPython, getStopCount = () => 0, firstRunOptions = {}, ...callbacks } = {}
) {
  const course = getTaskCourse(task)
  if (!course) return runPython(buildTurtleProgram(code), { ...callbacks, ...firstRunOptions })
  const stops = getStopCount()
  const count = course.maps.length
  // Student-made maps: code that sets its own map runs on that one map, so map 1 gets no
  // "Map 1 of 3" heading.
  const ownMapExpected = !!course.studentMap && codeCallsCourseMap(code)
  const results = []
  for (let index = 0; index < count; index += 1) {
    if (count > 1 && !(index === 0 && ownMapExpected)) {
      callbacks.onOutput?.(courseMapHeading(index, count), 'stdout', null)
    }
    const program = buildTurtleProgram(code, { course: courseRunSpec(course, index, task?.id) })
    const result = await runPython(program, {
      ...callbacks,
      ...(index === 0 ? firstRunOptions : {}),
    })
    if (result?.status === 'stopped' || getStopCount() !== stops) {
      return { ...(results[0] ?? {}), ...result, status: 'stopped' }
    }
    results.push(result)
    // The student's own map (turtle.course_map) replaces the task's maps: one map, this run.
    const ownMap = index === 0 ? studentMapOf(course, result) : null
    if (ownMap) return mergeCourseRunResults({ ...course, maps: [ownMap] }, results, task?.id)
    if (result?.status === 'error') break
  }
  return mergeCourseRunResults(course, results, task?.id)
}

// The student's own map text from a map's run on a studentMap course, or null.
function studentMapOf(course, result) {
  if (!course.studentMap) return null
  const map = result?.turtle?.course?.studentMap
  return typeof map === 'string' && map ? map : null
}

function notRunMap(course, index) {
  const world = buildCourseWorld(course.type, course.maps[index], course.vehicle)
  return {
    index,
    status: 'not_run',
    goalReached: false,
    crashed: false,
    crash: null,
    pickups: 0,
    pickupsTotal: world.error ? 0 : world.pickups.length,
    moves: 0,
    stopped: null,
    message: null,
    commands: [],
    state: null,
  }
}

/** One run result from each map's run (see the file comment). Pure. */
export function mergeCourseRunResults(course, results, taskId = null) {
  const first = results[0] ?? { status: 'error' }
  const maps = course.maps.map((_, index) => {
    const result = results[index]
    if (!result) return notRunMap(course, index)
    const outcome = result.turtle?.course ?? {}
    return {
      ...notRunMap(course, index),
      ...outcome,
      index,
      status: result.status ?? 'success',
      commands: result.turtle?.commands ?? [],
      state: result.turtle?.state ?? null,
    }
  })
  return {
    ...first,
    status: results.some((result) => result?.status === 'error') ? 'error' : 'success',
    turtle: {
      state: first.turtle?.state ?? null,
      commands: first.turtle?.commands ?? [],
      calls: first.turtle?.calls ?? [],
      course: {
        type: course.type,
        vehicle: course.vehicle,
        ...(taskId !== null && taskId !== undefined ? { taskId: String(taskId) } : {}),
        maps,
      },
    },
  }
}

/** The course part of a run's turtle result ({ type, vehicle, taskId?, maps }), or null. */
export function readCourseResult(turtleResult) {
  const course = turtleResult?.course
  if (!course || !Array.isArray(course.maps)) return null
  return course
}

/**
 * A run's course outcome in short, for the tutor's card and the session report:
 * { maps, reached, crashed, pickups, pickupsTotal } (counts over the maps), or null.
 */
export function summarizeCourseResult(turtleResult) {
  const course = readCourseResult(turtleResult)
  if (!course || course.maps.length === 0) return null
  const maps = course.maps
  return {
    maps: maps.length,
    reached: maps.filter((map) => map?.goalReached).length,
    crashed: maps.filter((map) => map?.crashed).length,
    pickups: maps.reduce((sum, map) => sum + (Number(map?.pickups) || 0), 0),
    pickupsTotal: maps.reduce((sum, map) => sum + (Number(map?.pickupsTotal) || 0), 0),
  }
}

/**
 * The tutor card's chip for a student's last course run on `task`, or null:
 * { icon, label, title, tone: 'good' | 'bad' | 'neutral' }. "Reached goal", "Crashed" or
 * "2/3 maps".
 */
export function courseCardChip(task, turtleResult) {
  const course = readCourseResult(turtleResult)
  if (!course || !task?.course) return null
  if (course.taskId !== undefined && String(course.taskId) !== String(task.id)) return null
  const summary = summarizeCourseResult(turtleResult)
  if (!summary) return null
  const pickups =
    summary.pickupsTotal > 0 ? ` ${summary.pickups} of ${summary.pickupsTotal} pickups.` : ''
  if (summary.maps > 1) {
    const all = summary.reached === summary.maps
    return {
      icon: all ? '🏁' : summary.crashed ? '💥' : '🗺️',
      label: `${summary.reached}/${summary.maps} maps`,
      title: `Reached the goal on ${summary.reached} of ${summary.maps} maps${summary.crashed ? `, crashed on ${summary.crashed}` : ''}.${pickups}`,
      tone: all ? 'good' : summary.crashed ? 'bad' : 'neutral',
    }
  }
  if (summary.reached && !summary.crashed) {
    return { icon: '🏁', label: 'Reached goal', title: `Reached the goal.${pickups}`, tone: 'good' }
  }
  if (summary.crashed) {
    const message = course.maps[0]?.crash?.message
    return {
      icon: '💥',
      label: 'Crashed',
      title: `${message || 'Crashed into a wall.'}${pickups}`,
      tone: 'bad',
    }
  }
  return {
    icon: '🗺️',
    label: 'Not at goal',
    title: `Finished away from the goal.${pickups}`,
    tone: 'neutral',
  }
}
