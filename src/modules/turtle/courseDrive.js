/**
 * Turtle course mode, driving: what forward(), turns and the sensors do on a course map
 * (./course.js builds the map's world). Used by the run recorder (./recorder.js) inside the
 * Pyodide worker; pure JS so it can be unit tested.
 *
 * Bridge answers (the shim, ./shim.js, turns them into Python):
 * - '' : done;
 * - 'error|<message>' : a plain mistake (e.g. forward(1.5) on a grid): Python raises ValueError;
 * - 'stop|<message>' : the run ends here (a crash, or too many moves): Python raises the
 *   course's own stop, which the worker shows as the plain message, not a traceback.
 *
 * What it records, beside the usual line / move / turn records:
 * - `pickup` { index, x, y } when a pickup is collected (drawn by the course picture, hidden from
 *   the drawing);
 * - on a crash, a short `move` into the wall and back (the bump), then `crash` { x, y, heading }
 *   at the point of contact.
 * Every forward / backward / goto and every turn counts as one move (course_max_moves).
 */
import {
  gridCellAt,
  gridCellCentre,
  gridCellKind,
  gridStep,
  isGridBlocked,
  isInTrackGoal,
  pointSegmentDistance,
  sweepTrack,
  vehicleName,
  TRACK_PICKUP_REACH,
  TRACK_SENSOR_RANGE,
} from './course.js'

// A program that drives this many moves on one map without finishing is stopped (a loop that
// never ends, e.g. `while not turtle.at_goal()` round a loop of road).
export const COURSE_MAX_MOVES = 1000
// … and one that asks the sensors this many times (a loop that never moves).
export const COURSE_MAX_SENSOR_CHECKS = 20000

const DEG2RAD = Math.PI / 180

function normalizeHeading(degrees) {
  const wrapped = Number(degrees) % 360
  return wrapped < 0 ? wrapped + 360 : wrapped + 0
}

function isWhole(value) {
  return Number.isFinite(value) && Math.abs(value - Math.round(value)) < 1e-9
}

function formatNumber(value) {
  return String(Math.round(Number(value) * 100) / 100)
}

/**
 * A course drive over `world`. `host` is the recorder: { state, setState(next), push(command) }.
 * Returns the bridge methods (forward, turn, setHeading, goto, refuse, sense) and `result`.
 * `studentMap`: the map text when the world is the student's own (turtle.course_map); the result
 * carries it so every screen can draw the map the run used.
 */
