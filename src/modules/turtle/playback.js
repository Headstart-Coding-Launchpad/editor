/**
 * Turtle playback timing: turns a run's command log (./recorder.js) into a timeline the
 * picture can play, and says what the picture looks like at any moment. Pure, no DOM.
 *
 * Speed (Ryan, 2026-10-15; docs/authoring/turtle.md "Speed and animation"):
 * - No speed() call: plays at speed 10 ("fast") pace, and the whole drawing is squeezed to
 *   finish within DEFAULT_PLAYBACK_MAX_MS.
 * - speed(1–10) / a speed name: real turtle's pace for that speed, however long it takes
 *   (the student can Skip). Moves before the first speed() call play at speed 10.
 * - speed(0) / "fastest": instant.
 *
 * Real turtle's pace (CPython turtle.py, one screen update every TURTLE_STEP_MS):
 * - a move of d units takes 1 + floor(d / (3 · 1.1^s · s)) updates;
 * - a turn of a degrees takes 1 + floor(|a| / (3 · s)) updates.
 * circle()'s own small turns are instant (as in real turtle), and turns or pen-up moves while
 * the turtle is hidden take no time (nothing on screen changes).
 *
 * The timeline has one step per command (steps[i] is commands[i]), back to back:
 * { kind, start, end, from, to } with `from`/`to` poses { x, y, heading, visible }.
 * `redrawAt` lists the command counts at which a fill closes: a player drawing the picture
 * bit by bit must redraw from scratch then, because the fill goes under lines already drawn.
 */

export const TURTLE_STEP_MS = 10
export const DEFAULT_PLAYBACK_SPEED = 10
export const DEFAULT_PLAYBACK_MAX_MS = 4000

export const TURTLE_SPEED_NAMES = { fastest: 0, fast: 10, normal: 6, slow: 3, slowest: 1 }

/** A speed() argument as real turtle reads it: a name, or a number (0.5–10.5 rounds, else 0). */
export function normalizeTurtleSpeed(value) {
  if (typeof value === 'string') {
    const key = value.trim().toLowerCase()
    if (key in TURTLE_SPEED_NAMES) return TURTLE_SPEED_NAMES[key]
    if (key === '' || !Number.isFinite(Number(key))) return null
    return normalizeTurtleSpeed(Number(key))
  }
  const n = Number(value)
  if (value === null || value === undefined || !Number.isFinite(n)) return null
  return n > 0.5 && n < 10.5 ? Math.round(n) : 0
}

/** How long real turtle takes to move `distance` units at `speed` (0 = instant). */
export function moveDurationMs(distance, speed) {
  const s = Number(speed) || 0
  if (s <= 0) return 0
  const perUpdate = 3 * Math.pow(1.1, s) * s
  return (1 + Math.floor(Math.abs(Number(distance) || 0) / perUpdate)) * TURTLE_STEP_MS
}

/** How long real turtle takes to turn `degrees` at `speed` (0 = instant). */
export function turnDurationMs(degrees, speed) {
  const s = Number(speed) || 0
  if (s <= 0) return 0
  return (1 + Math.floor(Math.abs(Number(degrees) || 0) / (3 * s))) * TURTLE_STEP_MS
}

const START_POSE = Object.freeze({ x: 0, y: 0, heading: 0, visible: true })

function normalizeHeading(degrees) {
  const wrapped = Number(degrees) % 360
  return wrapped < 0 ? wrapped + 360 : wrapped + 0
}

function hasSpeedCall(commands) {
  return commands.some((command) => command?.type === 'speed')
}

/**
 * The timeline for a command log.
 * Options: `maxMs` (the squeeze for runs with no speed() call), `defaultSpeed`, `startPose`.
 * Returns { steps, totalMs, mode, scale, redrawAt, endPose }, where `mode` is 'default' (no
 * speed() call), 'speed' (the code set a speed) or 'instant' (nothing takes any time).
 */
