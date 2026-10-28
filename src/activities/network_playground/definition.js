// Network Playground activity definition (pure). Wraps the logic in ./network_playground.js in the
// activity contract (src/activities/defineActivity.js; docs/architecture/activities.md).
// Node-safe: no JSX, React or DOM imports (activityInterface.test.js checks).
//
// Sync: the dots are made from the task, so the state holds only the layers, the scores and the
// network's numbers (about 100 of them). While the network trains, the state is updated at most
// every 2 seconds and those updates are 'continuous' (only streamed while the tutor watches this
// student). Starting, stopping, changing the layers, a reset and passing are 'discrete'.
import { defineActivity } from '../defineActivity.js'
import {
  DATASET_LABELS,
  DEFAULT_MAX_NEURONS,
  DEFAULT_TARGET,
  allowAddLayerOf,
  allowInputsOf,
  allowZeroLayersOf,
  datasetOf,
  inputsText,
  testDotsOf,
  gradeTask,
  initialNetworkState,
  maxNeuronsOf,
  normalizeNetworkState,
  percent,
  solutionFor,
  startLayersOf,
  targetOf,
  validateNetworkPlaygroundTask,
} from './network_playground.js'

function parse(raw) {
  if (raw == null || raw === '') return null
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// The state read from the device copy or the shared copy. Never "training" after a reload.
const read = (task, raw) => ({ ...normalizeNetworkState(task, parse(raw)), training: false })

const sameList = (a, b) => a.length === b.length && a.every((v, i) => v === b[i])

export default defineActivity({
  id: 'network_playground',
  label: 'Network Playground',
  category: 'computing',
  icon: '🕸️',
  description:
    'Watch a tiny neural network learn to sort orange and blue dots, then add neurons and layers until it cracks a harder pattern.',
  yaml: { type: 'network_playground' },
  // Marked as you go: the task passes when the network's accuracy reaches the target.
  completion: 'auto',
  passMessage: 'Your network did it!',

  fields: {
    task: [
      {
        name: 'dataset',
        type: 'string',
        required: true,
        values: ['two_blobs', 'circle', 'spiral'],
        description:
          'The dots to sort. two_blobs is easy, circle needs a hidden layer, spiral needs two.',
      },
      {
        name: 'layers',
        type: 'array',
        description:
          'The hidden layers the network starts with, as neurons per layer (1 or 2 layers). Default [3].',
      },
      {
        name: 'maxNeurons',
        type: 'number',
        description: `Most neurons the student can put in one layer (1 to 8). Default ${DEFAULT_MAX_NEURONS}.`,
      },
      {
        name: 'allowAddLayer',
        type: 'boolean',
        description:
          'Show the Add a layer button (up to 2 hidden layers). Default true. False: the student can only change the neurons.',
      },
      {
        name: 'inputs',
        type: 'array',
        description:
          'The inputs the network starts with, from x, y, x2 (x squared) and y2 (y squared). Default [x, y].',
      },
      {
        name: 'allowInputs',
        type: 'array',
        description:
          'The inputs the student may switch on and off (a subset of x, y, x2, y2). The network is rebuilt when they change one. Leave out for fixed inputs.',
      },
      {
        name: 'allowZeroLayers',
        type: 'boolean',
        description:
          'Let the student remove every hidden layer, so the inputs go straight to the output. Default false.',
      },
      {
        name: 'testDots',
        type: 'boolean',
        description:
          'Show Try new dots: it scores 80 fresh dots from the same pattern and shows New dots: N% right beside the training score. Does not change passing. Default false.',
      },
      {
        name: 'target',
        type: 'number',
        description: `Accuracy to pass, above 0.5 and up to 1. Default ${DEFAULT_TARGET}.`,
      },
    ],
  },

  defaultTask: (prev = {}) => ({
    id: prev.id,
    title: prev.title ?? '',
    description: prev.description ?? '',
    taskType: 'activity',
    activityType: 'network_playground',
    dataset: 'circle',
    layers: [3],
    allowAddLayer: true,
    maxNeurons: DEFAULT_MAX_NEURONS,
    target: DEFAULT_TARGET,
  }),

  validateTask: (task, { n } = {}) => ({
    errors: validateNetworkPlaygroundTask(task, n),
    warnings: [],
  }),

  initialState: (task) => ({ ...initialNetworkState(task), training: false }),
  solutionState: (task) => ({ ...solutionFor(task), training: false }),
  deserialize: (raw, task) => read(task, raw),

  // Start, stop, new layers, a reset and passing are discrete (written to Firebase whatever the
  // tutor is watching); the updates while training are continuous.
  classifyChange: (prev, next, task) => {
    const a = normalizeNetworkState(task, prev)
    const b = normalizeNetworkState(task, next)
    const discrete =
      !sameList(a.layers, b.layers) ||
      Boolean(prev?.training) !== Boolean(next?.training) ||
      !sameList(a.inputs, b.inputs) ||
      b.epochs < a.epochs ||
      (a.test == null) !== (b.test == null) ||
      a.acc >= targetOf(task) !== b.acc >= targetOf(task)
    return discrete ? 'discrete' : 'continuous'
  },

  grade: (task, state) => {
    const graded = gradeTask(task, state)
    return { passed: graded.passed, suggestion: graded.hint, itemResults: {} }
  },

  // Ten steps from nothing to the target.
  getProgress: (task, state) => {
    const { acc, target, passed } = gradeTask(task, state)
    const filled = passed ? 10 : Math.min(9, Math.floor((Math.min(acc, target) / target) * 10))
    return { kind: 'items', filled, total: 10, correct: filled }
  },

  summarize: (task, state) => {
    const graded = gradeTask(task, state)
    const s = normalizeNetworkState(task, state)
    if (s.epochs === 0 && !graded.passed) return { text: 'Not trained yet', tone: 'neutral' }
    const layers = `${graded.layers} layer${graded.layers === 1 ? '' : 's'}`
    const best = graded.best > graded.acc ? ` · best ${percent(graded.best)}%` : ''
    const mode = state?.training ? 'Training · ' : ''
    const shape = s.layers.length ? s.layers.join('+') : 'none'
    const inputs = allowInputsOf(task).length ? ` · inputs ${inputsText(s.inputs)}` : ''
    const fresh = testDotsOf(task) && s.test != null ? ` · new dots ${percent(s.test)}%` : ''
    return {
      text: `${mode}${percent(graded.acc)}% · ${layers} (${shape})${inputs}${best}${fresh}`,
      tone: graded.passed ? 'success' : 'neutral',
    }
  },

  // The attempt log keeps the scores and layers, never the network's numbers.
  buildSubmission: (task, state) => {
    const { layers, inputs, test, acc, best, epochs, maxLayers } = normalizeNetworkState(
      task,
      state
    )
    return { v: 1, layers, inputs, test, acc, best, epochs, maxLayers }
  },

  report: {
    typeFields: () => ({ taskType: 'activity', activityType: 'network_playground' }),
    normalizeSubmission: (task, submission) => {
      const raw = parse(submission)
      return raw ? normalizeNetworkState(task, raw) : null
    },
    // Each student's latest attempt: how many reached the target, the average final and best
    // accuracy, and the average most layers used.
    summaryFields: (task, perStudent) => {
      let count = 0
      let passedCount = 0
      let accSum = 0
      let bestSum = 0
      let layerSum = 0
      let testSum = 0
      let testCount = 0
      const inputCounts = {}
      for (const t of perStudent ?? []) {
        const latest = t.distinctAttempts?.[t.distinctAttempts.length - 1]?.submission
        if (latest == null) continue
        const s = normalizeNetworkState(task, parse(latest))
        count += 1
        accSum += s.acc
        bestSum += s.best
        layerSum += s.maxLayers
        for (const id of s.inputs) inputCounts[id] = (inputCounts[id] ?? 0) + 1
        if (s.test != null) {
          testSum += s.test
          testCount += 1
        }
        if (s.acc >= targetOf(task)) passedCount += 1
      }
      const avg = (sum, digits) => (count ? Number((sum / count).toFixed(digits)) : null)
      return {
        networkResults: {
          count,
          passedCount,
          target: targetOf(task),
          avgAccuracy: avg(accSum, 2),
          avgBestAccuracy: avg(bestSum, 2),
          avgLayersUsed: avg(layerSum, 1),
          ...(allowInputsOf(task).length ? { inputCounts } : {}),
          ...(testDotsOf(task)
            ? { avgNewDots: testCount ? Number((testSum / testCount).toFixed(2)) : null }
            : {}),
        },
      }
    },
  },

  printHtml: (task) => {
    const layers = startLayersOf(task).join(', ') || 'none'
    const extras = `${allowInputsOf(task).length ? `<li>Student can switch inputs: ${inputsText(allowInputsOf(task))}</li>` : ''}${allowZeroLayersOf(task) ? '<li>Can remove all hidden layers</li>' : ''}${testDotsOf(task) ? '<li>Can try new dots</li>' : ''}`
    return `<ul><li>Dots: ${DATASET_LABELS[datasetOf(task)]}</li><li>Starts with hidden layers of: ${layers} neurons</li><li>Up to ${maxNeuronsOf(task)} neurons a layer${allowAddLayerOf(task) ? ', can add a layer' : ''}</li>${extras}<li>Target accuracy: ${percent(targetOf(task))}%</li></ul>`
  },

  // The tutor watches the network train; there is nothing to type into, so no Edit answers.
  teacherEditable: false,
  previewState: 'initial',
})
