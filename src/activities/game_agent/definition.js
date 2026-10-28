// Game agent activity definition (pure). Wraps the logic in ./game_agent.js in the
// activity contract (src/activities/defineActivity.js; docs/architecture/activities.md).
// Node-safe: no JSX, React or DOM imports (activityInterface.test.js checks).
//
// Privacy: nothing personal. The state is the rewards, an episode count, the last scores and the
// last Go! route, all small and all shared, so the tutor sees the robot's progress live.
import { defineActivity } from '../defineActivity.js'
import {
  DEFAULT_EPISODES,
  DEFAULT_REWARDS,
  episodesOf,
  gradeTask,
  initialGameAgentState,
  normalizeGameAgentState,
  sharedState,
  solutionFor,
  summaryOf,
  validateGameAgentTask,
  validateGameAgentWarnings,
} from './game_agent.js'

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
  id: 'game_agent',
  label: 'Game agent',
  category: 'computing',
  icon: '🤖',
  description:
    'Set the rewards, train a little robot over many tries, and watch it learn the way to the treasure (reinforcement learning).',
  yaml: { type: 'game_agent' },
  // Marked as you go: the task passes when a Go! run reaches the treasure (no Check button).
  completion: 'auto',
  passMessage: 'Your robot found the treasure!',

  fields: {
    task: [
      {
        name: 'map',
        type: 'array',
        required: true,
        authored: true,
        description:
          'Rows of text, at most 10 x 10: # wall, . floor, R robot start (exactly one), T treasure (exactly one), X pit (optional, ends the try), C coin (optional, pays once per try). The treasure must be reachable.',
      },
      {
        name: 'rewards',
        type: 'object',
        description:
          'The starting rewards the student can change: { treasure, step, wall, pit, coin }, whole numbers from -20 to 20. Default { treasure: 10, step: -1, wall: -5, pit: -10 } (coin: 3 when the map has a C).',
      },
      {
        name: 'senses',
        type: 'array',
        description:
          'What the robot senses to tell situations apart, and the starting choice: position, walls, treasure_direction, treasure_direction_4, pit_near, coin_direction. Setting this (or maxSenses) lets the student toggle senses. Default [position] (the square it stands on).',
      },
      {
        name: 'maxSenses',
        type: 'number',
        description: 'The most senses the student can switch on at once (1 to 6). Default 6.',
      },
      {
        name: 'testMaps',
        type: 'array',
        description:
          'Sealed list of up to 5 maps (same characters as map) nobody trains on. "Go on a new map" runs the trained robot once on one of them, with no training; the task then passes when it reaches the treasure there.',
      },
      {
        name: 'episodes',
        type: 'number',
        description: `How many practice tries one press of Train runs (1 to 500). Default ${DEFAULT_EPISODES}.`,
      },
      {
        name: 'showLearning',
        type: 'boolean',
        description: 'Show the learning curve (each try as a bar). Default true.',
      },
      {
        name: 'race',
        type: 'boolean',
        description:
          'Race v1: the tutor card shows each best mystery-map score, like "mystery map: 8 pts", so the class can be ranked. Needs testMaps.',
      },
    ],
  },

  defaultTask: (prev = {}) => ({
    id: prev.id,
    title: prev.title ?? '',
    description: prev.description ?? '',
    taskType: 'activity',
    activityType: 'game_agent',
    map: ['#####', '#R..#', '#.#T#', '#####'],
    rewards: { ...DEFAULT_REWARDS },
    episodes: DEFAULT_EPISODES,
    showLearning: true,
  }),

  validateTask: (task, { n } = {}) => ({
    errors: validateGameAgentTask(task, n),
    warnings: validateGameAgentWarnings(task, n),
  }),

  initialState: (task) => initialGameAgentState(task),
  solutionState: (task) => solutionFor(task),

  serialize: (state) => JSON.stringify(state ?? null),
  serializeShared: (state) => JSON.stringify(sharedState(state)),
  deserialize: (raw, task) => normalizeGameAgentState(task, parse(raw)),

  // Training progress (more episodes, new scores) streams only while a tutor watches. Starting
  // or stopping, new rewards, a Go! and a pass are discrete.
  classifyChange: (prev, next) => {
    const p = sharedState(prev)
    const q = sharedState(next)
    const progressOnly =
      p.training &&
      q.training &&
      q.trained >= p.trained &&
      JSON.stringify(p.rewards) === JSON.stringify(q.rewards) &&
      JSON.stringify(p.senses) === JSON.stringify(q.senses) &&
      p.tests === q.tests &&
      p.goes === q.goes &&
      p.reached === q.reached
    return progressOnly ? 'continuous' : 'discrete'
  },

  grade: (task, state) => {
    const graded = gradeTask(task, state)
    return { passed: graded.passed, suggestion: graded.hint }
  },

  // Episodes trained, then the treasure found: two steps.
  getProgress: (task, state) => {
    const g = gradeTask(task, state)
    const filled = (g.trained > 0 ? 1 : 0) + (g.reached ? 1 : 0)
    return { kind: 'items', filled, total: 2, correct: filled }
  },

  summarize: (task, state) => summaryOf(task, state),

  buildSubmission: (task, state) => sharedState(state),

  report: {
    typeFields: () => ({ taskType: 'activity', activityType: 'game_agent' }),
    normalizeSubmission: (task, submission) => {
      const raw = parse(submission)
      return raw ? normalizeGameAgentState(task, raw) : null
    },
    // Each student's latest attempt: how many trained, how many reached the treasure, the
    // average episodes and the best score in the class.
    summaryFields: (task, perStudent) => {
      let trainedCount = 0
      let reachedCount = 0
      let episodes = 0
      let best = null
      let testedCount = 0
      let testReachedCount = 0
      let bestTest = null
      for (const t of perStudent ?? []) {
        const latest = t.distinctAttempts?.[t.distinctAttempts.length - 1]?.submission
        const raw = latest && typeof latest === 'object' ? latest : parse(latest)
        if (!raw) continue
        const s = normalizeGameAgentState(task, raw)
        if (s.trained === 0) continue
        trainedCount += 1
        episodes += s.trained
        if (s.reached) reachedCount += 1
        if (s.bestScore != null && (best == null || s.bestScore > best)) best = s.bestScore
        if (s.tests > 0) testedCount += 1
        if (s.testBest != null) {
          testReachedCount += 1
          if (bestTest == null || s.testBest > bestTest) bestTest = s.testBest
        }
      }
      return {
        gameAgentResults: {
          trainedCount,
          reachedCount,
          avgEpisodes: trainedCount ? Math.round(episodes / trainedCount) : null,
          bestScore: best,
          testedCount,
          testReachedCount,
          bestTestScore: bestTest,
        },
      }
    },
  },

  printHtml: (task, { esc }) => {
    const rows = (task.map ?? []).map((row) => esc(String(row))).join('<br>')
    return `<pre>${rows}</pre><ul><li>Episodes per Train: ${esc(String(episodesOf(task)))}</li><li>The student sets the rewards and trains a robot to reach the treasure.</li></ul>`
  },

  teacherEditable: false,
  previewState: 'initial',
})
