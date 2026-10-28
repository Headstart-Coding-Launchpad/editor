// Learning Tree activity definition (pure). Wraps the logic in ./learning_tree.js in the
// activity contract (src/activities/defineActivity.js; docs/architecture/activities.md).
// Node-safe: no JSX, React or DOM imports (activityInterface.test.js checks).
//
// Privacy: the student's examples (a short item name, yes/no ticks and a label) are what the
// tutor needs to see, so `serializeShared` sends them. Nothing leaves the device otherwise; there
// is no AI model, the tree is plain maths in the browser.
import { defineActivity } from '../defineActivity.js'
import {
  DEFAULT_MAX_DEPTH,
  DEFAULT_MAX_EXAMPLES,
  featuresOf,
  gradeTask,
  hintFor,
  initialLearningTreeState,
  itemResultsOf,
  labelsOf,
  normalizeState,
  depthOf,
  maxDepthOf,
  sharedState,
  solutionFor,
  validateLearningTreeTask,
  validateLearningTreeWarnings,
} from './learning_tree.js'

function parse(raw) {
  if (raw == null || raw === '') return null
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export default defineActivity({
  id: 'learning_tree',
  label: 'Learning Tree',
  category: 'computing',
  icon: '🌳',
  description:
    'Give a tree labelled examples (has fur? can fly?) and watch it pick its own questions and draw itself, then try it on new things.',
  yaml: { type: 'learning_tree' },
  // Marked as you go: the task passes when the student presses Try it and the tree sorts enough
  // of the lesson's test items.
  completion: 'auto',
  passMessage: 'Your tree works!',

  // Plain buttons and toggles: works by mouse, trackpad or touch.
  touchFallback: 'equivalent',

  fields: {
    task: [
      {
        name: 'features',
        type: 'array',
        required: true,
        authored: true,
        description:
          'The yes/no features, 1 to 6 names such as has_fur. Underscores show as spaces and the tree asks "has fur?".',
      },
      {
        name: 'labels',
        type: 'array',
        required: true,
        authored: true,
        description: 'The labels an example can have, 2 to 6 names such as pet and wild.',
      },
      {
        name: 'testItems',
        type: 'array',
        required: true,
        authored: true,
        description:
          'Unseen items the tree is tested on (2 to 12). yes lists the features that are true for the item.',
        itemFields: [
          { name: 'name', type: 'string', required: true, authored: true },
          { name: 'yes', type: 'array', required: true, authored: true },
          { name: 'label', type: 'string', required: true, authored: true },
        ],
      },
      {
        name: 'maxExamples',
        type: 'number',
        description: `The most examples the student can add (4 to 40). Default ${DEFAULT_MAX_EXAMPLES}.`,
      },
      {
        name: 'maxDepth',
        type: 'number',
        description: `The most questions in a row the tree may ask (1 to 5). Default ${DEFAULT_MAX_DEPTH}.`,
      },
      {
        name: 'studentDepth',
        type: 'boolean',
        description:
          'Let the student set how many questions deep the tree goes, up to maxDepth. Default true; false hides the dial.',
      },
      {
        name: 'passAt',
        type: 'number',
        description:
          'How many test items the tree must sort right: a share above 0 and below 1 (0.8) or a whole number of items. Default 0.8 (4 of 5).',
      },
    ],
  },

  defaultTask: (prev = {}) => ({
    id: prev.id,
    title: prev.title ?? '',
    description: prev.description ?? '',
    taskType: 'activity',
    activityType: 'learning_tree',
    features: ['has_fur', 'can_fly', 'lives_in_water'],
    labels: ['pet', 'wild'],
    maxExamples: DEFAULT_MAX_EXAMPLES,
    maxDepth: DEFAULT_MAX_DEPTH,
    testItems: [
      { name: 'Hamster', yes: ['has_fur'], label: 'pet' },
      { name: 'Dog', yes: ['has_fur'], label: 'pet' },
      { name: 'Eagle', yes: ['can_fly'], label: 'wild' },
      { name: 'Shark', yes: ['lives_in_water'], label: 'wild' },
      { name: 'Goldfish', yes: ['lives_in_water'], label: 'pet' },
    ],
  }),

  validateTask: (task, { n } = {}) => ({
    errors: validateLearningTreeTask(task, n),
    warnings: validateLearningTreeWarnings(task, n),
  }),

  initialState: () => initialLearningTreeState(),

  solutionState: (task) => solutionFor(task),

  // The test items' labels are the answers.
  sealedFields: ['testItems'],

  // Nothing here changes per keystroke or pointer move: the item being typed lives in the view,
  // and only a finished example, a removal or Try it reaches the state.
  classifyChange: () => 'discrete',

  serialize: (state) => JSON.stringify(state ?? null),
  // The examples go to the tutor with the depth and score. Needs the task to tidy the state, which
  // the host passes through deserialize; here the state is already clean.
  serializeShared: (state) => JSON.stringify(state ?? null),
  deserialize: (raw, task) => normalizeState(task, parse(raw)),

  grade: (task, state) => {
    const graded = gradeTask(task, normalizeState(task, state))
    return {
      passed: graded.passed,
      suggestion: hintFor(task, normalizeState(task, state)),
      itemResults: itemResultsOf(task, normalizeState(task, state)),
    }
  },

  getProgress: (task, state) => {
    const g = gradeTask(task, normalizeState(task, state))
    return { kind: 'items', filled: g.correct, total: g.total, correct: g.correct }
  },

  // The tutor's card: examples, how deep the tree grew, and the test score once tried.
  summarize: (task, state) => {
    const g = gradeTask(task, normalizeState(task, state))
    if (g.count === 0) return { text: 'No examples yet', tone: 'neutral' }
    const chosen = depthOf(task, normalizeState(task, state))
    const cap = chosen < maxDepthOf(task) ? ` (set to ${chosen})` : ''
    const base = `${g.count} example${g.count === 1 ? '' : 's'} · depth ${g.depth}${cap}`
    if (!g.tried) return { text: `${base} · not tried yet`, tone: 'neutral' }
    return {
      text: `${base} · test ${g.correct}/${g.total}`,
      tone: g.passed ? 'success' : 'neutral',
    }
  },

  // The log keeps the examples with count, depth and score.
  buildSubmission: (task, state) => sharedState(task, state),

  report: {
    typeFields: () => ({ taskType: 'activity', activityType: 'learning_tree' }),
    normalizeSubmission: (task, submission) => {
      const raw = parse(submission)
      return raw ? normalizeState(task, raw) : null
    },
    // Each student's latest attempt: how many tried the test, how many passed, and the averages
    // of examples, tree depth and test score.
    summaryFields: (task, perStudent) => {
      let tried = 0
      let passed = 0
      let examples = 0
      let depth = 0
      let correct = 0
      let total = 0
      for (const t of perStudent ?? []) {
        const latest = t.distinctAttempts?.[t.distinctAttempts.length - 1]?.submission
        const state = normalizeState(task, typeof latest === 'object' ? latest : parse(latest))
        const g = gradeTask(task, state)
        if (!g.tried) continue
        tried += 1
        if (g.passed) passed += 1
        examples += g.count
        depth += g.depth
        correct += g.correct
        total += g.total
      }
      const avg = (sum) => (tried ? Number((sum / tried).toFixed(1)) : null)
      return {
        learningTreeResults: {
          triedCount: tried,
          passedCount: passed,
          avgExamples: avg(examples),
          avgDepth: avg(depth),
          avgScore: total ? Number((correct / total).toFixed(2)) : null,
        },
      }
    },
  },

  printHtml: (task, { esc }) => {
    const features = featuresOf(task)
      .map((f) => esc(f))
      .join(', ')
    const labels = labelsOf(task)
      .map((l) => esc(l))
      .join(', ')
    const items = Array.isArray(task.testItems) ? task.testItems.length : 0
    return `<ul><li>Yes/no features: ${features}</li><li>Labels: ${labels}</li><li>Tested on ${items} unseen items</li></ul>`
  },

  // The tutor can add and remove examples for the student (Edit answers); the tree redraws.
  previewState: 'initial',
})
