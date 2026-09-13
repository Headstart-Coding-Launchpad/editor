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
const MAX_SYNCED_TURTLE_COMMANDS = 4000

function roundCoord(value) {
  return Math.round(Number(value) * 10) / 10
}

function compactTurtleCommand(command) {
  if (!command || typeof command !== 'object') return command
  if (command.type === 'line' || command.type === 'stamp' || command.type === 'text') {
    const next = { ...command }
    if ('x' in next) next.x = roundCoord(next.x)
    if ('y' in next) next.y = roundCoord(next.y)
    if ('x1' in next) next.x1 = roundCoord(next.x1)
    if ('y1' in next) next.y1 = roundCoord(next.y1)
    if ('x2' in next) next.x2 = roundCoord(next.x2)
    if ('y2' in next) next.y2 = roundCoord(next.y2)
    return next
  }
  if (command.type === 'fill') {
    return {
      ...command,
      points: (command.points ?? []).map((p) => ({ x: roundCoord(p.x), y: roundCoord(p.y) })),
    }
  }
  return command
}

export function compactTurtleResultForSync(turtleResult) {
  if (!turtleResult) return null
  const commands = Array.isArray(turtleResult.commands) ? turtleResult.commands : []
  const trimmed =
    commands.length > MAX_SYNCED_TURTLE_COMMANDS
      ? commands.slice(commands.length - MAX_SYNCED_TURTLE_COMMANDS)
      : commands
  const state = turtleResult.state
  return {
    state: state ? { ...state, x: roundCoord(state.x), y: roundCoord(state.y) } : null,
    commands: trimmed.map(compactTurtleCommand),
  }
}
