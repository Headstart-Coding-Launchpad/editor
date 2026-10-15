// The Python Stage's synced shape: what a run's drawing looks like on the tutor's channels
// (students/{id}/currentStageResult and teacherLive.stage). Pure.
//
//   { commands: [command], count, truncated? }
//
// `count` is how many commands the run drew. Everything before the last full-stage command
// (clear() or background()) is dropped, since it can't be seen; coordinates are rounded to 0.1;
// and the list is capped (MAX_SYNCED_STAGE_COMMANDS, MAX_SYNCED_GRID_CELLS), keeping the newest
// commands and setting `truncated` when some were left out.
//
// Firebase RTDB drops empty arrays and may hand back an array as an object, so readers go
// through readStageResult.

export const MAX_SYNCED_STAGE_COMMANDS = 3000
export const MAX_SYNCED_GRID_CELLS = 40000

function round(value) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.round(number * 10) / 10 : 0
}

const ROUNDED_KEYS = [
  'x',
  'y',
  'w',
  'h',
  'r',
  'x1',
  'y1',
  'x2',
  'y2',
  'width',
  'size',
  'cell',
  'angle',
]

function compactCommand(command) {
  const next = { ...command }
  for (const key of ROUNDED_KEYS) if (key in next) next[key] = round(next[key])
  // Opacity keeps two decimals (a 0.05 fade still shows); an outline-only shape's colour is
  // null, which Firebase drops, so it is left out (readers treat a missing colour as no fill).
  if ('opacity' in next) next.opacity = Math.round(Number(next.opacity) * 100) / 100
  if (next.colour === null) delete next.colour
  if (next.type === 'grid') next.cell = Math.max(0.1, next.cell)
  return next
}

function gridCellCount(command) {
  return command?.type === 'grid'
    ? (command.cells ?? []).reduce((sum, row) => sum + (row?.length ?? 0), 0)
    : 0
}

/**
 * A run's stage result ({ commands } or a command list) in its synced shape, or null when
 * nothing was drawn.
 */
export function compactStageForSync(stage) {
  const commands = Array.isArray(stage) ? stage : stage?.commands
  if (!Array.isArray(commands) || commands.length === 0) return null
  let start = 0
  commands.forEach((command, i) => {
    if (command?.type === 'clear' || command?.type === 'background') start = i
  })
  // clear() itself draws nothing; keep a background() as the first command.
  if (commands[start]?.type === 'clear') start += 1
  const kept = []
  let cells = 0
  let truncated = false
  for (let i = commands.length - 1; i >= start; i--) {
    const command = commands[i]
    if (!command || typeof command !== 'object') continue
    const gridCells = gridCellCount(command)
    if (kept.length >= MAX_SYNCED_STAGE_COMMANDS || cells + gridCells > MAX_SYNCED_GRID_CELLS) {
      truncated = true
      break
    }
    cells += gridCells
    kept.push(compactCommand(command))
  }
  kept.reverse()
  return truncated
    ? { commands: kept, count: commands.length, truncated: true }
    : { commands: kept, count: commands.length }
}

function listOf(value) {
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort((a, b) => Number(a) - Number(b))
      .map((key) => value[key])
  }
  return []
}

function readCommand(command) {
  if (!command || typeof command !== 'object' || typeof command.type !== 'string') return null
  if (command.type !== 'grid') return command
  return {
    ...command,
    colours: listOf(command.colours),
    cells: listOf(command.cells).map((row) => listOf(row)),
  }
}

/**
 * A synced stage result (from Firebase, or as compactStageForSync made it) → { commands, count,
 * truncated }, or null when there is no drawing.
 */
export function readStageResult(raw) {
  if (!raw || typeof raw !== 'object') return null
  const commands = listOf(raw.commands).map(readCommand).filter(Boolean)
  if (commands.length === 0) return null
  return {
    commands,
    count: Number(raw.count) || commands.length,
    truncated: raw.truncated === true,
  }
}
