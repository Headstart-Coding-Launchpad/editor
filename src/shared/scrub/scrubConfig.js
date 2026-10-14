// A task's `scrub` field (live number and colour scrubbing in the code editor) and the module
// capability that says how a scrub re-runs the program. Pure and Node-safe: the lesson
// validator, the CLI, the Builder and the classroom share one reading of the field.
//
// Task field (python, turtle and html declare it in their definitions' taskFields):
//   scrub: { enabled: true, numbers: true, colours: true, ranges: [{ line, min, max }] }
// `scrub: true` is short for `{ enabled: true }`. Numbers and colours default to on.
//
// Module capability (`capabilities.scrub`, src/modules/defineModule.js), null = no scrubbing:
//   { liveRerun: 'preview' | 'none', needsImport: string | null, inputCall: string | null }
// - liveRerun 'preview': while a value is dragged the program re-runs as a preview (no attempt,
//   checks or saves; useScrubPreview); 'none': the student presses Run to see it.
// - needsImport: the program only re-runs live when it imports this module (python: 'stage', so
//   only drawing programs re-run).
// - inputCall: a program calling this function (input) never re-runs live: it would stop to ask.

export const SCRUB_TASK_FIELD = Object.freeze({
  name: 'scrub',
  type: 'object',
  description:
    'Live scrubbing in the code editor (off unless set): { enabled: true, numbers: true (drag or tap a number for a slider), colours: true (click a colour for a picker), ranges: [{ line, min, max }] (per-line slider ranges; otherwise a range around the value) }. Drawing programs re-run live while a value changes.',
})

export const SCRUB_LIVE_RERUN_KINDS = Object.freeze(['preview', 'none'])

const SCRUB_KEYS = ['enabled', 'numbers', 'colours', 'ranges']

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isWholeLine(value) {
  return Number.isInteger(value) && value >= 1
}

/**
 * The task's scrub settings, normalised — `{ numbers, colours, ranges: [{ line, min, max }] }` —
 * or null when scrubbing is off (no field, `enabled: false`, or both kinds off). Invalid ranges
 * are dropped; the first range for a line wins.
 */
export function getTaskScrub(task) {
  const raw = task?.scrub
  if (raw === true) return { numbers: true, colours: true, ranges: [] }
  if (!isPlainObject(raw) || raw.enabled === false) return null
  const numbers = raw.numbers !== false
  const colours = raw.colours !== false
  if (!numbers && !colours) return null
  const ranges = []
  const seen = new Set()
  for (const range of Array.isArray(raw.ranges) ? raw.ranges : []) {
    const line = range?.line
    const min = Number(range?.min)
    const max = Number(range?.max)
    if (!isWholeLine(line) || seen.has(line)) continue
    if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) continue
    seen.add(line)
    ranges.push({ line, min, max })
  }
  return { numbers, colours, ranges }
}

/** The module's scrub capability, normalised (`{ liveRerun, needsImport, inputCall }`), or null. */
export function scrubCapabilityOf(definition) {
  const raw = definition?.capabilities?.scrub
  if (!isPlainObject(raw)) return null
  return {
    liveRerun: SCRUB_LIVE_RERUN_KINDS.includes(raw.liveRerun) ? raw.liveRerun : 'none',
    needsImport: typeof raw.needsImport === 'string' && raw.needsImport ? raw.needsImport : null,
    inputCall: typeof raw.inputCall === 'string' && raw.inputCall ? raw.inputCall : null,
  }
}

/** A `capabilities.scrub` problem for defineModule, or null when it is valid (or absent). */
export function scrubCapabilityProblem(raw) {
  if (raw == null) return null
  if (!isPlainObject(raw)) return '"capabilities.scrub" must be an object or null'
  if (!SCRUB_LIVE_RERUN_KINDS.includes(raw.liveRerun)) {
    return `"capabilities.scrub.liveRerun" must be one of: ${SCRUB_LIVE_RERUN_KINDS.join(', ')}`
  }
  for (const key of ['needsImport', 'inputCall']) {
    if (raw[key] != null && (typeof raw[key] !== 'string' || !/^\w+$/.test(raw[key]))) {
      return `"capabilities.scrub.${key}" must be a name or null`
    }
  }
  return null
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * How a scrub shows its result for this code: 'preview' (re-run live) or 'press-run' (the
 * student presses Run to see it: the module doesn't re-run live, the program doesn't import the
 * module it needs, or it asks for input).
 */
export function scrubPreviewMode(capability, code) {
  if (!capability || capability.liveRerun !== 'preview') return 'press-run'
  const text = String(code ?? '')
  if (capability.needsImport) {
    const name = escapeRegExp(capability.needsImport)
    const imports = new RegExp(`^\\s*(?:import\\s+${name}\\b|from\\s+${name}\\s+import\\b)`, 'm')
    if (!imports.test(text)) return 'press-run'
  }
  if (capability.inputCall) {
    const call = new RegExp(`(?<![\\w.])${escapeRegExp(capability.inputCall)}\\s*\\(`)
    if (call.test(text)) return 'press-run'
  }
  return 'preview'
}

/**
 * Lesson validation for `scrub` (the module's validateTask calls it; messages are documented in
 * docs/authoring/validation-errors.md). `starterCode` (optional) is the task's starter code, to
 * warn about ranges past its last line.
 */
export function validateScrub(task, n, errors, warnings = [], { starterCode = null } = {}) {
  const raw = task?.scrub
  if (raw == null || raw === true) return
  if (!isPlainObject(raw)) {
    errors.push(
      `Task ${n} has a scrub that is not an object — write it as scrub: { enabled: true }`
    )
    return
  }
  for (const key of ['enabled', 'numbers', 'colours']) {
    if (raw[key] != null && typeof raw[key] !== 'boolean') {
      errors.push(`Task ${n} has scrub ${key} that is not true or false`)
    }
  }
  if (raw.numbers === false && raw.colours === false && raw.enabled !== false) {
    warnings.push(`Task ${n} has scrub with numbers and colours both off — nothing can be scrubbed`)
  }
  const extra = Object.keys(raw).filter((key) => !SCRUB_KEYS.includes(key))
  if (extra.length > 0) {
    warnings.push(
      `Task ${n} has scrub fields it does not use (${extra.join(', ')}) — they are ignored`
    )
  }
  if (raw.ranges == null) return
  if (!Array.isArray(raw.ranges)) {
    errors.push(
      `Task ${n} has scrub ranges that is not a list — write ranges: [{ line, min, max }]`
    )
    return
  }
  const lineCount = typeof starterCode === 'string' ? starterCode.split('\n').length : null
  const seen = new Set()
  for (const range of raw.ranges) {
    if (!isPlainObject(range) || !isWholeLine(range.line)) {
      errors.push(`Task ${n} has a scrub range without a line number of 1 or more`)
      continue
    }
    const { line } = range
    if (typeof range.min !== 'number' || typeof range.max !== 'number') {
      errors.push(`Task ${n} has a scrub range on line ${line} whose min or max is not a number`)
    } else if (range.min >= range.max) {
      errors.push(`Task ${n} has a scrub range on line ${line} whose min is not less than its max`)
    }
    if (seen.has(line)) {
      warnings.push(`Task ${n} has two scrub ranges for line ${line} — only the first is used`)
      continue
    }
    seen.add(line)
    if (lineCount != null && line > lineCount) {
      warnings.push(
        `Task ${n} has a scrub range on line ${line}, but the starter code has only ${lineCount} lines`
      )
    }
  }
}