export function buildTurtleTimeline(commands = [], options = {}) {
  const {
    maxMs = DEFAULT_PLAYBACK_MAX_MS,
    defaultSpeed = DEFAULT_PLAYBACK_SPEED,
    startPose = START_POSE,
  } = options
  const list = Array.isArray(commands) ? commands : []
  const explicit = hasSpeedCall(list)
  let speed = defaultSpeed
  let pose = { ...START_POSE, ...startPose }
  const raw = []
  const redrawAt = []

  list.forEach((command, index) => {
    const from = pose
    let duration = 0
    let to = from
    switch (command?.type) {
      case 'line':
      case 'move': {
        const heading = Number.isFinite(Number(command.heading))
          ? Number(command.heading)
          : from.heading
        to = { ...from, x: Number(command.x2), y: Number(command.y2), heading }
        const distance = Math.hypot(command.x2 - command.x1, command.y2 - command.y1)
        const shown = command.type === 'line' || from.visible
        duration = shown ? moveDurationMs(distance, speed) : 0
        // The turtle starts the move from where the move began (a trimmed log may not join up).
        raw.push({
          kind: command.type,
          duration,
          from: { ...from, x: Number(command.x1), y: Number(command.y1), heading },
          to,
        })
        break
      }
      case 'turn': {
        const delta = Number(command.delta) || 0
        const start = Number.isFinite(Number(command.from)) ? Number(command.from) : from.heading
        to = { ...from, heading: normalizeHeading(start + delta) }
        duration = command.instant || !from.visible ? 0 : turnDurationMs(delta, speed)
        raw.push({ kind: 'turn', duration, from: { ...from, heading: start }, to, delta })
        break
      }
      case 'speed': {
        const next = normalizeTurtleSpeed(command.speed)
        if (next !== null) speed = next
        raw.push({ kind: 'speed', duration: 0, from, to })
        break
      }
      case 'visible':
        to = { ...from, visible: command.visible !== false }
        raw.push({ kind: 'visible', duration: 0, from, to })
        break
      default:
        raw.push({ kind: command?.type ?? 'unknown', duration: 0, from, to })
    }
    if (command?.type === 'fill' && Number.isFinite(command.closedAt) && command.closedAt > index) {
      redrawAt.push(command.closedAt)
    }
    pose = to
  })

  const rawTotal = raw.reduce((sum, step) => sum + step.duration, 0)
  const scale = !explicit && rawTotal > maxMs && rawTotal > 0 ? maxMs / rawTotal : 1
  let clock = 0
  const steps = raw.map((step) => {
    const start = clock
    clock += step.duration * scale
    return { ...step, start, end: clock }
  })
  const totalMs = clock
  return {
    steps,
    totalMs,
    mode: totalMs === 0 ? 'instant' : explicit ? 'speed' : 'default',
    scale,
    redrawAt: [...new Set(redrawAt)].sort((a, b) => a - b),
    endPose: pose,
  }
}

function lerp(a, b, p) {
  return a + (b - a) * p
}

/**
 * The picture at `ms` into the timeline: { done, active, progress, pose, finished }.
 * `done` commands are complete (draw commands.slice(0, done)); `active` is the step under way
 * (or null) and `progress` how far along it is (0–1); `pose` is where the marker is.
 */
export function turtleTimelineFrame(timeline, ms) {
  const steps = timeline?.steps ?? []
  const t = Math.max(0, Number(ms) || 0)
  // done = the first step still going (end > t): binary search, steps are back to back.
  let lo = 0
  let hi = steps.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (steps[mid].end <= t) lo = mid + 1
    else hi = mid
  }
  const done = lo
  if (done >= steps.length) {
    return {
      done: steps.length,
      active: null,
      progress: 1,
      pose: timeline?.endPose ?? { ...START_POSE },
      finished: true,
    }
  }
  const active = steps[done]
  const span = active.end - active.start
  const progress = span > 0 ? Math.max(0, Math.min(1, (t - active.start) / span)) : 0
  let pose
  if (active.kind === 'turn') {
    pose = {
      ...active.from,
      heading: normalizeHeading(active.from.heading + active.delta * progress),
    }
  } else if (active.kind === 'line' || active.kind === 'move') {
    pose = {
      ...active.to,
      x: lerp(active.from.x, active.to.x, progress),
      y: lerp(active.from.y, active.to.y, progress),
    }
  } else {
    pose = active.from
  }
  return { done, active, progress, pose, finished: false }
}
