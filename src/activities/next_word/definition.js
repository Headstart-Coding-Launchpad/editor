// Next Word activity definition (pure). Wraps the logic in ./next_word.js in the activity
// contract (src/activities/defineActivity.js; docs/architecture/activities.md).
// Node-safe: no JSX, React or DOM imports (activityInterface.test.js checks).
import { defineActivity } from '../defineActivity.js'
import {
  NO_TEXT_LABEL,
  chosenText,
  gradeItem,
  gradeTask,
  initialNextWordState,
  solutionStateFor,
  validateNextWordTask,
} from './next_word.js'

// Changes that are a deliberate click (pick a text, commit a pasted text, Reveal, Try again,
// Generate) are discrete. Typing a guess or a probe word and dragging the slider are continuous.
const DISCRETE_FIELDS = ['source', 'index', 'pasted', 'generated']
const CONTINUOUS_FIELDS = ['probe', 'temperature']

export default defineActivity({
  id: 'next_word',
  label: 'Next Word',
  category: 'computing',
  icon: '🔮',
  description:
    'Pick a text, see which word usually comes next (word-pair probabilities built live from it), predict the next word, and generate text with a temperature slider.',
  yaml: { type: 'next_word' },

  // Text only: works on any device, with or without a physical keyboard.
  requires: {},
  touchFallback: 'equivalent',

  fields: {
    task: [
      {
        name: 'texts',
        type: 'array',
        required: true,
        authored: true,
        description: 'The texts the student can pick. Write each item `answer` for the first one.',
        itemFields: [
          { name: 'title', type: 'string', required: true, authored: true },
          {
            name: 'body',
            type: 'string',
            required: true,
            authored: true,
            description: 'Up to 4000 characters.',
          },
        ],
      },
      {
        name: 'allowPaste',
        type: 'boolean',
        description: 'Let the student paste their own text (up to 1200 characters).',
      },
      {
        name: 'showTemperature',
        type: 'boolean',
        description: 'Show the temperature slider beside the Generate button.',
      },
      {
        name: 'items',
        type: 'array',
        required: true,
        authored: true,
        itemFields: [
          { name: 'id', type: 'string', required: true },
          {
            name: 'prompt',
            type: 'string',
            required: true,
            authored: true,
            description: 'Words ending where the student predicts the next one.',
          },
          {
            name: 'answer',
            type: 'string',
            required: true,
            authored: true,
            description: 'One word: the most likely next word in the first text.',
          },
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
    texts: [
      {
        title: 'Football commentary',
        body: 'The ball goes into the net. The keeper looks at the net. The striker puts the ball in the net.',
      },
    ],
    allowPaste: false,
    showTemperature: true,
    items: [{ id: 'a', prompt: 'the ball goes into the', answer: 'net' }],
  }),

  validateTask: (task, { n } = {}) => ({
    errors: validateNextWordTask(task, n),
    warnings: [],
  }),

  // State is JSON on students/{id}/currentAnswer: small and versioned. The only unbounded part
  // is a pasted text, capped at MAX_PASTE_CHARS and written when the student commits it.
  initialState: (task) => initialNextWordState(task),

  solutionState: (task) => solutionStateFor(task),

  // The answers are derivable from the (public) texts, so there is nothing worth sealing.
  sealedFields: [],

  classifyChange: (prev, next) => {
    for (const field of DISCRETE_FIELDS) {
      if (prev?.[field] !== next?.[field]) return 'discrete'
    }
    const ids = new Set([...Object.keys(prev?.items ?? {}), ...Object.keys(next?.items ?? {})])
    for (const id of ids) {
      if ((prev?.items?.[id]?.revealed === true) !== (next?.items?.[id]?.revealed === true)) {
        return 'discrete'
      }
    }
    for (const field of CONTINUOUS_FIELDS) {
      if (prev?.[field] !== next?.[field]) return 'continuous'
    }
    for (const id of ids) {
      if (prev?.items?.[id]?.guess !== next?.items?.[id]?.guess) return 'continuous'
    }
    return 'discrete'
  },

  grade: (task, state) => {
    const results = (task.items ?? []).map((item) => ({
      item,
      ...gradeItem(task, item, state),
    }))
    const firstWrong = results.find((result) => !result.correct)
    return {
      passed: results.length > 0 && !firstWrong,
      suggestion: firstWrong?.hint ?? null,
      itemResults: Object.fromEntries(results.map((result) => [result.item.id, result.correct])),
    }
  },

  getProgress: (task, state) => {
    const { total, correct } = gradeTask(task, state)
    return { kind: 'items', filled: correct, total, correct }
  },

  summarize: (task, state) => {
    const { total, correct } = gradeTask(task, state)
    const text = chosenText(task, state)
    return {
      text: `${text?.label ?? NO_TEXT_LABEL} · ${correct}/${total} right`,
      tone: total > 0 && correct === total ? 'success' : 'neutral',
    }
  },

  printHtml: (task, { esc }) => {
    const texts = (task.texts ?? []).map((text) => `<li>${esc(text.title)}</li>`).join('')
    const rows = (task.items ?? []).map(
      (item) => `<li>${esc(item.prompt)} … <em>(answer: ${esc(item.answer)})</em></li>`
    )
    return `<p>Texts:</p><ul>${texts}</ul><ol>${rows.join('')}</ol>`
  },
})
