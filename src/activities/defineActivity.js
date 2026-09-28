// Activity contract. An activity is a bounded exercise that can sit anywhere in a lesson (quiz
// sub-types, code_arrange, Binary, Keyboard, Mouse). Each activity has a pure definition.js
// (this contract; imported by the CLI, validation, reports and print) and a separate UI part.
// See docs/architecture/modular-activities-plan.md ("Activity contract").
//
// Pure: no JSX, React or DOM.

export const ACTIVITY_CATEGORIES = ['quiz', 'code', 'computing', 'digital_skills']
export const COMPLETION_MODES = ['on_submit', 'auto', 'none']
export const ACTIVITY_STATE_FILENAME = '__activity_state__'

const REQUIRED_FUNCTIONS = ['defaultTask', 'validateTask', 'initialState', 'grade']

function fail(id, message) {
  throw new Error(`defineActivity(${id ?? '?'}): ${message}`)
}

const jsonSerialize = (state) => JSON.stringify(state ?? null)

export function defineActivity(def) {
  if (!def || typeof def !== 'object') fail(undefined, 'definition must be an object')
  const { id } = def
  if (typeof id !== 'string' || !/^[a-z][a-z0-9_]*$/.test(id)) {
    fail(id, 'id must be a lowercase identifier (letters, digits, underscores)')
  }
  if (typeof def.label !== 'string' || !def.label) fail(id, 'missing required string "label"')
  if (!ACTIVITY_CATEGORIES.includes(def.category)) {
    fail(id, `category must be one of ${ACTIVITY_CATEGORIES.join(', ')}`)
  }
  for (const key of REQUIRED_FUNCTIONS) {
    if (typeof def[key] !== 'function') fail(id, `missing required function "${key}"`)
  }
  const completion = def.completion ?? 'on_submit'
  if (!COMPLETION_MODES.includes(completion)) {
    fail(id, `completion must be one of ${COMPLETION_MODES.join(', ')}`)
  }

  // Defaults keep simple activities small; legacy quiz definitions override storage and
  // liveChannel to match the formats already in use.
  const deserialize =
    def.deserialize ??
    ((raw, task) => {
      if (raw == null || raw === '') return def.initialState(task)
      try {
        return JSON.parse(raw) ?? def.initialState(task)
      } catch {
        return def.initialState(task)
      }
    })

  return Object.freeze({
    icon: '',
    description: '',
    legacy: null,
    yaml: { type: id },
    availableIn: () => true,
    hostModules: null,
    requires: {},
    touchFallback: 'equivalent',
    solutionState: null,
    serialize: jsonSerialize,
    storage: { persist: true, filename: ACTIVITY_STATE_FILENAME },
    liveChannel: 'answer',
    classifyChange: () => 'discrete',
    isGraded: () => true,
    checks: [],
    buildSubmission: (task, state) => state,
    getProgress: () => null,
    summarize: () => null,
    teacherEditable: true,
    report: {
      typeFields: () => ({ taskType: 'activity', activityType: id }),
      normalizeSubmission: (task, submission) => submission,
    },
    printHtml: null,
    ...def,
    completion,
    deserialize,
  })
}
