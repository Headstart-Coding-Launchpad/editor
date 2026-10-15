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
const MAX_SYNCED_TURTLE_COMMANDS = 4000

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

export function compactTurtleResultForSync(turtleResult) {
  if (!turtleResult) return null
  const commands = Array.isArray(turtleResult.commands) ? turtleResult.commands : []
  const dropped = Math.max(0, commands.length - MAX_SYNCED_TURTLE_COMMANDS)
  const trimmed = dropped > 0 ? commands.slice(dropped) : commands
  const state = turtleResult.state
  return {
    state: state ? { ...state, x: roundCoord(state.x), y: roundCoord(state.y) } : null,
    commands: trimmed.map((command) => compactTurtleCommand(command, dropped)),
    ...(turtleResult.runId ? { runId: String(turtleResult.runId) } : {}),
  }
}
