// Pure helpers for code_arrange's indent mode (`arrangeMode: indent`): the lines are fixed in
// their authored order and the student only sets how deep each one is indented. Python only.
//
//   task.lines   [{ id, code, depth, start?, locked? }]  `code` has no leading spaces; `depth` is
//                the correct depth (0 = no indent), so the answer is always stored (and sealed);
//                `start` is where a line begins (default 0) — a "fix the indent" task starts some
//                lines at the wrong depth; a `locked` line sits at its `depth` and can't move.
//   state        { [lineId]: depth } for movable lines the student has moved; a line missing
//                from the map is at its start depth. It travels through the same storage file,
//                live channel and teacher-edit field as the slot map of the default mode.
//
// The program is every line at its current depth (4 spaces per step), joined by newlines. Any
// arrangement is runnable, so the board is always "complete".

export const INDENT_MODE = 'indent'
export const INDENT_STEP = '    '
// The deepest a line can go. Lessons nest two or three levels; four leaves room to overshoot.
export const MAX_INDENT_DEPTH = 4

export function isIndentArrangeTask(task) {
  return task?.arrangeMode === INDENT_MODE
}

export function getLines(task) {
  return Array.isArray(task?.lines) ? task.lines : []
}

function isDepth(value) {
  return Number.isInteger(value) && value >= 0 && value <= MAX_INDENT_DEPTH
}

function clampDepth(value) {
  const n = Math.trunc(Number(value))
  if (!Number.isFinite(n)) return 0
  return Math.min(Math.max(n, 0), MAX_INDENT_DEPTH)
}

export function isMovableLine(line) {
  return !!line?.id && line.locked !== true
}

// The movable lines' ids, in order.
export function getMovableLineIds(task) {
  return getLines(task)
    .filter(isMovableLine)
    .map((line) => line.id)
}

// Where a line begins before the student moves it.
export function getStartDepth(line) {
  if (line?.locked === true) return clampDepth(line.depth)
  return line?.start == null ? 0 : clampDepth(line.start)
}

// A line's depth on the board right now.
export function getLineDepth(line, state) {
  if (line?.locked === true) return clampDepth(line.depth)
  const value = state && typeof state === 'object' ? state[line?.id] : undefined
  return isDepth(value) ? value : getStartDepth(line)
}

// Keeps only real moves: a movable line of this task holding a whole depth in range.
export function pruneIndentState(task, state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return {}
  const movable = new Set(getMovableLineIds(task))
  return Object.fromEntries(
    Object.entries(state).filter(([id, depth]) => movable.has(id) && isDepth(depth))
  )
}

// A copy of the state with one line set to a depth (clamped to 0..MAX_INDENT_DEPTH).
export function setLineDepth(state, lineId, depth) {
  return { ...(state && typeof state === 'object' ? state : {}), [lineId]: clampDepth(depth) }
}

export function assembleIndentArrangement(task, state) {
  const lines = getLines(task)
  if (lines.length === 0) return null
  return lines
    .map((line) => INDENT_STEP.repeat(getLineDepth(line, state)) + String(line?.code ?? '').trim())
    .join('\n')
}

// Every movable line at its authored depth.
export function buildIndentSolutionState(task) {
  return Object.fromEntries(
    getLines(task)
      .filter(isMovableLine)
      .map((line) => [line.id, clampDepth(line.depth)])
  )
}

export function isIndentArrangementCorrect(task, state) {
  const lines = getLines(task)
  return (
    lines.length > 0 && lines.every((line) => getLineDepth(line, state) === clampDepth(line.depth))
  )
}

// How many movable lines sit somewhere other than where they started: the card's progress.
export function countMovedLines(task, state) {
  return getLines(task)
    .filter(isMovableLine)
    .filter((line) => getLineDepth(line, state) !== getStartDepth(line)).length
}

// The inverse of assembleIndentArrangement(), for a teacher viewing a student from the streamed
// code: each code line must be its authored line's code after whole indent steps. Anything else
// (a different line count, a changed line, a partial step) gives an empty map, which shows the
// start depths: a best-effort picture, as in the default mode.
export function deriveIndentStateFromCode(task, code) {
  const lines = getLines(task)
  if (lines.length === 0 || typeof code !== 'string') return {}
  const codeLines = code.split('\n')
  if (codeLines.length !== lines.length) return {}
  const state = {}
  for (let i = 0; i < lines.length; i++) {
    const text = codeLines[i]
    const body = text.trimStart()
    const spaces = text.length - body.length
    if (body !== String(lines[i]?.code ?? '').trim() || spaces % INDENT_STEP.length !== 0) return {}
    const depth = spaces / INDENT_STEP.length
    if (!isDepth(depth)) return {}
    if (isMovableLine(lines[i])) state[lines[i].id] = depth
  }
  return state
}
