// The `slowMo` task field of a Python or Turtle task (docs/authoring/python.md "Slow-mo"):
// normalising and validation, shared by the classroom, the Builder and the CLI. Pure.
//
//   slowMo:
//     enabled: true
//     speed: 1               # steps a second to start with; the student's slider goes 0.25–4
//     showVariables: true    # name tags step by step (the name-tag panel)
//     question: After pass 3, what is total?   # shown while paused
//     separateButton: false  # true: Run runs normally beside a separate 🐢 Slow-mo button
//
// Off unless `enabled` is true. Slow-mo records the whole run first (the run IS the run for the
// checks), then plays the recording back one line at a time. By default Run itself plays the
// run in slow-mo ("▶ Run (slow-mo)"); `separateButton: true` keeps the older two-button layout.

export const PYTHON_SLOW_MO_MIN_SPEED = 0.25
export const PYTHON_SLOW_MO_MAX_SPEED = 4
export const PYTHON_SLOW_MO_DEFAULT_SPEED = 1
// The most lines a recording holds. A longer (or never-ending) program stops at this step.
export const PYTHON_SLOW_MO_MAX_STEPS = 2000
export const PYTHON_SLOW_MO_CAP_MESSAGE =
  'Slow-mo stops after 2,000 steps. Is there a loop that never ends?'
// The Run button's tooltip when Run plays the run in slow-mo (slowMoThroughRun).
export const PYTHON_SLOW_MO_RUN_TITLE = 'Run your program slowly, one line at a time'
// A question longer than this gets a validation warning (it shows in a small box).
export const PYTHON_SLOW_MO_QUESTION_CHARS = 200

const KNOWN_KEYS = new Set(['enabled', 'speed', 'showVariables', 'question', 'separateButton'])

// The task field, as python and turtle declare it in their definitions' taskFields. The Builder
// shows its control for a module that declares it (declaresPythonSlowMo, TaskEditor.jsx).
export const PYTHON_SLOW_MO_TASK_FIELD = Object.freeze({
  name: 'slowMo',
  type: 'object',
  description:
    'Slow-mo: record the run, then play it back line by line. Run plays it in slow-mo, with Pause, Step, Step back, Restart and Finish buttons. { enabled: true, speed: steps per second (default 1, 0.25–4), showVariables: true | false (name tags step by step), question: text shown while paused, separateButton: true (Run runs normally beside a separate Slow-mo button) }. Off unless enabled.',
})

/**
 * Whether a module definition declares this field (python, turtle). Definitions hold copies of
 * their field specs, so it is matched by name and description; Scratch's own `slowMo` differs.
 */
export function declaresPythonSlowMo(definition) {
  return !!definition?.taskFields?.some(
    (field) =>
      field?.name === PYTHON_SLOW_MO_TASK_FIELD.name &&
      field.description === PYTHON_SLOW_MO_TASK_FIELD.description
  )
}

export function clampPythonSlowMoSpeed(speed) {
  const n = Number(speed)
  if (!Number.isFinite(n) || n <= 0) return PYTHON_SLOW_MO_DEFAULT_SPEED
  return Math.min(PYTHON_SLOW_MO_MAX_SPEED, Math.max(PYTHON_SLOW_MO_MIN_SPEED, n))
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/**
 * The task's slow-mo settings — `{ speed, showVariables, question, separateButton }` — or null
 * when slow-mo is off (the field is missing, or `enabled` isn't true).
 */
export function getPythonSlowMo(task) {
  const raw = task?.slowMo
  if (!isPlainObject(raw) || raw.enabled !== true) return null
  const question = typeof raw.question === 'string' ? raw.question.trim() : ''
  return {
    speed: clampPythonSlowMoSpeed(raw.speed ?? PYTHON_SLOW_MO_DEFAULT_SPEED),
    showVariables: raw.showVariables === true,
    question: question || null,
    separateButton: raw.separateButton === true,
  }
}

/**
 * Whether Run itself plays the run in slow-mo (the default for a slow-mo task), rather than
 * running normally beside a separate 🐢 Slow-mo button (`separateButton: true`). Takes
 * getPythonSlowMo's settings.
 */
export function slowMoThroughRun(config) {
  return !!config && config.separateButton !== true
}

/**
 * What the worker records for a slow-mo run: `{ lineOffset, hide }`. `lineOffset` is how many
 * lines the runtime puts before the student's code (Turtle's shim, TURTLE_LINE_OFFSET), so the
 * recorded lines match the editor's; `hide` is the name-tag panel's hidden names.
 */
export function slowMoRecordOptions(task, { lineOffset = 0 } = {}) {
  const hide = Array.isArray(task?.showVariables?.hide)
    ? task.showVariables.hide.filter((name) => typeof name === 'string' && name)
    : []
  return { lineOffset: Number.isInteger(lineOffset) && lineOffset > 0 ? lineOffset : 0, hide }
}

/** Builder / CLI validation of a Python or Turtle `task.slowMo` (plain-English messages). */
export function validatePythonSlowMo(task, n, errors, warnings) {
  const raw = task?.slowMo
  if (raw == null) return
  if (!isPlainObject(raw)) {
    errors.push(`Task ${n} slowMo must be an object, e.g. { enabled: true }`)
    return
  }
  if (raw.enabled !== undefined && typeof raw.enabled !== 'boolean') {
    errors.push(`Task ${n} slowMo.enabled must be true or false`)
  }
  if (raw.speed !== undefined) {
    const speed = Number(raw.speed)
    if (typeof raw.speed !== 'number' || !Number.isFinite(speed) || speed <= 0) {
      errors.push(`Task ${n} slowMo.speed must be a number of steps per second above 0`)
    } else if (speed < PYTHON_SLOW_MO_MIN_SPEED || speed > PYTHON_SLOW_MO_MAX_SPEED) {
      warnings.push(
        `Task ${n} slowMo.speed ${speed} is outside ${PYTHON_SLOW_MO_MIN_SPEED}–${PYTHON_SLOW_MO_MAX_SPEED} steps per second; it will be clamped`
      )
    }
  }
  if (raw.showVariables !== undefined && typeof raw.showVariables !== 'boolean') {
    errors.push(`Task ${n} slowMo.showVariables must be true or false`)
  }
  if (raw.separateButton !== undefined && typeof raw.separateButton !== 'boolean') {
    errors.push(`Task ${n} slowMo.separateButton must be true or false`)
  }
  if (raw.question !== undefined) {
    if (typeof raw.question !== 'string') {
      errors.push(`Task ${n} slowMo.question must be text`)
    } else if (raw.question.trim().length > PYTHON_SLOW_MO_QUESTION_CHARS) {
      warnings.push(
        `Task ${n} slowMo.question is over ${PYTHON_SLOW_MO_QUESTION_CHARS} characters; keep it to one short question`
      )
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
