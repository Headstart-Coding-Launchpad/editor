// Next Word activity definition (pure). Wraps the logic in ./next_word.js in the activity
// contract (src/activities/defineActivity.js; docs/architecture/activities.md).
// Node-safe: no JSX, React or DOM imports (activityInterface.test.js checks).
//
// Privacy: the student's own sentences stay on the device. `serialize` (the device's saved copy)
// holds them; `serializeShared` (Firebase, the teacher card, the attempt log) holds the sentence
// the model wrote, the guess counts and how many words the student wrote, never the words.
import { defineActivity } from '../defineActivity.js'
import { roundSummaryText } from '../round.js'
import {
  DEFAULT_GUESSES,
  DEFAULT_PANELS,
  MAX_GUESSES,
  PANELS,
  gradeTask,
  initialNextWordState,
  normalizeNextWordState,
  ownWordsOf,
  sharedState,
  solutionStateFor,
  validateNextWordTask,
  voiceOf,
} from './next_word.js'

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
  id: 'next_word',
  label: 'Next Word',
  category: 'computing',
  icon: '🔮',
  description:
    'Write some sentences and press one big Next word button: a tiny AI picks the word that follows, and the student guesses what it will pick.',
  yaml: { type: 'next_word' },

  // Text only: works on any device, with or without a physical keyboard.
  requires: {},
  touchFallback: 'equivalent',

  fields: {
    task: [
      {
        name: 'guesses',
        type: 'number',
        description: `How many "Guess what it says next" rounds make the task (1 to ${MAX_GUESSES}, default ${DEFAULT_GUESSES}). It passes when that many guesses are made, right or wrong; more are bonus.`,
      },
      {
        name: 'panels',
        type: 'array',
        values: PANELS,
        description: `Which extra parts show: stats (bars of which words followed the last word), silly (Sensible to Silly slider), voices (switch between the lesson's texts and My writing). Default ${JSON.stringify(DEFAULT_PANELS)}.`,
      },
      {
        name: 'texts',
        type: 'array',
        authored: true,
        description:
          'Voices the student can switch to (shown only with the voices panel). Each is a title, a body and an optional emoji.',
        itemFields: [
          { name: 'title', type: 'string', required: true, authored: true },
          {
            name: 'body',
            type: 'string',
            required: true,
            authored: true,
            description: 'Up to 4000 characters.',
          },
          { name: 'emoji', type: 'string', description: 'One emoji for the voice card.' },
        ],
      },
    ],
  },

  // The task the Builder creates and the contract tests validate. It must pass validateTask.
  defaultTask: (prev = {}) => ({
    id: prev.id,
    title: prev.title ?? '',
    description: prev.description ?? '',
    taskType: 'activity',
    activityType: 'next_word',
    guesses: DEFAULT_GUESSES,
    panels: [...DEFAULT_PANELS],
    texts: [
      {
        title: 'Football commentary',
        emoji: '⚽',
        body: 'The ball goes into the net. The keeper looks at the net. The striker puts the ball in the net.',
      },
    ],
  }),

  validateTask: (task, { n } = {}) => ({
    errors: validateNextWordTask(task, n),
    warnings: [],
  }),

  initialState: (task) => initialNextWordState(task),

  solutionState: (task) => solutionStateFor(task),

  // Nothing worth sealing: the texts are public and there are no hidden answers.
  sealedFields: [],

  // The device's own copy: the student's sentences included.
  serialize: (state) => JSON.stringify(state ?? null),
  // What leaves the device: no sentences of the student's own.
  serializeShared: (state) => JSON.stringify(sharedState(state)),
  // Reads either form (and the old v1 form).
  deserialize: (raw, task) => normalizeNextWordState(task, parse(raw)),

  // A student's own writing is theirs: the tutor watches, they do not edit it.
  teacherEditable: false,

  // Passes by itself when the core guesses are done; the rest is bonus.
  completion: 'auto',

  // Writing the sentences and moving the slider are continuous; a tap, a press, a voice switch
  // and Start again are discrete.
  classifyChange: (prev, next) => {
    const keys = ['voice', 'sentence', 'pending', 'guesses', 'right']
    if (keys.some((key) => prev?.[key] !== next?.[key])) return 'discrete'
    if (JSON.stringify(prev?.last ?? null) !== JSON.stringify(next?.last ?? null)) return 'discrete'
    if (prev?.own !== next?.own || prev?.temperature !== next?.temperature) return 'continuous'
    return 'discrete'
  },

  grade: (task, state) => {
    const { done, goal, core } = gradeTask(task, state)
    return {
      passed: done,
      suggestion: done ? null : `Guess what it says next: ${goal - core} more to go.`,
    }
  },

  getProgress: (task, state) => {
    const { goal, core, right, bonus } = gradeTask(task, state)
    return { kind: 'items', filled: core, total: goal, correct: Math.min(right, core), bonus }
  },

  summarize: (task, state) => {
    const { goal, guesses, right, done } = gradeTask(task, state)
    const words = ownWordsOf(state)
    const parts = [
      roundSummaryText(guesses, goal + 1, goal, 'guessed'),
      `${right} right`,
      voiceOf(task, state).id === 'own' ? `${words} own ${words === 1 ? 'word' : 'words'}` : null,
    ]
    return { text: parts.filter(Boolean).join(' · '), tone: done ? 'success' : 'neutral' }
  },

  printHtml: (task, { esc }) => {
    const texts = (task.texts ?? []).map((text) => `<li>${esc(text.title)}</li>`).join('')
    const goal = Number.isInteger(task.guesses) ? task.guesses : DEFAULT_GUESSES
    return `<p>Guess what the next word will be, ${goal} times.</p>${texts ? `<p>Voices:</p><ul>${texts}</ul>` : ''}`
  },
})
