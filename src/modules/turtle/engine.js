/**
 * Pure turtle-graphics state machine — no DOM, no Pyodide, no canvas.
 *
 * Matches real Python `turtle` semantics: (0, 0) is the centre of a fixed
 * logical world, y increases upward, heading is in degrees measured
 * counter-clockwise from east (0 = facing right).
 *
 * Kept separate from the Pyodide worker so it can be unit tested directly,
 * and separate from rendering so the same command log can be replayed onto
 * any canvas size (student workspace now, teacher live-view later).
 */

// Default fixed logical world size (turtle units). Not per-task configurable in
// Phase 1 — see docs/authoring/turtle.md.
export const TURTLE_LOGICAL_WIDTH = 400
export const TURTLE_LOGICAL_HEIGHT = 400

export const DEFAULT_PEN_COLOR = 'black'
export const DEFAULT_FILL_COLOR = 'black'
export const DEFAULT_BACKGROUND = '#ffffff'

const DEG2RAD = Math.PI / 180

export function createTurtleState() {
  return {
    x: 0,
    y: 0,
    heading: 0,
    penDown: true,
    color: DEFAULT_PEN_COLOR,
    fillColor: DEFAULT_FILL_COLOR,
    background: DEFAULT_BACKGROUND,
    // Whether the 🐢 marker is drawn at the turtle's position (hideturtle/showturtle).
    visible: true,
  }
}

function normalizeDegrees(degrees) {
  const wrapped = degrees % 360
  return wrapped < 0 ? wrapped + 360 : wrapped
}

function lineSegment(state, nextX, nextY) {
  if (!state.penDown) return null
  if (nextX === state.x && nextY === state.y) return null
  return { x1: state.x, y1: state.y, x2: nextX, y2: nextY, color: state.color }
}

/** distance may be negative (used by backward()). */
export function applyTurtleForward(state, distance) {
  const radians = state.heading * DEG2RAD
  const nextX = state.x + distance * Math.cos(radians)
  const nextY = state.y + distance * Math.sin(radians)
  return { nextState: { ...state, x: nextX, y: nextY }, segment: lineSegment(state, nextX, nextY) }
}

/** degrees is signed: positive turns left (counter-clockwise), negative turns right. */
export function applyTurtleTurn(state, degrees) {
  return { ...state, heading: normalizeDegrees(state.heading + degrees) }
}

export function applyTurtleSetHeading(state, degrees) {
  return { ...state, heading: normalizeDegrees(degrees) }
}

export function applyTurtleGoto(state, x, y) {
  return { nextState: { ...state, x, y }, segment: lineSegment(state, x, y) }
}

export function applyTurtleHome(state) {
  const { nextState, segment } = applyTurtleGoto(state, 0, 0)
  return { nextState: { ...nextState, heading: 0 }, segment }
}

export function applyTurtleSetFillColor(state, color) {
  return { ...state, fillColor: String(color) }
}

export function applyTurtleSetBackground(state, color) {
  return { ...state, background: String(color) }
}

export function applyTurtleSetVisible(state, visible) {
  return { ...state, visible: !!visible }
}
