// Activity contract. An activity is a bounded exercise that can sit anywhere in a lesson (quiz
// sub-types, code_arrange, Binary, Keyboard, Mouse). Each activity has a pure definition.js
// (this contract; imported by the CLI, validation, reports and print) and a separate UI part.
// See docs/architecture/modular-activities-plan.md ("Activity contract").
//
// Pure: no JSX, React or DOM.

import { normaliseFieldSpecs } from '../shared/fieldSpec.js'

export const ACTIVITY_CATEGORIES = ['quiz', 'code', 'computing', 'digital_skills']
export const COMPLETION_MODES = ['on_submit', 'auto', 'none']
export const ACTIVITY_STATE_FILENAME = '__activity_state__'

const REQUIRED_FUNCTIONS = ['defaultTask', 'validateTask', 'initialState', 'grade']

function fail(id, message) {
  throw new Error(`defineActivity(${id ?? '?'}): ${message}`)
}

const jsonSerialize = (state) => JSON.stringify(state ?? null)

// Session reports read the attempt log, where a submission is stored as JSON text: show it as
// the structured state again (anything that isn't a JSON object or array is kept as it is).
function parseJsonSubmission(task, submission) {
  if (typeof submission !== 'string' || !submission) return submission ?? null
  try {
    const parsed = JSON.parse(submission)
    return parsed && typeof parsed === 'object' ? parsed : submission
  } catch {
    return submission
  }
}

// `fields` (optional) declares the activity's authored task shape as data (see
// ../shared/fieldSpec.js), so `lessons capabilities` and the docs checks read it instead of prose:
//   fields: {
//     modeField?: 'mode',   // the task field whose `values` are the activity's modes
//     task: [FieldSpec],    // task-level fields besides title/description/explainer/hint
//   }
// Tests check that every `required` field really is required by validateTask.
function normaliseFields(id, fields) {
  if (fields == null) return null
  if (typeof fields !== 'object') fail(id, 'fields must be an object')
  const modeField = fields.modeField ?? null
  const modeSpec = modeField ? (fields.task ?? []).find((f) => f.name === modeField) : null
  if (modeField && !modeSpec?.values?.length) {
    fail(id, `fields.modeField "${modeField}" must name a task field with values`)
  }
  const modes = modeSpec ? [...modeSpec.values] : []
  const task = normaliseFieldSpecs(fields.task ?? [], {
    where: 'fields.task',
    modes,
    fail: (message) => new Error(`defineActivity(${id}): ${message}`),
  })
  return Object.freeze({ modeField, modes: Object.freeze(modes), task })
}

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

  // Defaults keep simple activities small. Legacy quiz definitions (src/activities/quiz/
  // quizActivity.js) override serialize/deserialize to keep the currentAnswer formats already
  // in use.
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
    // Task fields that give the answer away, sealed at the Firestore boundary on top of the
    // shared list (check, feedbackChecks, tests, codeStages, complete*): src/shared/lessonSeal.js.
    sealedFields: [],
    serialize: jsonSerialize,
    storage: { persist: true, filename: ACTIVITY_STATE_FILENAME },
    liveChannel: 'answer',
    // (prev, next, task) → 'discrete' | 'continuous' (see useActivityState's write rules).
    classifyChange: () => 'discrete',
    isGraded: () => true,
    // true when the teacher may show a student's answer on the presentation window
    // (src/shared/shownResponses.js): open short answers with `showResponses: teacher_picks`.
    // Graded answers are never broadcast.
    showsResponses: () => false,
    checks: [],
    buildSubmission: (task, state) => state,
    getProgress: () => null,
    summarize: () => null,
    teacherEditable: true,
    // true when the UI decides itself when an answer is final and calls onSubmit(state) (the
    // quizzes: an option chosen, every tile placed). The host then never auto-submits on
    // change, and a teacher's edit is marked only on those submits.
    submitsAnswers: false,
    // What the teacher's own task panel shows: the answers ('solution') or the blank task
    // ('initial', for quizzes, whose teacher screen is often projected).
    previewState: 'solution',
    report: {
      typeFields: () => ({ taskType: 'activity', activityType: id }),
      normalizeSubmission: parseJsonSubmission,
      // Extra per-task summary fields for the session report (e.g. the confidence rating
      // distribution, per-blank failures).
      summaryFields: () => ({}),
    },
    printHtml: null,
    ...def,
    fields: normaliseFields(id, def.fields),
    completion,
    deserialize,
  })
}
