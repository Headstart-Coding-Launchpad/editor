// Game agent activity definition (pure). Wraps the logic in ./game_agent.js in the
// activity contract (src/activities/defineActivity.js; docs/architecture/activities.md).
// Node-safe: no JSX, React or DOM imports (activityInterface.test.js checks).
//
// Privacy: nothing personal. The state is the rewards, an episode count, the last scores and the
// last Go! route, all small and all shared, so the tutor sees the robot's progress live.
import { defineActivity } from '../defineActivity.js'
import {
  COURSE_TRIES_FACTOR,
  DEFAULT_EPISODES,
  DEFAULT_REWARDS,
  episodesOf,
  gradeTask,
  isCopyBrain,
  hasCourses,
  initialGameAgentState,
  normalizeGameAgentState,
  sharedState,
  solutionFor,
  summaryOf,
  validateGameAgentTask,
  validateGameAgentWarnings,
} from './game_agent.js'
import { validateRandomCourses } from './courses.js'
import { copySolutionFor } from './copybot.js'

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
        name: 'randomCourses',
        type: 'object',
        description:
          'Random solvable courses: { size (5 to 9, default 7), walls (0 to 0.4, default 0.25), pits (0 to 3, default 1), coins (0 to 3, default 0), seed (class or a whole number, default class) }. "Try a new course" runs the trained robot once, with no training, on the next course; the task passes when it reaches the treasure. With seed class every student in the lesson gets the same courses in the same order. Courses are always solvable and have no dead-end trap on the way to the treasure. Replaces testMaps.',
      },
      {
        name: 'brain',
        type: 'string',
        description:
          'How the robot learns: reward (default, Q-learning from points) or copy (a small neural network that learns from the student driving it). With copy the student drives the robot on practice courses with the arrow keys or on-screen arrows, presses Train, then Watch it drive runs the network on the next unseen course; the task passes when it reaches the treasure there. Uses randomCourses (the defaults when it is left out), ignores testMaps and rewards, and the senses default to [walls, treasure_direction] (position is left out).',
      },
      {
        name: 'panels',
        type: 'array',
        description:
          'Extra pictures on the stage. network draws the copy-bot network: input neurons (the senses), hidden neurons and the 4 outputs, lit as it decides. Only used when brain is copy.',
      },
      {
        name: 'episodes',
        type: 'number',
        description: `How many practice tries one press of Train runs (1 to 500). Default ${DEFAULT_EPISODES}. With randomCourses each try runs on a new training course and a press of Train runs ${COURSE_TRIES_FACTOR} times as many. Not used when brain is copy.`,
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

  validateTask: (task, { n } = {}) => {
    const courses = validateRandomCourses(task, n)
    return {
      errors: [...validateGameAgentTask(task, n), ...courses.errors],
      warnings: [...validateGameAgentWarnings(task, n), ...courses.warnings],
    }
  },

  initialState: (task) => initialGameAgentState(task),
  solutionState: (task) => (isCopyBrain(task) ? copySolutionFor(task) : solutionFor(task)),

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
    const filled =
      (g.trained > 0 ? 1 : 0) + ((isCopyBrain(task) ? g.testReached : g.reached) ? 1 : 0)
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
      let courseTried = 0
      let courseCleared = 0
      let courseStudents = 0
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
        if (s.courses.length > 0) {
          courseStudents += 1
          courseTried += s.courses.length
          courseCleared += s.courses.filter((c) => c.reached).length
        }
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
          ...(hasCourses(task)
            ? {
                courseStudents,
                avgCoursesTried: courseStudents
                  ? Number((courseTried / courseStudents).toFixed(1))
                  : null,
                avgCoursesCleared: courseStudents
                  ? Number((courseCleared / courseStudents).toFixed(1))
                  : null,
              }
            : {}),
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
