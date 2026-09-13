import { compareValues } from '../../shared/checkHelpers.js'

export const TURTLE_CHECK_TYPES = [
  'turtle_position',
  'turtle_heading',
  'turtle_path_closed',
  'turtle_segment_count',
  'turtle_path_length',
  'turtle_command_used',
  'turtle_color_used',
  'turtle_stamp_count',
]

// Canonical bridge-call names recorded in context.turtle.calls (see
// ../python/pyodide.worker.js's __hsTurtle* functions) — aliases like fd/forward
// or lt/rt all collapse to these via the shim (../turtle/shim.js), so a
// turtle_command_used check targets one of these, not the raw method name the
// student typed. left() and right() both record as 'turn' (signed degrees),
// since they're the same underlying bridge call — can't tell them apart.
// circle() and backward() record themselves via a no-op __hsTurtleMarkCommand
// call (they're built out of forward()/left() calls under the hood, which also
// record/draw themselves — so a backward move also counts as a 'forward' call);
// color() isn't separately recorded — it records as pencolor
// and/or fillcolor, whichever it actually changed.
export const TURTLE_COMMAND_NAMES = [
  'forward',
  'backward',
  'turn',
  'goto',
  'setheading',
  'home',
  'reset',
  'penup',
  'pendown',
  'pencolor',
  'fillcolor',
  'bgcolor',
  'beginfill',
  'endfill',
  'circle',
  'stamp',
  'write',
]

function toNumber(value, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function getTurtleContext(context = {}) {
  const turtle = context.turtle
  return {
    state: turtle?.state ?? null,
    commands: Array.isArray(turtle?.commands) ? turtle.commands : [],
    calls: Array.isArray(turtle?.calls) ? turtle.calls : [],
  }
}

function segmentLength(segment) {
  return Math.hypot(segment.x2 - segment.x1, segment.y2 - segment.y1)
}

function totalPathLength(commands) {
  return commands.filter((c) => c?.type === 'line').reduce((sum, c) => sum + segmentLength(c), 0)
}

function normalizeColor(color) {
  return String(color ?? '')
    .trim()
    .toLowerCase()
}

export function evaluateTurtleCheck(check, context = {}) {
  const { state, commands, calls } = getTurtleContext(context)

  if (check.type === 'turtle_position') {
    if (!state) return false
    const tolerance = toNumber(check.tolerance, 2)
    const dx = state.x - toNumber(check.x)
    const dy = state.y - toNumber(check.y)
    return Math.hypot(dx, dy) <= tolerance
  }

  if (check.type === 'turtle_heading') {
    if (!state) return false
    const tolerance = toNumber(check.tolerance, 2)
    const target = ((toNumber(check.value) % 360) + 360) % 360
    const actual = ((state.heading % 360) + 360) % 360
    const diff = Math.abs(target - actual)
    return Math.min(diff, 360 - diff) <= tolerance
  }

  if (check.type === 'turtle_path_closed') {
    const lines = commands.filter((c) => c?.type === 'line')
    if (lines.length === 0) return false
    const tolerance = toNumber(check.tolerance, 2)
    const first = lines[0]
    const last = lines[lines.length - 1]
    return Math.hypot(last.x2 - first.x1, last.y2 - first.y1) <= tolerance
  }

  if (check.type === 'turtle_segment_count') {
    const count = commands.filter((c) => c?.type === 'line').length
    return compareValues(count, check.operator ?? 'greater_than_or_equal', check.value)
  }

  if (check.type === 'turtle_path_length') {
    return compareValues(
      totalPathLength(commands),
      check.operator ?? 'greater_than_or_equal',
      check.value
    )
  }

  if (check.type === 'turtle_command_used') {
    const target = String(check.command ?? '')
    const minCount = Math.max(1, Math.trunc(toNumber(check.minCount, 1)))
    const matches = calls.filter((call) => call?.name === target).length
    return matches >= minCount
  }

  if (check.type === 'turtle_color_used') {
    const target = normalizeColor(check.color)
    if (!target) return false
    const kind = check.kind === 'fill' ? 'fill' : 'pen'
    const stateColor = kind === 'fill' ? state?.fillColor : state?.color
    const callName = kind === 'fill' ? 'fillcolor' : 'pencolor'
    if (normalizeColor(stateColor) === target) return true
    return calls.some(
      (call) => call?.name === callName && normalizeColor(call.args?.[0]) === target
    )
  }

  if (check.type === 'turtle_stamp_count') {
    const count = commands.filter((c) => c?.type === 'stamp').length
    return compareValues(count, check.operator ?? 'greater_than_or_equal', check.value)
  }

  return false
}
