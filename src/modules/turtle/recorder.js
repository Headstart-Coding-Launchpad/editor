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
 *
 * Course mode (./course.js, ./courseDrive.js): setCourse(spec) puts the turtle at the map's start
 * (a hidden, instant jump there: `visible` false, `move`, `visible` true) with a faint trail, and
 * from then on moves and turns go through the course drive (walls, pickups, crashes). Course-aware
 * methods return the drive's bridge answer ('' or 'error|…' / 'stop|…'); without a course they
 * return nothing, as before. `course` is the map's outcome for the run result.
 *
 * Student-made maps (P6-16): on a course spec with `studentMap: true`, setStudentMap(text)
 * (turtle.course_map) swaps in the student's own grid map before the first move: the vehicle
 * jumps to its start and the outcome carries the map text (`course.studentMap`).
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
import {
  buildCourseWorld,
  normalizeStudentMapText,
  studentMapProblems,
  vehicleName,
  COURSE_TRAIL_COLOR,
} from './course.js'
import { createCourseDrive } from './courseDrive.js'

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
  // Course mode's drive (./courseDrive.js), or null.
  let drive = null
  // The course spec setCourse() was given (for turtle.course_map), or null.
  let courseSpec = null
  const host = {
    get state() {
      return state
    },
    setState(next) {
      state = next
      if (fill) fill.points.push({ x: state.x, y: state.y })
    },
    push(command) {
      commands.push(command)
    },
  }

  function call(name, args = []) {
    calls.push({ name, args })
  }

  // Puts the vehicle at the start of `world` (a hidden, instant jump there) and starts the
  // drive. `studentMap`: the student's own map text (turtle.course_map), which replaces the
  // task's; the pen settings the code chose before it are kept.
  function startCourse(world, spec, studentMap = null) {
    const { x, y, heading } = world.start
    const autoPensize = world.type === 'grid' ? Math.max(2, world.cell * 0.08) : 3
    const fresh = {
      ...createTurtleState(),
      color: COURSE_TRAIL_COLOR,
      pensize: autoPensize,
    }
    const kept = studentMap
      ? {
          penDown: state.penDown,
          color: state.color,
          fillColor: state.fillColor,
          background: state.background,
          visible: state.visible,
          speed: state.speed,
          pensize: calls.some((c) => c.name === 'pensize') ? state.pensize : autoPensize,
        }
      : {}
    state = { ...fresh, ...kept, x, y, heading }
    commands = [
      { type: 'visible', visible: false },
      { type: 'move', x1: 0, y1: 0, x2: x, y2: y, heading },
      { type: 'visible', visible: true },
    ]
    if (studentMap && state.speed !== undefined && state.speed !== null) {
      commands.push({ type: 'speed', speed: state.speed })
    }
    if (studentMap && !state.visible) commands.push({ type: 'visible', visible: false })
    fill = null
    drive = createCourseDrive(world, host, {
      index: spec.index ?? 0,
      count: spec.count ?? 1,
      taskId: spec.taskId ?? null,
      studentMap,
    })
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

    /**
     * Course mode: drive over map `spec` ({ type, vehicle, map, index, count, taskId }, see
     * course.js courseRunSpec). Returns '' or 'error|<message>'.
     */
    setCourse(spec = {}) {
      const world = buildCourseWorld(spec.type, spec.map, spec.vehicle)
      if (world.error) return `error|This task's course map can't be used: ${world.error}.`
      courseSpec = spec
      startCourse(world, spec)
      return ''
    },
    /**
     * turtle.course_map(text): the student's own map replaces the task's for this run (only on
     * a course with `studentMap: true`, and only before the vehicle's first move). Returns '' or
     * 'error|<plain message>'.
     */
    setStudentMap(text) {
      if (!drive || !courseSpec) {
        return 'error|course_map() only works on a course task that lets you make your own map.'
      }
      if (!courseSpec.studentMap) {
        return "error|This task's map is set for you, so course_map() can't change it."
      }
      if (courseSpec.type !== 'grid') return 'error|course_map() only works on grid courses.'
      const name = vehicleName(courseSpec.vehicle)
      if (drive.moves > 0) {
        return `error|Call course_map() before the ${name} moves: put it near the top, straight after import turtle.`
      }
      const problems = studentMapProblems(text, courseSpec.vehicle)
      if (problems.length) return `error|${problems[0]}.`
      const tidy = normalizeStudentMapText(text)
      const world = buildCourseWorld('grid', tidy, courseSpec.vehicle)
      if (world.error) return `error|Your map can't be used: ${world.error}.`
      startCourse(world, courseSpec, tidy)
      return ''
    },
    /** A course sensor (wall_ahead, at_goal, collected, …): its answer as text. */
    sense(op) {
      if (!drive) {
        return `error|${op}() only works on a course task (a task with a map to drive round).`
      }
      return drive.sense(String(op))
    },
    /** The course map's outcome (courseDrive.js result), or null without a course. */
    get course() {
      return drive ? drive.result : null
    },
    /** Why a course run was stopped ({ kind, message }), or null. */
    get courseHalt() {
      return drive ? drive.halted : null
    },

    /** `part`: one of circle()'s own steps (on a course, the circle counts as one move). */
    forward(distance, part = false) {
      call('forward', [distance])
      if (drive) return drive.forward(distance, { count: !part })
      travel(applyTurtleForward(state, Number(distance) || 0).nextState)
    },
    /** Positive turns left. `instant` (circle()'s own turns) plays with no delay, as in real turtle. */
    turn(degrees, instant = false) {
      call('turn', [degrees])
      const delta = Number(degrees) || 0
      if (drive) {
        const answer = drive.turn(delta, { count: !instant })
        if (answer) return answer
      }
      turnTo(applyTurtleTurn(state, delta).heading, delta, instant)
      return drive ? '' : undefined
    },
    goto(x, y) {
      call('goto', [x, y])
      if (drive) return drive.goto(x, y)
      travel(applyTurtleGoto(state, Number(x), Number(y)).nextState)
    },
    setHeading(degrees) {
      call('setheading', [degrees])
      if (drive) {
        const answer = drive.setHeading(degrees)
        if (answer) return answer
      }
      const next = applyTurtleSetHeading(state, Number(degrees) || 0).heading
      turnTo(next, shortestTurn(state.heading, next))
      return drive ? '' : undefined
    },
    home() {
      call('home', [])
      if (drive) return drive.refuse('home')
      travel(applyTurtleGoto(state, 0, 0).nextState)
      turnTo(0, shortestTurn(state.heading, 0))
    },
    reset() {
      call('reset', [])
      if (drive) return drive.refuse('reset')
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
      // On a course a circle is one move (its own steps aren't counted); a grid can't draw one.
      if (drive && name === 'circle') return drive.circle()
      return drive ? '' : undefined
    },
  }
}
