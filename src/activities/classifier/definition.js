// Classifier activity definition (pure). Wraps the logic in ./classifier.js in the
// activity contract (src/activities/defineActivity.js; docs/architecture/activities.md).
// Node-safe: no JSX, React or DOM imports (activityInterface.test.js checks).
//
// Privacy: the student's drawings are kept in the local state only. `serialize` (the device's
// own saved copy) holds them and the raw strokes; `serializeShared` (what goes to Firebase, the
// teacher card, the attempt log and Go Live) holds counts, tries, rights, misses and the test
// result, plus the pad now and the last 3 misses as 16 x 16 grids only (so the tutor can watch).
import { defineActivity } from '../defineActivity.js'
import { roundSummaryText } from '../round.js'
import {
  accuracyOf,
  classifierBadgeResult,
  countsOf,
  givenCountOf,
  hasGiven,
  ownCountsOf,
  gradeTask,
  initialClassifierState,
  itemResultsOf,
  liveCountOf,
  gridSizeOf,
  minClassesOf,
  normalizeClassifierState,
  notThingOf,
  selftestOf,
  unsureOf,
  GRID_SIZES,
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
  // Marked as you go: the task passes when the round's tries reach the core.
  completion: 'auto',
  // Shown instead of "Correct!" when the task passes (the pad can have got some wrong).
  passMessage: 'Round done!',

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
          'The things to teach (2 to 6; 3 is a good number; 1 is allowed in the live round, and the model then answers the thing or "not a <thing>"). A name may start with an emoji, like "🐱 cat". Empty or missing: the student names 2 to 4 of their own.',
      },
      {
        name: 'gridSize',
        type: 'number',
        values: GRID_SIZES,
        description:
          'The grid the model looks at: 4, 8 or 16 (default 16). With the gridsize panel this is the starting size and the student can pick 4, 8 or 16.',
      },
      { name: 'minExamplesPerClass', type: 'number' },
      { name: 'targetAccuracy', type: 'number' },
      {
        name: 'liveTestSize',
        type: 'number',
        description:
          'Live round: how many tries make the round (3 to 20), counted whether the pad gets them right or wrong. Default 5.',
      },
      {
        name: 'panels',
        type: 'array',
        description:
          'Extra parts to show: grid (what it sees), sure (how sure is it), fool (fool it and fix it), gridsize (student picks the grid size), close (how-close meter against the cut-off), unsure (a "not sure" answer), selftest (Test on what it learned). Default [fool]. The pad, the teach step and the guess bars always show.',
      },
      {
        name: 'examples',
        type: 'array',
        authored: true,
        description:
          'Pre-loaded drawings the pad has learned before the student draws anything (public, not sealed). Each is { label, grid | strokes }; label is one of the classes. They count towards minExamplesPerClass, the student cannot delete them and can add their own on top.',
        itemFields: [
          { name: 'label', type: 'string', required: true, authored: true },
          { name: 'strokes', type: 'array', authored: true },
          { name: 'grid', type: 'array', authored: true },
        ],
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
  // The given (pre-loaded) examples come from the task, so they are not saved.
  serialize: (state) => {
    if (!state || typeof state !== 'object') return JSON.stringify(state ?? null)
    // eslint-disable-next-line no-unused-vars
    const { given, ...own } = state
    return JSON.stringify(own)
  },
  // What is written to Firebase: counts, tries, rights, misses, the result, the pad now and the
  // last 3 misses as grids. Never the strokes or the taught drawings.
  serializeShared: (state) => JSON.stringify(sharedState(state)),
  // Reads either form.
  deserialize: (raw, task) => normalizeClassifierState(task, parse(raw)),

  // The test drawings' labels give the answers away (they are the model's "exam").
  sealedFields: ['testItems'],

  // A drawing lives in the pad until the student adds it, so nothing changes per pointer
  // move. Typing a class name and the pad's grid at each stroke end are the frequent changes
  // (continuous); everything else (a drawing added or removed, Test, a try in the round) is
  // discrete.
  classifyChange: (prev, next) => {
    const p = sharedState(prev)
    const q = sharedState(next)
    const same =
      p.trained === q.trained &&
      p.gridSize === q.gridSize &&
      JSON.stringify(p.selftest) === JSON.stringify(q.selftest) &&
      p.unsure === q.unsure &&
      p.notThing === q.notThing &&
      p.liveCount === q.liveCount &&
      p.rights === q.rights &&
      JSON.stringify(p.result) === JSON.stringify(q.result) &&
      JSON.stringify(p.recent) === JSON.stringify(q.recent) &&
      sum(p.counts) === sum(q.counts)
    const onlyNames = !sameList(p.classes, q.classes) && same
    const onlyPad =
      sameList(p.classes, q.classes) && same && (p.pad !== q.pad || p.target !== q.target)
    return onlyNames || onlyPad ? 'continuous' : 'discrete'
  },

  grade: (task, state) => {
    const graded = gradeTask(task, state)
    return {
      passed: graded.passed,
      suggestion: graded.hint,
      itemResults: itemResultsOf(task, state),
    }
  },

  // Teaching: things with enough drawings. Then the round: tries towards the goal.
  getProgress: (task, state) => {
    const { classesMet, classesTotal, live, core, tries } = gradeTask(task, state)
    const things = Math.max(classesTotal, minClassesOf(state))
    const filled = classesMet + (live ? Math.min(tries, core) : 0)
    return { kind: 'items', filled, total: things + (live ? core : 0), correct: filled }
  },

  // The tutor's card: where the student is. Teaching: drawings per thing. Round: "5/5 tried ·
  // 4 right" (+ bonus tries after the core). Kept-back / teacher tests: the percentage.
  summarize: (task, state) => {
    const graded = gradeTask(task, state)
    const counts = countsOf(state)
    const own = ownCountsOf(state)
    const given = hasGiven(state)
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0)
    const ownTotal = Object.values(own).reduce((sum, n) => sum + n, 0)
    if (total === 0) return { text: 'No drawings yet', tone: 'neutral' }
    const tone = graded.passed ? 'success' : 'neutral'
    if (!graded.ready) {
      const min = taskMinExamples(task)
      const text = (state.classes ?? [])
        .filter(Boolean)
        .map((label) =>
          given
            ? `${label} ${givenCountOf(state, label)} given + ${own[label] ?? 0} own`
            : `${label} ${Math.min(counts[label] ?? 0, min)}/${min}`
        )
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
    const tries = liveCountOf(state)
    const ownNote = given ? ` · ${ownTotal} own drawings` : ''
    // New in AI Level 1: grid size (gridsize panel), the self-test next to the real score, and how
    // many tries came back "not sure" / "not a <thing>".
    const extras = []
    if (panelsOf(task).includes('gridsize')) extras.push(`grid ${gridSizeOf(task, state)}`)
    const self = selftestOf(state)
    if (self) extras.push(`own test ${self.right}/${self.total}`)
    if (unsureOf(state)) extras.push(`${unsureOf(state)} not sure`)
    if (notThingOf(state))
      extras.push(`${notThingOf(state)} not a ${(state.classes ?? [])[0] ?? 'thing'}`)
    const tail = extras.length ? ` · ${extras.join(' · ')}` : ''
    if (tries === 0) return { text: `Ready: 0/${core} tried${ownNote}${tail}`, tone }
    const text = roundSummaryText(tries, Math.max(core, tries), core, 'tried')
    return { text: `${text} · ${rights} right${ownNote}${tail}`, tone }
  },

  // The log keeps the shared form: counts, trained and the result, never the drawings.
  buildSubmission: (task, state) => sharedState(state),

  // Live badges: Perfect Round, AI Fooler, AI Trainer (src/badges/definitions).
  badgeResult: (task, state) => classifierBadgeResult(task, state),

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
      // Per student (latest attempt): the grid size they finished on, the self-test next to the
      // round score, and the tries that came back "not sure" / "not a <thing>".
      const gridSizes = {}
      let selfTested = 0
      let unsureTries = 0
      let notThingTries = 0
      const target = typeof task?.targetAccuracy === 'number' ? task.targetAccuracy : 0.8
      for (const t of perStudent ?? []) {
        const latest = t.distinctAttempts?.[t.distinctAttempts.length - 1]?.submission
        const state = latest && typeof latest === 'object' ? latest : parse(latest)
        const norm = normalizeClassifierState(task, state)
        gridSizes[gridSizeOf(task, norm)] = (gridSizes[gridSizeOf(task, norm)] ?? 0) + 1
        if (selftestOf(norm)) selfTested += 1
        unsureTries += unsureOf(norm)
        notThingTries += notThingOf(norm)
        const result = norm.result
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
          gridSizes,
          selfTestedCount: selfTested,
          unsureTries,
          notThingTries,
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
          ? `a round: ${taskLiveTestSize(task)} tries at drawing something and seeing if the pad gets it`
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
