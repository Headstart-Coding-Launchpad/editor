// Shared by both places a turtle run result gets synced live to a teacher:
// - useTeacherLivePublish.js (the "Go Live" broadcast channel, sessions/{id}/teacherLive)
// - useSession.js's writeStudentTurtleResult (the per-student channel StudentModal reads
//   for a teacher inspecting one student, sessions/{id}/students/{anonymousId})
//
// Turtle command logs have no natural upper bound (circle() alone can emit dozens of
// line segments per call), and neither existing sync channel has a size guard for any
// module. Round coordinates (visually lossless at any sane canvas size) and cap to the
// most recent N commands so a pathological drawing can't blow up the synced payload;
// drop the raw call log entirely since only student-side checks need it, never a
// read-only teacher canvas.
//
// The log includes the motion between drawn items (move, turn, speed, visible; see
// recorder.js) so a Go Live screen can play the presenter's drawing; `runId` says which Run
// it came from (useTurtlePlayback.js plays a new one).
//
// A course run (./course.js, ./courseRun.js) also carries `course`: each map's outcome and its own
// drawing, so a Go Live screen and the tutor's views can show every map. The course's own
// geometry is never sent: every screen rebuilds it from the task, or, for a student-made map
// (turtle.course_map, P6-16), from the map's text (`studentMap`, at most 30 × 30 characters).
const MAX_SYNCED_TURTLE_COMMANDS = 4000
// A 30 × 30 map is 929 characters; anything longer can't be a usable map, so it isn't sent.
const MAX_SYNCED_STUDENT_MAP = 1000

const COORD_KEYS = ['x', 'y', 'x1', 'y1', 'x2', 'y2', 'heading', 'from', 'delta', 'size', 'width']

function roundCoord(value) {
  return Math.round(Number(value) * 10) / 10
}

function compactTurtleCommand(command, dropped) {
  if (!command || typeof command !== 'object') return command
  if (command.type === 'fill') {
    const next = {
      ...command,
      points: (command.points ?? []).map((p) => ({ x: roundCoord(p.x), y: roundCoord(p.y) })),
    }
    // closedAt counts records from the start of the log: shift it when the start was cut.
    if (Number.isFinite(command.closedAt)) next.closedAt = Math.max(0, command.closedAt - dropped)
    return next
  }
  const next = { ...command }
  for (const key of COORD_KEYS) {
    if (key in next && Number.isFinite(Number(next[key]))) next[key] = roundCoord(next[key])
  }
  return next
}

function compactCommands(list, cap) {
  const commands = Array.isArray(list) ? list : []
  const dropped = Math.max(0, commands.length - cap)
  const trimmed = dropped > 0 ? commands.slice(dropped) : commands
  return trimmed.map((command) => compactTurtleCommand(command, dropped))
}

function compactState(state) {
  return state ? { ...state, x: roundCoord(state.x), y: roundCoord(state.y) } : null
}

function count(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

// The course part: outcomes and drawings per map, each map's drawing capped to its share.
function compactCourse(course) {
  if (!course || !Array.isArray(course.maps)) return null
  const cap = Math.max(
    200,
    Math.floor(MAX_SYNCED_TURTLE_COMMANDS / Math.max(1, course.maps.length))
  )
  return {
    type: String(course.type ?? ''),
    vehicle: String(course.vehicle ?? 'turtle'),
    ...(course.taskId !== undefined && course.taskId !== null
      ? { taskId: String(course.taskId) }
      : {}),
    maps: course.maps.map((map, index) => ({
      index,
      status: String(map?.status ?? 'success'),
      goalReached: !!map?.goalReached,
      crashed: !!map?.crashed,
      crash: map?.crash
        ? {
            message: String(map.crash.message ?? ''),
            x: roundCoord(map.crash.x),
            y: roundCoord(map.crash.y),
          }
        : null,
      pickups: count(map?.pickups),
      pickupsTotal: count(map?.pickupsTotal),
      moves: count(map?.moves),
      stopped: map?.stopped ? String(map.stopped) : null,
      message: map?.message ? String(map.message) : null,
      commands: compactCommands(map?.commands, cap),
      state: compactState(map?.state),
      ...(typeof map?.studentMap === 'string' &&
      map.studentMap &&
      map.studentMap.length <= MAX_SYNCED_STUDENT_MAP
        ? { studentMap: map.studentMap }
        : {}),
    })),
  }
}

export function compactTurtleResultForSync(turtleResult) {
  if (!turtleResult) return null
  const course = compactCourse(turtleResult.course)
  return {
    state: compactState(turtleResult.state),
    commands: compactCommands(turtleResult.commands, MAX_SYNCED_TURTLE_COMMANDS),
    ...(turtleResult.runId ? { runId: String(turtleResult.runId) } : {}),
    ...(course ? { course } : {}),
  }
}
