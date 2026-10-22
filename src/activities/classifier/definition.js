// Classifier activity definition (pure). Wraps the logic in ./classifier.js in the
// activity contract (src/activities/defineActivity.js; docs/architecture/activities.md).
// Node-safe: no JSX, React or DOM imports (activityInterface.test.js checks).
//
// Privacy: the student's drawings are kept in the local state only. `serialize` (the device's
// own saved copy) holds them; `serializeShared` (what goes to Firebase, the teacher card, the
// attempt log and Go Live) holds counts, trained and the test result only.
import { defineActivity } from '../defineActivity.js'
import {
  accuracyOf,
  countsOf,
  gradeTask,
  initialClassifierState,
  itemResultsOf,
  normalizeClassifierState,
  percent,
  sharedState,
  solutionFor,
  validateClassifierTask,
  validateClassifierWarnings,
  MIN_CLASSES,
  teacherTestItems,
} from './classifier.js'

function parse(raw) {
  if (raw == null || raw === '') return null
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const sum = (counts) => Object.values(counts).reduce((total, n) => total + n, 0)
const sameList = (a, b) => a.length === b.length && a.every((v, i) => v === b[i])

export default defineActivity({
  id: 'classifier',
  label: 'Classifier',
  category: 'computing',
  icon: '🧠',
  description:
    'Draw examples of each class, train a model, then test it on drawings it has not seen and see how accurate it is.',
  yaml: { type: 'classifier' },

  fields: {
    modeField: 'mode',
    task: [
      {
        name: 'mode',
        type: 'string',
        required: true,
        values: ['drawing'],
        description: 'What the student collects. Only drawing is built (sound is not built yet).',
      },
      {
        name: 'testSet',
        type: 'string',
        required: true,
        values: ['held_out', 'teacher', 'live'],
        description:
          "What the model is tested on: the student's own kept-back drawings, the teacher's test drawings, or new drawings made during the test.",
      },
      {
        name: 'classes',
        type: 'array',
        description: 'The class names (2 to 6). Empty or missing: the student names their own.',
      },
      { name: 'minExamplesPerClass', type: 'number' },
      { name: 'targetAccuracy', type: 'number' },
      { name: 'liveTestSize', type: 'number' },
      {
        name: 'testItems',
        type: 'array',
        authored: true,
        description: 'testSet teacher only: the test drawings.',
        itemFields: [
          { name: 'label', type: 'string', required: true, authored: true },
          { name: 'strokes', type: 'array', authored: true },
          { name: 'grid', type: 'array', authored: true },
        ],
      },
    ],
  },

  defaultTask: (prev = {}) => ({
    id: prev.id,
    title: prev.title ?? '',
    description: prev.description ?? '',
    taskType: 'activity',
    activityType: 'classifier',
    mode: 'drawing',
    classes: ['circle', 'square'],
    minExamplesPerClass: 8,
    testSet: 'held_out',
    targetAccuracy: 0.8,
  }),

  validateTask: (task, { n } = {}) => ({
    errors: validateClassifierTask(task, n),
    warnings: validateClassifierWarnings(task, n),
  }),

  initialState: (task) => initialClassifierState(task),

  // A finished model summary (the real drawings are the student's own and can't be invented).
  solutionState: (task) => normalizeClassifierState(task, solutionFor(task)),

  // The device's own copy: drawings included.
  serialize: (state) => JSON.stringify(state ?? null),
  // What is written to Firebase: counts, trained and the test result. Never the drawings.
  serializeShared: (state) => JSON.stringify(sharedState(state)),
  // Reads either form.
  deserialize: (raw, task) => normalizeClassifierState(task, parse(raw)),

  // The test drawings' labels give the answers away (they are the model's "exam").
  sealedFields: ['testItems'],

  // A drawing lives in the pad until the student adds it, so nothing changes per pointer
  // move. Typing a class name is the only per-keystroke change; everything else (a drawing
  // added or removed, Train, Test, a live test drawing) is discrete.
  classifyChange: (prev, next) => {
    const p = sharedState(prev)
    const q = sharedState(next)
    const onlyNames =
      !sameList(p.classes, q.classes) &&
      p.trained === q.trained &&
      JSON.stringify(p.result) === JSON.stringify(q.result) &&
      sum(p.counts) === sum(q.counts)
    return onlyNames ? 'continuous' : 'discrete'
  },

  grade: (task, state) => {
    const graded = gradeTask(task, state)
    return {
      passed: graded.passed,
      suggestion: graded.hint,
      itemResults: itemResultsOf(task, state),
    }
  },

  // Per class: has it enough drawings?
  getProgress: (task, state) => {
    const { classesMet, classesTotal } = gradeTask(task, state)
    return {
      kind: 'items',
      filled: classesMet,
      total: Math.max(classesTotal, MIN_CLASSES),
      correct: classesMet,
    }
  },

  summarize: (task, state) => {
    const graded = gradeTask(task, state)
    const total = Object.values(countsOf(state)).reduce((sum, n) => sum + n, 0)
    if (total === 0) return { text: 'No drawings yet', tone: 'neutral' }
    const status = state.result
      ? `${percent(state.result)}% on test`
      : state.trained
        ? 'trained'
        : 'not trained'
    return { text: `${total} drawings, ${status}`, tone: graded.passed ? 'success' : 'neutral' }
  },

  // The log keeps the shared form: counts, trained and the result, never the drawings.
  buildSubmission: (task, state) => sharedState(state),

  report: {
    typeFields: () => ({ taskType: 'activity', activityType: 'classifier' }),
    normalizeSubmission: (task, submission) => {
      const raw = parse(submission)
      return raw ? normalizeClassifierState(task, raw) : null
    },
    // Each student's latest attempt: how many reached a test, the average accuracy and the
    // confusion counts added up across the class (actual class -> predicted class -> count).
    summaryFields: (task, perStudent) => {
      let tested = 0
      let atTarget = 0
      let sum = 0
      const confusion = {}
      const target = typeof task?.targetAccuracy === 'number' ? task.targetAccuracy : 0.8
      for (const t of perStudent ?? []) {
        const latest = t.distinctAttempts?.[t.distinctAttempts.length - 1]?.submission
        const state = latest && typeof latest === 'object' ? latest : parse(latest)
        const result = normalizeClassifierState(task, state).result
        const accuracy = accuracyOf(result)
        if (accuracy == null) continue
        tested += 1
        sum += accuracy
        if (accuracy + 1e-9 >= target) atTarget += 1
        for (const [actual, row] of Object.entries(result.confusion)) {
          confusion[actual] = confusion[actual] ?? {}
          for (const [pred, count] of Object.entries(row)) {
            confusion[actual][pred] = (confusion[actual][pred] ?? 0) + count
          }
        }
      }
      return {
        classifierResults: {
          testedCount: tested,
          atTargetCount: atTarget,
          targetAccuracy: target,
          avgAccuracy: tested ? Number((sum / tested).toFixed(2)) : null,
          confusion,
        },
      }
    },
  },

  printHtml: (task, { esc }) => {
    const classes = (task.classes ?? []).length
      ? (task.classes ?? []).map((label) => esc(label)).join(', ')
      : 'the student names their own'
    const testText =
      task.testSet === 'teacher'
        ? `${teacherTestItems(task).length} teacher test drawings`
        : task.testSet === 'live'
          ? 'new drawings made during the test'
          : "the student's own kept-back drawings"
    const target = Math.round(
      (typeof task.targetAccuracy === 'number' ? task.targetAccuracy : 0.8) * 100
    )
    return `<ul><li>Classes: ${classes}</li><li>Drawings per class: at least ${esc(String(task.minExamplesPerClass ?? 6))}</li><li>Tested on: ${esc(testText)}</li><li>Target accuracy: ${target}%</li></ul>`
  },

  // The teacher sees the work as it happens but cannot type into the student's model (the
  // drawings are on the student's device), so there is no Edit answers.
  teacherEditable: false,
  previewState: 'initial',
})
