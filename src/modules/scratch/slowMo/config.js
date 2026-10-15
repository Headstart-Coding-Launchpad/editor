// The `slowMo` task field of a Scratch task (docs/authoring/scratch.md "Slow-mo"): normalising and
// validation, shared by the classroom, the Builder and the CLI. Pure.
//
//   slowMo:
//     enabled: true
//     speed: 1            # blocks a second to start with; the student's slider goes 0.25–4
//     timeline: [costume, backdrop, x, y, variables]
//
// Off unless `enabled` is true. `timeline` lists what each snapshot in the strip under the stage
// shows; left out, it shows all five. An empty list hides the strip.
import {
  SLOW_MO_DEFAULT_SPEED,
  SLOW_MO_MAX_SPEED,
  SLOW_MO_MIN_SPEED,
  clampSlowMoSpeed,
} from './gate.js'

export const SLOW_MO_TIMELINE_FIELDS = Object.freeze(['costume', 'backdrop', 'x', 'y', 'variables'])

const KNOWN_KEYS = new Set(['enabled', 'speed', 'timeline'])

/** The task's slow-mo settings — `{ speed, timeline }` — or null when slow-mo is off. */
export function normalizeSlowMo(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.enabled !== true) return null
  const timeline = Array.isArray(raw.timeline)
    ? SLOW_MO_TIMELINE_FIELDS.filter((field) => raw.timeline.includes(field))
    : [...SLOW_MO_TIMELINE_FIELDS]
  return { speed: clampSlowMoSpeed(raw.speed ?? SLOW_MO_DEFAULT_SPEED), timeline }
}

/** Builder / CLI validation of `task.slowMo` (pushes plain-English messages). */
export function validateScratchSlowMo(task, n, errors, warnings) {
  const raw = task?.slowMo
  if (raw == null) return
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    errors.push(`Task ${n} slowMo must be an object, e.g. { enabled: true }`)
    return
  }
  if (raw.enabled !== undefined && typeof raw.enabled !== 'boolean') {
    errors.push(`Task ${n} slowMo.enabled must be true or false`)
  }
  if (raw.speed !== undefined) {
    const speed = Number(raw.speed)
    if (typeof raw.speed !== 'number' || !Number.isFinite(speed) || speed <= 0) {
      errors.push(`Task ${n} slowMo.speed must be a number of blocks per second above 0`)
    } else if (speed < SLOW_MO_MIN_SPEED || speed > SLOW_MO_MAX_SPEED) {
      warnings.push(
        `Task ${n} slowMo.speed ${speed} is outside ${SLOW_MO_MIN_SPEED}–${SLOW_MO_MAX_SPEED} blocks per second; it will be clamped`
      )
    }
  }
  if (raw.timeline !== undefined) {
    if (!Array.isArray(raw.timeline)) {
      errors.push(
        `Task ${n} slowMo.timeline must be a list of: ${SLOW_MO_TIMELINE_FIELDS.join(', ')}`
      )
    } else {
      const unknown = raw.timeline.filter((field) => !SLOW_MO_TIMELINE_FIELDS.includes(field))
      if (unknown.length > 0) {
        warnings.push(
          `Task ${n} slowMo.timeline has unknown field(s) ${unknown.join(', ')}; use ${SLOW_MO_TIMELINE_FIELDS.join(', ')}`
        )
      }
    }
  }
  const extra = Object.keys(raw).filter((key) => !KNOWN_KEYS.has(key))
  if (extra.length > 0) {
    warnings.push(`Task ${n} slowMo has unknown key(s) ${extra.join(', ')}; they are ignored`)
  }
  if (raw.enabled === undefined && Object.keys(raw).length > 0) {
    warnings.push(`Task ${n} slowMo is set but not enabled; add enabled: true to show it`)
  }
}
