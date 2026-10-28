// Mind Reader activity definition (pure). Wraps the logic in ./rps_mind_reader.js in the
// activity contract (src/activities/defineActivity.js; docs/architecture/activities.md).
// Node-safe: no JSX, React or DOM imports (activityInterface.test.js checks).
//
// Sync: the saved game is two short digit strings (the child's moves and the Mind Reader's
// locked-in picks), about 250 bytes for 100 rounds. Each tap is one 'discrete' change, so the
// tutor sees every round live. The network is rebuilt from the moves, never saved.
import { defineActivity } from '../defineActivity.js'
import {
  DEFAULT_LOOK_BACK,
  DEFAULT_PANELS,
  DEFAULT_ROUNDS,
  PANELS,
  gradeTask,
  initialGame,
  lookBackOf,
  normalizeGame,
  panelsOf,
  passAtOf,
  roundsOf,
  solutionFor,
  statsOf,
  validateRpsMindReaderTask,
} from './rps_mind_reader.js'

const pct = (v) => Math.round(v * 100)

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
  id: 'rps_mind_reader',
  label: 'Mind Reader',
  category: 'computing',
  icon: '🔮',
  description:
    'Play rock-paper-scissors against a tiny neural network that learns your last few moves and starts to read your mind.',
  yaml: { type: 'rps_mind_reader' },
  // Marked as you go: the task passes once `passAt` rounds are played (win or lose).
  completion: 'auto',
  passMessage: 'You played the Mind Reader!',
  // The score and the finish card are the result; no banner on top.
  quietPass: true,

  fields: {
    task: [
      {
        name: 'rounds',
        type: 'number',
        description: `Rounds in the game (5 to 100). Default ${DEFAULT_ROUNDS}.`,
      },
      {
        name: 'lookBack',
        type: 'number',
        description: `How many of the student's past moves it sees (1 to 5). Default ${DEFAULT_LOOK_BACK}. With the lookback panel the student can change it.`,
      },
      {
        name: 'panels',
        type: 'array',
        description: `What to show: ${PANELS.join(', ')}. network draws the brain, history the read-rate over time, lookback the Remembers 1-5 dial. Default [${DEFAULT_PANELS.join(', ')}].`,
      },
      {
        name: 'passAt',
        type: 'number',
        description:
          'Rounds played to pass, win or lose (1 up to rounds). Default rounds. Play carries on to rounds.',
      },
    ],
  },

  defaultTask: (prev = {}) => ({
    id: prev.id,
    title: prev.title ?? '',
    description: prev.description ?? '',
    taskType: 'activity',
    activityType: 'rps_mind_reader',
    rounds: DEFAULT_ROUNDS,
    lookBack: DEFAULT_LOOK_BACK,
    panels: [...DEFAULT_PANELS],
  }),

  validateTask: (task, { n } = {}) => ({
    errors: validateRpsMindReaderTask(task, n),
    warnings: [],
  }),

  initialState: (task) => initialGame(task),
  solutionState: (task) => solutionFor(task),
  deserialize: (raw, task) => normalizeGame(task, parse(raw)),

  // A tap, a new look-back and a restart are all one-off changes.
  classifyChange: () => 'discrete',

  grade: (task, state) => {
    const graded = gradeTask(task, state)
    return { passed: graded.passed, suggestion: graded.hint, itemResults: {} }
  },

  getProgress: (task, state) => {
    const { played, passAt } = gradeTask(task, state)
    const filled = Math.min(10, Math.floor((Math.min(played, passAt) / passAt) * 10))
    return { kind: 'items', filled, total: 10, correct: filled }
  },

  // 'round 18 · You 7–11 It · read 70%'
  summarize: (task, state) => {
    const s = statsOf(task, state)
    if (s.played === 0) return { text: 'Not started', tone: 'neutral' }
    return {
      text: `round ${s.played} · You ${s.you}–${s.it} It · read ${pct(s.readRate)}%`,
      tone: s.played >= s.passAt ? 'success' : 'neutral',
    }
  },

  report: {
    typeFields: () => ({ taskType: 'activity', activityType: 'rps_mind_reader' }),
    normalizeSubmission: (task, submission) => {
      const raw = parse(submission)
      return raw ? normalizeGame(task, raw) : null
    },
    // Each student's latest game: rounds played, score and how often it read them.
    summaryFields: (task, perStudent) => {
      let count = 0
      let roundsSum = 0
      let youSum = 0
      let itSum = 0
      let accSum = 0
      for (const t of perStudent ?? []) {
        const latest = t.distinctAttempts?.[t.distinctAttempts.length - 1]?.submission
        if (latest == null) continue
        const s = statsOf(task, parse(latest))
        count += 1
        roundsSum += s.played
        youSum += s.you
        itSum += s.it
        accSum += s.accuracy
      }
      const avg = (sum, digits) => (count ? Number((sum / count).toFixed(digits)) : null)
      return {
        mindReaderResults: {
          count,
          avgRounds: avg(roundsSum, 1),
          avgYouWins: avg(youSum, 1),
          avgItWins: avg(itSum, 1),
          avgReadRate: avg(accSum, 2),
        },
      }
    },
  },

  printHtml: (task) =>
    `<ul><li>${roundsOf(task)} rounds of rock-paper-scissors against a small neural network</li><li>It sees the student's last ${lookBackOf(task)} moves${panelsOf(task).includes('lookback') ? ' (student can change this, 1 to 5)' : ''}</li><li>Passes after ${passAtOf(task)} rounds played</li></ul>`,

  // The tutor watches the game; there is nothing to type into, so no Edit answers.
  teacherEditable: false,
  previewState: 'initial',
})
