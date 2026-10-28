// Recommender activity definition (pure). Wraps the logic in ./recommender.js in the
// activity contract (src/activities/defineActivity.js; docs/architecture/activities.md).
// Node-safe: no JSX, React or DOM imports (activityInterface.test.js checks).
import { defineActivity } from '../defineActivity.js'
import {
  bubbleInfo,
  feedKinds,
  generateRaters,
  gradeTask,
  needsWhy,
  ratedCount,
  recommend,
  summaryText,
  validateRecommender,
} from './recommender.js'

function parseSubmission(submission) {
  if (submission && typeof submission === 'object') return submission
  if (typeof submission !== 'string' || !submission) return null
  try {
    const parsed = JSON.parse(submission)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

const STARTER = [
  ['football', '⚽', 'Football', 'sport'],
  ['swimming', '🏊', 'Swimming', 'sport'],
  ['tennis', '🎾', 'Tennis', 'sport'],
  ['cat', '🐱', 'Cats', 'animals'],
  ['dog', '🐶', 'Dogs', 'animals'],
  ['frog', '🐸', 'Frogs', 'animals'],
  ['guitar', '🎸', 'Guitar', 'music'],
  ['drums', '🥁', 'Drums', 'music'],
  ['piano', '🎹', 'Piano', 'music'],
  ['pizza', '🍕', 'Pizza', 'food'],
  ['icecream', '🍦', 'Ice cream', 'food'],
  ['pancakes', '🥞', 'Pancakes', 'food'],
].map(([id, emoji, label, group]) => ({ id, emoji, label, group }))

export default defineActivity({
  id: 'recommender',
  label: 'Recommender',
  category: 'computing',
  icon: '👍',
  description:
    'Rate things with a thumbs up or down and watch your own feed change. See why it picked each one, and watch the bubble close in.',
  yaml: { type: 'recommender' },

  // Buttons only: works with mouse, touch and keyboard.
  requires: {},
  touchFallback: 'equivalent',

  // Marked as you go: passes once enough items are rated and a Why? was opened.
  completion: 'auto',
  passMessage: 'Feed built!',

  fields: {
    task: [
      {
        name: 'items',
        type: 'array',
        required: true,
        authored: true,
        itemFields: [
          { name: 'id', type: 'string', required: true },
          { name: 'emoji', type: 'string', required: true, authored: true },
          { name: 'label', type: 'string', required: true, authored: true },
          {
            name: 'group',
            type: 'string',
            required: true,
            authored: true,
            description:
              'The kind of thing it is (sport, animals, music). 3 to 5 groups work best.',
          },
        ],
      },
      {
        name: 'raters',
        type: 'string',
        values: ['preset'],
        description:
          'Who the student is compared with. Only preset (a made-up class generated from the items) for now.',
      },
      {
        name: 'showWhy',
        type: 'boolean',
        description:
          'Default true. Each recommendation gets a Why? button, and opening one is part of passing.',
      },
      {
        name: 'bubble',
        type: 'boolean',
        description: 'Default false. Show the bubble meter under the feed.',
      },
      {
        name: 'minRated',
        type: 'number',
        description: 'How many items the student must rate. Default 6.',
      },
    ],
  },

  defaultTask: (prev = {}) => ({
    id: prev.id,
    title: prev.title ?? '',
    description: prev.description ?? '',
    taskType: 'activity',
    activityType: 'recommender',
    items: STARTER.map((item) => ({ ...item })),
    raters: 'preset',
    showWhy: true,
    bubble: true,
  }),

  validateTask: (task, { n } = {}) => validateRecommender(task, n),

  // { ratings: { itemId: 1 | -1 }, why } - about 15 bytes a rating.
  initialState: () => ({ v: 1, ratings: {}, why: false }),

  solutionState: (task) => ({
    v: 1,
    ratings: Object.fromEntries(
      (task?.items ?? [])
        .slice(0, Math.max(6, Number(task?.minRated) || 0))
        .map((item) => [item.id, 1])
    ),
    why: needsWhy(task),
  }),

  // Nothing here is a secret answer.
  sealedFields: [],

  // A rating, un-rating or Why? is one tap: discrete, so the tutor's card follows it live.
  classifyChange: () => 'discrete',

  grade: (task, state) => {
    const { passed, rated, need, why } = gradeTask(task, state)
    return {
      passed,
      suggestion:
        rated < need
          ? `Rate ${need - rated} more with 👍 or 👎.`
          : !why
            ? 'Tap Why? on one of your recommendations.'
            : null,
      itemResults: Object.fromEntries(
        (task.items ?? []).map((item) => [item.id, state?.ratings?.[item.id] != null])
      ),
    }
  },

  getProgress: (task, state) => {
    const { rated, need } = gradeTask(task, state)
    const filled = Math.min(rated, need)
    return { kind: 'items', filled, total: need, correct: filled }
  },

  summarize: (task, state) => {
    const { passed } = gradeTask(task, state)
    // The tutor sees the feed the student sees: how many kinds it shows.
    const feed =
      ratedCount(state) > 0
        ? ` · ${feedKinds(task, state).text.replace('Your feed has ', 'feed ')}`
        : ''
    return { text: `${summaryText(task, state)}${feed}`, tone: passed ? 'success' : 'neutral' }
  },

  report: {
    typeFields: () => ({ taskType: 'activity', activityType: 'recommender' }),
    normalizeSubmission: (task, submission) => parseSubmission(submission) ?? submission ?? null,
    // Across the class, from each student's latest attempt: how many items were rated, how many
    // kinds their feed shows, and whether they opened Why?.
    summaryFields: (task, perStudent) => {
      const states = (perStudent ?? [])
        .map((t) =>
          parseSubmission(t.distinctAttempts?.[t.distinctAttempts.length - 1]?.submission)
        )
        .filter(Boolean)
      if (states.length === 0) return {}
      const items = task.items ?? []
      const raters = generateRaters(items)
      const students = states.map((state) => ({
        rated: ratedCount(state),
        kinds: bubbleInfo(recommend(items, raters, state.ratings ?? {}), items).kinds,
        why: state.why === true,
      }))
      const mean = (key) =>
        Number((students.reduce((sum, s) => sum + s[key], 0) / students.length).toFixed(1))
      return {
        recommenderResults: {
          students: students.length,
          avgRated: mean('rated'),
          avgFeedKinds: mean('kinds'),
          openedWhyCount: students.filter((s) => s.why).length,
          bubbleCount: students.filter((s) => s.kinds <= 1 && s.rated > 0).length,
        },
      }
    },
  },

  printHtml: (task, { esc }) => {
    const rows = (task.items ?? []).map(
      (item) => `<li>${esc(item.emoji)} ${esc(item.label)} <em>(${esc(item.group)})</em></li>`
    )
    return `<p>Rate at least ${esc(String(task.minRated ?? 6))} items, then tap Why? on a recommendation.</p><ul>${rows.join('')}</ul>`
  },
})
