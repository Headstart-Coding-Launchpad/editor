// Classifier activity definition (pure). Wraps the logic in ./classifier.js in the
// activity contract (src/activities/defineActivity.js; docs/architecture/activities.md).
// Node-safe: no JSX, React or DOM imports (activityInterface.test.js checks).
//
// Privacy: the student's drawings are kept in the local state only. `serialize` (the device's
// own saved copy) holds them; `serializeShared` (what goes to Firebase, the teacher card, the
// attempt log and Go Live) holds counts, trained and the test result only.
import { defineActivity } from '../defineActivity.js'
import { roundSummaryText } from '../round.js'
import {
  accuracyOf,
  countsOf,
  gradeTask,
  initialClassifierState,
  itemResultsOf,
  liveCountOf,
  missesOf,
  normalizeClassifierState,
  panelsOf,
  percent,
  rightsOf,
  sharedState,
  solutionFor,
  taskLiveTestSize,
  taskMinExamples,
  testSetOf,
  validateClassifierTask,
  validateClassifierWarnings,
  DEFAULT_MIN_EXAMPLES,
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
    'Teach the pad a few things by drawing them, watch it guess live, then try to fool it and teach it the ones it gets wrong.',
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
        values: ['held_out', 'teacher', 'live'],
        description:
          "How it is tested. Default live: the round, where the student draws what the pad asks for and it guesses. Or held_out (the student's own kept-back drawings) or teacher (your test drawings), both with a Test button.",
      },
      {
        name: 'classes',
        type: 'array',
        description:
          'The things to teach (2 to 6; 3 is a good number). A name may start with an emoji, like "🐱 cat". Empty or missing: the student names 2 to 4 of their own.',
      },
      { name: 'minExamplesPerClass', type: 'number' },
      { name: 'targetAccuracy', type: 'number' },
      {
        name: 'liveTestSize',
        type: 'number',
        description: 'Live round: how many right answers make the round (3 to 20). Default 5.',
      },
      {
        name: 'panels',
        type: 'array',
        description:
          'Extra parts to show: grid (what it sees), sure (how sure is it), fool (fool it and fix it). Default [fool]. The pad, the teach step and the guess bars always show.',
      },
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
    classes: ['🐱 cat', '🐟 fish', '🚀 rocket'],
    minExamplesPerClass: DEFAULT_MIN_EXAMPLES,
    liveTestSize: 5,
    panels: ['fool'],
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
  // added or removed, Test, a try in the round) is discrete.
  classifyChange: (prev, next) => {
    const p = sharedState(prev)
    const q = sharedState(next)
    const onlyNames =
      !sameList(p.classes, q.classes) &&
      p.trained === q.trained &&
      p.liveCount === q.liveCount &&
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

  // Teaching: things with enough drawings. Then the round: right answers towards the goal.
  getProgress: (task, state) => {
    const { classesMet, classesTotal, live, core, rights } = gradeTask(task, state)
    const things = Math.max(classesTotal, MIN_CLASSES)
    const filled = classesMet + (live ? Math.min(rights, core) : 0)
    return { kind: 'items', filled, total: things + (live ? core : 0), correct: filled }
  },

  // The tutor's card: where the student is. Teaching: drawings per thing. Round: "3/5 right ·
  // +1 bonus · 2 missed". Kept-back / teacher tests: the percentage.
  summarize: (task, state) => {
    const graded = gradeTask(task, state)
    const counts = countsOf(state)
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0)
    if (total === 0) return { text: 'No drawings yet', tone: 'neutral' }
    const tone = graded.passed ? 'success' : 'neutral'
    if (!graded.ready) {
      const min = taskMinExamples(task)
      const text = (state.classes ?? [])
        .filter(Boolean)
        .map((label) => `${label} ${Math.min(counts[label] ?? 0, min)}/${min}`)
        .join(' · ')
      return { text: `Teaching: ${text}`, tone }
    }
    if (testSetOf(task) !== 'live') {
      return {
        text: state.result ? `${percent(state.result)}% on test` : `${total} drawings, ready`,
        tone,
      }
    }
    const rights = rightsOf(state)
    const core = taskLiveTestSize(task)
    const missed = missesOf(state)
    if (liveCountOf(state) === 0) return { text: `Ready: 0/${core} right`, tone }
    const text = roundSummaryText(rights, Math.max(core, rights), core, 'right')
    return { text: missed ? `${text} · ${missed} missed` : text, tone }
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
        if (gradeTask(task, normalizeClassifierState(task, state)).passed) atTarget += 1
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
      testSetOf(task) === 'teacher'
        ? `${teacherTestItems(task).length} teacher test drawings`
        : testSetOf(task) === 'live'
          ? `a round: ${taskLiveTestSize(task)} right answers to drawings the pad asks for`
          : "the student's own kept-back drawings"
    const target = Math.round(
      (typeof task.targetAccuracy === 'number' ? task.targetAccuracy : 0.8) * 100
    )
    return `<ul><li>Classes: ${classes}</li><li>Drawings per class: at least ${esc(String(taskMinExamples(task)))}</li><li>Tested on: ${esc(testText)}</li>${testSetOf(task) === 'live' ? '' : `<li>Target accuracy: ${target}%</li>`}<li>Extra parts: ${esc(panelsOf(task).join(', ') || 'none')}</li></ul>`
  },

  // The teacher sees the work as it happens but cannot type into the student's model (the
  // drawings are on the student's device), so there is no Edit answers.
  teacherEditable: false,
  previewState: 'initial',
})