export function createCourseDrive(
  world,
  host,
  { index = 0, count = 1, taskId = null, studentMap = null } = {}
) {
  const name = vehicleName(world.vehicle)
  const collected = new Set()
  let moves = 0
  let checks = 0
  let crash = null
  let halt = null

  function stop(kind, message) {
    halt = { kind, message }
    return `stop|${message}`
  }

  function haltAnswer() {
    return halt ? `stop|${halt.message}` : null
  }

  function countMove() {
    moves += 1
    if (moves > COURSE_MAX_MOVES) {
      return stop(
        'moves',
        `The ${name} made ${COURSE_MAX_MOVES} moves without the program finishing, so it was stopped. Is a loop going round forever?`
      )
    }
    return null
  }

  // A straight drive from the current position to (x, y), heading unchanged: a line (pen down) or
  // a move (pen up).
  function travel(x, y) {
    const state = host.state
    if (x === state.x && y === state.y) return
    const base = { x1: state.x, y1: state.y, x2: x, y2: y, heading: state.heading }
    host.push(
      state.penDown
        ? { type: 'line', ...base, color: state.color, width: state.pensize }
        : { type: 'move', ...base }
    )
    host.setState({ ...state, x, y })
  }

  function collect(pickupIndex) {
    if (collected.has(pickupIndex)) return
    collected.add(pickupIndex)
    const pickup = world.pickups[pickupIndex]
    host.push({ type: 'pickup', index: pickupIndex, x: pickup.x, y: pickup.y })
  }

  // The bump: a short nudge in the direction of travel (ux, uy) and back, then the crash mark
  // where the vehicle's front meets the wall.
  function bump(ux, uy, nudge, reach, message) {
    const state = host.state
    const out = { x: state.x + ux * nudge, y: state.y + uy * nudge }
    host.push({
      type: 'move',
      x1: state.x,
      y1: state.y,
      x2: out.x,
      y2: out.y,
      heading: state.heading,
    })
    host.push({
      type: 'move',
      x1: out.x,
      y1: out.y,
      x2: state.x,
      y2: state.y,
      heading: state.heading,
    })
    const point = { x: state.x + ux * reach, y: state.y + uy * reach }
    host.push({ type: 'crash', x: point.x, y: point.y, heading: state.heading })
    host.setState({ ...host.state, crashed: true })
    crash = { message, x: point.x, y: point.y }
    return stop('crash', message)
  }

  // ── Grid ────────────────────────────────────────────────────────────────────

  function gridDrive(squares, label) {
    if (!isWhole(squares)) {
      return `error|On a grid, ${label}() moves whole squares: use ${label}() or ${label}(2), not ${label}(${formatNumber(Math.abs(squares))}).`
    }
    const step = gridStep(host.state.heading)
    if (!step) {
      return `error|The ${name} isn't facing along the grid, so it can't drive. Turn it with left() or right().`
    }
    const sign = squares < 0 ? -1 : 1
    const dr = step.dr * sign
    const dc = step.dc * sign
    for (let i = 0; i < Math.abs(Math.round(squares)); i += 1) {
      const here = gridCellAt(world, host.state.x, host.state.y)
      const row = here.row + dr
      const col = here.col + dc
      if (isGridBlocked(world, row, col)) {
        const message =
          gridCellKind(world, row, col) === 'off' &&
          (row < 0 || col < 0 || row >= world.rows || col >= world.cols)
            ? `The ${name} hit the edge of the map at row ${here.row + 1}, column ${here.col + 1}.`
            : `The ${name} hit a wall at row ${row + 1}, column ${col + 1}.`
        return bump(dc, -dr, world.cell * 0.2, world.cell / 2, message)
      }
      const next = gridCellCentre(world, row, col)
      travel(next.x, next.y)
      world.pickups.forEach((pickup, pickupIndex) => {
        if (pickup.row === row && pickup.col === col) collect(pickupIndex)
      })
    }
    return ''
  }

  // ── Track ───────────────────────────────────────────────────────────────────

  // Drives to (x, y), stopping at a wall: collects pickups on the way, in order.
  function trackDrive(x, y) {
    const state = host.state
    const sweep = sweepTrack(world, state.x, state.y, x, y)
    const path = { x1: state.x, y1: state.y, x2: sweep.x, y2: sweep.y }
    const passed = []
    world.pickups.forEach((pickup, pickupIndex) => {
      if (collected.has(pickupIndex)) return
      const { distance, t } = pointSegmentDistance(pickup.x, pickup.y, path)
      if (distance <= TRACK_PICKUP_REACH) passed.push({ pickupIndex, t })
    })
    passed.sort((a, b) => a.t - b.t)
    for (const { pickupIndex, t } of passed) {
      travel(path.x1 + (path.x2 - path.x1) * t, path.y1 + (path.y2 - path.y1) * t)
      collect(pickupIndex)
    }
    travel(sweep.x, sweep.y)
    if (!sweep.hit) return ''
    const length = Math.hypot(x - path.x1, y - path.y1) || 1
    const ux = (x - path.x1) / length
    const uy = (y - path.y1) / length
    const edge =
      Math.abs(sweep.x) + world.radius >= 199.5 || Math.abs(sweep.y) + world.radius >= 199.5
    const where = `x ${Math.round(sweep.x)}, y ${Math.round(sweep.y)}`
    const message = edge
      ? `The ${name} hit the edge of the picture at ${where}.`
      : `The ${name} hit a wall at ${where}.`
    return bump(ux, uy, Math.min(4, world.radius / 2), world.radius, message)
  }

  function trackWallWithin(directionDegrees, range) {
    const state = host.state
    const radians = directionDegrees * DEG2RAD
    const sweep = sweepTrack(
      world,
      state.x,
      state.y,
      state.x + range * Math.cos(radians),
      state.y + range * Math.sin(radians)
    )
    return sweep.hit
  }

  function gridWallToward(directionDegrees) {
    const step = gridStep(normalizeHeading(directionDegrees))
    if (!step) return false
    const here = gridCellAt(world, host.state.x, host.state.y)
    return isGridBlocked(world, here.row + step.dr, here.col + step.dc)
  }

  function atGoal() {
    const { x, y } = host.state
    if (world.type === 'grid') {
      const here = gridCellAt(world, x, y)
      return gridCellKind(world, here.row, here.col) === 'goal'
    }
    return isInTrackGoal(world, x, y)
  }

  function onPickup() {
    const { x, y } = host.state
    if (world.type === 'grid') {
      const here = gridCellAt(world, x, y)
      return world.pickups.some((p) => p.row === here.row && p.col === here.col)
    }
    return world.pickups.some((p) => Math.hypot(p.x - x, p.y - y) <= TRACK_PICKUP_REACH)
  }

  return {
    world,

    /**
     * forward(distance) (negative for backward()). `count` false for circle()'s own steps (the
     * circle counted as one move already).
     */
    forward(distance, { count = true } = {}) {
      const halted = haltAnswer()
      if (halted) return halted
      const value = Number(distance)
      if (!Number.isFinite(value)) return 'error|forward() needs a number.'
      if (count) {
        const capped = countMove()
        if (capped) return capped
      }
      if (world.type === 'grid') return gridDrive(value, value < 0 ? 'backward' : 'forward')
      const state = host.state
      const radians = state.heading * DEG2RAD
      return trackDrive(state.x + value * Math.cos(radians), state.y + value * Math.sin(radians))
    },

    /** A turn of `degrees` (positive left); `count` false for circle()'s own turns. */
    turn(degrees, { count = true } = {}) {
      const halted = haltAnswer()
      if (halted) return halted
      const value = Number(degrees)
      if (!Number.isFinite(value)) return 'error|left() and right() need a number of degrees.'
      if (world.type === 'grid' && !isWhole(value / 90)) {
        const label = value >= 0 ? 'left' : 'right'
        return `error|On a grid, the ${name} turns in quarter turns: use ${label}() or ${label}(90), not ${label}(${formatNumber(Math.abs(value))}).`
      }
      if (count) {
        const capped = countMove()
        if (capped) return capped
      }
      return ''
    },

    /** circle(): one move on a track; a grid course can't draw one. */
    circle() {
      const halted = haltAnswer()
      if (halted) return halted
      if (world.type === 'grid') return `error|circle() can't be used on a grid course.`
      return countMove() ?? ''
    },

    setHeading(degrees) {
      const halted = haltAnswer()
      if (halted) return halted
      const value = Number(degrees)
      if (world.type === 'grid' && !isWhole(value / 90)) {
        return 'error|On a grid, setheading() takes 0, 90, 180 or 270.'
      }
      return ''
    },

    goto(x, y) {
      const halted = haltAnswer()
      if (halted) return halted
      if (world.type === 'grid') {
        return "error|goto() can't be used on a grid course: drive with forward(), left() and right()."
      }
      const capped = countMove()
      if (capped) return capped
      return trackDrive(Number(x), Number(y))
    },

    /** A command a course can't use (home, reset, clear; circle on a grid). */
    refuse(command) {
      const where = world.type === 'grid' ? 'a grid course' : 'a course'
      return `error|${command}() can't be used on ${where}.`
    },

    /** A sensor: wall_ahead, wall_left, wall_right, at_goal, on_pickup, collected. */
    sense(op) {
      const halted = haltAnswer()
      if (halted) return halted
      checks += 1
      if (checks > COURSE_MAX_SENSOR_CHECKS) {
        return stop(
          'sensors',
          `The program checked the sensors ${COURSE_MAX_SENSOR_CHECKS} times without finishing, so it was stopped. Is a loop going round without moving the ${name}?`
        )
      }
      const heading = host.state.heading
      switch (op) {
        case 'wall_ahead':
          return String(
            world.type === 'grid'
              ? gridWallToward(heading)
              : trackWallWithin(heading, TRACK_SENSOR_RANGE)
          )
        case 'wall_left':
          return String(
            world.type === 'grid'
              ? gridWallToward(heading + 90)
              : trackWallWithin(heading + 90, TRACK_SENSOR_RANGE)
          )
        case 'wall_right':
          return String(
            world.type === 'grid'
              ? gridWallToward(heading - 90)
              : trackWallWithin(heading - 90, TRACK_SENSOR_RANGE)
          )
        case 'at_goal':
          return String(atGoal())
        case 'on_pickup':
          return String(onPickup())
        case 'collected':
          return String(collected.size)
        default:
          return `error|${op}() isn't a course sensor.`
      }
    },

    get halted() {
      return halt
    },

    /** How many moves so far (turtle.course_map() must come before the first). */
    get moves() {
      return moves
    },

    /** The map's outcome, as the run result carries it (turtle.course). */
    get result() {
      return {
        type: world.type,
        vehicle: world.vehicle,
        index,
        count,
        ...(taskId !== null && taskId !== undefined ? { taskId: String(taskId) } : {}),
        goalReached: atGoal(),
        crashed: !!crash,
        crash: crash ? { message: crash.message, x: crash.x, y: crash.y } : null,
        pickups: collected.size,
        pickupsTotal: world.pickups.length,
        moves,
        stopped: halt && halt.kind !== 'crash' ? halt.kind : null,
        message: halt ? halt.message : null,
        // The student's own map (turtle.course_map), tidied: screens rebuild the map from it.
        ...(typeof studentMap === 'string' ? { studentMap } : {}),
      }
    },
  }
}
