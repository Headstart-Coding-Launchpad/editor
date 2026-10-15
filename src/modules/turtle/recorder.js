/**
 * The Turtle run recorder: what the Pyodide worker's __hsTurtle* bridge functions do (see
 * ../python/pyodide.worker.js and ./shim.js). Pure JS, no Pyodide, so it can be unit tested.
 *
 * It keeps three things for a run:
 * - `state`: where the turtle is now (./engine.js createTurtleState).
 * - `commands`: the drawing, in the order the code ran it. Drawn items are
 *   `line` { x1, y1, x2, y2, color, width, heading }, `fill` { points, color, closedAt },
 *   `dot` { x, y, size, color }, `stamp` and `text`. The motion between them is recorded too,
 *   so the drawing can be played back (./playback.js): `move` (a pen-up move, same fields as a
 *   line without colour or width), `turn` { from, delta, instant? }, `speed` { speed } and
 *   `visible` { visible }. Renderers skip the motion records.
 * - `calls`: every command the code called, { name, args }, for turtle_command_used checks.
 *
 * Fills: begin_fill() puts a `fill` record in the log straight away, before the shape's outline,
 * so the outline is drawn on top of its own fill and anything drawn later covers both (real
 * turtle's order). The record has no points until end_fill() closes the shape and sets
 * `closedAt` (the log length then): a renderer drawing only the first N records (slow-mo,
 * playback) shows the fill only once N >= closedAt.
 *
 * reset()/clear() swap in a new commands array (slow-mo watches for that: a new epoch).
 */
import {
  createTurtleState,
  applyTurtleForward,
  applyTurtleTurn,
  applyTurtleSetHeading,
  applyTurtleGoto,
  applyTurtleSetFillColor,
  applyTurtleSetBackground,
  applyTurtleSetVisible,
} from './engine.js'

/** Real turtle's dot() size when none is given: max(pensize + 4, 2 * pensize). */
export function defaultDotSize(pensize) {
  const size = Number(pensize) > 0 ? Number(pensize) : 1
  return Math.max(size + 4, size * 2)
}

/** The signed shortest turn from one heading to another, like real turtle's setheading(). */
export function shortestTurn(from, to) {
  let delta = (((Number(to) - Number(from)) % 360) + 360) % 360
  if (delta > 180) delta -= 360
  return delta
}

export function createTurtleRecorder() {
  let state = createTurtleState()
  let commands = []
  const calls = []
  // The open begin_fill(): { command, points }, or null.
  let fill = null

  function call(name, args = []) {
    calls.push({ name, args })
  }

  // A move to (x, y) at the current heading: a line when the pen is down, else a `move`.
  function travel(nextState) {
    const moved = nextState.x !== state.x || nextState.y !== state.y
    if (moved) {
      const base = {
        x1: state.x,
        y1: state.y,
        x2: nextState.x,
        y2: nextState.y,
        heading: state.heading,
      }
      commands.push(
        state.penDown
          ? { type: 'line', ...base, color: state.color, width: state.pensize }
          : { type: 'move', ...base }
      )
    }
    state = nextState
    if (fill) fill.points.push({ x: state.x, y: state.y })
  }

  function turnTo(nextHeading, delta, instant = false) {
    if (delta !== 0) {
      commands.push({
        type: 'turn',
        from: state.heading,
        delta,
        ...(instant ? { instant: true } : {}),
      })
    }
    state = { ...state, heading: nextHeading }
  }

  return {
    get state() {
      return state
    },
    get commands() {
      return commands
    },
    get calls() {
      return calls
    },

    forward(distance) {
      call('forward', [distance])
      travel(applyTurtleForward(state, Number(distance) || 0).nextState)
    },
    /** Positive turns left. `instant` (circle()'s own turns) plays with no delay, as in real turtle. */
    turn(degrees, instant = false) {
      call('turn', [degrees])
      const delta = Number(degrees) || 0
      turnTo(applyTurtleTurn(state, delta).heading, delta, instant)
    },
    goto(x, y) {
      call('goto', [x, y])
      travel(applyTurtleGoto(state, Number(x), Number(y)).nextState)
    },
    setHeading(degrees) {
      call('setheading', [degrees])
      const next = applyTurtleSetHeading(state, Number(degrees) || 0).heading
      turnTo(next, shortestTurn(state.heading, next))
    },
    home() {
      call('home', [])
      travel(applyTurtleGoto(state, 0, 0).nextState)
      turnTo(0, shortestTurn(state.heading, 0))
    },
    reset() {
      call('reset', [])
      state = createTurtleState()
      commands = []
      fill = null
    },
    penUp() {
      call('penup', [])
      state = { ...state, penDown: false }
    },
    penDown() {
      call('pendown', [])
      state = { ...state, penDown: true }
    },
    setColor(color) {
      call('pencolor', [color])
      state = { ...state, color: String(color) }
    },
    setFillColor(color) {
      call('fillcolor', [color])
      state = applyTurtleSetFillColor(state, color)
    },
    setBackground(color) {
      call('bgcolor', [color])
      state = applyTurtleSetBackground(state, color)
    },
    setVisible(visible) {
      call(visible ? 'showturtle' : 'hideturtle', [])
      if (!!visible !== state.visible) commands.push({ type: 'visible', visible: !!visible })
      state = applyTurtleSetVisible(state, visible)
    },
    setPensize(width) {
      const size = Math.max(0, Number(width) || 0)
      call('pensize', [size])
      state = { ...state, pensize: size }
    },
    /** `value` is already a real-turtle speed number, 0–10 (the shim maps names and ranges). */
    setSpeed(value) {
      const speed = Math.max(0, Math.min(10, Math.round(Number(value) || 0)))
      call('speed', [speed])
      commands.push({ type: 'speed', speed })
      state = { ...state, speed }
    },
    beginFill() {
      call('beginfill', [])
      const command = { type: 'fill', points: [], color: state.fillColor, closedAt: null }
      commands.push(command)
      fill = { command, points: [{ x: state.x, y: state.y }] }
    },
    endFill() {
      call('endfill', [])
      if (fill && fill.points.length >= 3) {
        fill.command.points = fill.points
        fill.command.color = state.fillColor
        fill.command.closedAt = commands.length
      }
      fill = null
    },
    stamp() {
      call('stamp', [])
      commands.push({
        type: 'stamp',
        x: state.x,
        y: state.y,
        heading: state.heading,
        color: state.color,
      })
    },
    write(text, align, fontSize) {
      call('write', [text])
      commands.push({
        type: 'text',
        x: state.x,
        y: state.y,
        text: String(text),
        color: state.color,
        align: String(align),
        fontSize: Number(fontSize) || 8,
      })
    },
    /** `size` null = real turtle's default; `color` null = the pen colour. */
    dot(size = null, color = null) {
      const hasSize = size !== null && size !== undefined && Number.isFinite(Number(size))
      const diameter = hasSize ? Math.max(1, Number(size)) : defaultDotSize(state.pensize)
      call('dot', hasSize ? [diameter] : [])
      commands.push({
        type: 'dot',
        x: state.x,
        y: state.y,
        size: diameter,
        color: color === null || color === undefined || color === '' ? state.color : String(color),
      })
    },
    /** A call with no drawing of its own (circle(), backward()), for turtle_command_used. */
    markCommand(name, args = []) {
      call(String(name), Array.isArray(args) ? args : [])
    },
  }
}
