// Next Word activity definition (pure). Wraps the logic in ./next_word.js in the activity
// contract (src/activities/defineActivity.js; docs/architecture/activities.md).
// Node-safe: no JSX, React or DOM imports (activityInterface.test.js checks).
//
// Tutor visibility: the student's own sentences are shared with the tutor. `serialize` (the
// device's saved copy) and `serializeShared` (Firebase, the teacher card, the attempt log) both
// hold the student's own sentences (capped), so the tutor can read them live, plus the model's
// sentence and the guess results.
import { defineActivity } from '../defineActivity.js'
import { roundSummaryText } from '../round.js'
import {
  DEFAULT_GUESSES,
  CARDS,
  DEFAULT_CARD,
  DEFAULT_MAX_WORDS,
  DEFAULT_PANELS,
  DEFAULT_PASS_AT,
  MAX_MAX_WORDS,
  MAX_PASS_AT,
  MIN_MAX_WORDS,
  MODES,
  MAX_GUESSES,
  DEFAULT_LOOK_BACK,
  MAX_LOOK_BACK,
  PANELS,
  gradeTask,
  isWriteMode,
  passAtOf,
  initialNextWordState,
  lookBackOf,
  nextWordBadgeResult,
  normalizeNextWordState,
  ownWordsOf,
  panelsOf,
  sharedState,
  solutionStateFor,
  validateNextWordTask,
  voiceOf,
  packVoicesOf,
  DEFAULT_MAX_PACKS,
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
    'Write some sentences and press one big Next word button: a tiny AI picks the word that follows, and the student guesses which word is most likely.',
  yaml: { type: 'next_word' },

  // Text only: works on any device, with or without a physical keyboard.
  requires: {},
  touchFallback: 'equivalent',

  fields: {
    task: [
      {
        name: 'mode',
        type: 'string',
        values: MODES,
        description:
          'guess (default): the guessing round. write: the bot writes a sentence word by word (Go!) on a styled card, and the student keeps the best cards.',
      },
      {
        name: 'maxWords',
        type: 'number',
        description: `Write mode: the most words the bot writes before it stops (${MIN_MAX_WORDS} to ${MAX_MAX_WORDS}, default ${DEFAULT_MAX_WORDS}). It also stops at a sentence end.`,
      },
      {
        name: 'card',
        type: 'string',
        values: CARDS,
        description: `Write mode: how the output looks: headline (newspaper), post (social post) or commentary (speech line). Default ${DEFAULT_CARD}.`,
      },
      {
        name: 'passAt',
        type: 'number',
        description: `Write mode: how many kept cards pass the task (1 to ${MAX_PASS_AT}, default ${DEFAULT_PASS_AT}).`,
      },
      {
        name: 'guesses',
        type: 'number',
        description: `Guess mode: how many "Guess what it says next" rounds make the task (1 to ${MAX_GUESSES}, default ${DEFAULT_GUESSES}). It passes when that many guesses are made, right or wrong (right means the likeliest word); more are bonus.`,
      },
      {
        name: 'panels',
        type: 'array',
        values: PANELS,
        description: `Which extra parts show: stats (bars of which words followed the last word), silly (Sensible to Silly slider), voices (switch between the lesson's texts and My writing), lookback (the student picks how many words back it looks, 1 to ${MAX_LOOK_BACK}). Default ${JSON.stringify(DEFAULT_PANELS)}.`,
      },
      {
        name: 'lookBack',
        type: 'number',
        description: `How many words back the model looks to pick the next word (1 to maxLookBack, default ${DEFAULT_LOOK_BACK}). With the lookback panel it is where the student starts and they can change it.`,
      },
      {
        name: 'maxLookBack',
        type: 'number',
        description: `The most words back the student can choose with the lookback panel (1 to ${MAX_LOOK_BACK}, default ${MAX_LOOK_BACK}).`,
      },
      {
        name: 'maxPacks',
        type: 'number',
        description: `Write mode with the voices panel: how many packs the student can mix at once (1 up to the number of texts, default ${DEFAULT_MAX_PACKS}).`,
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
            description: 'Up to 4000 characters (80000 with mode: write, about 1,000 sentences).',
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

  // The device's own copy.
  serialize: (state) => JSON.stringify(state ?? null),
  // What leaves the device: the same, with the student's own word count added.
  serializeShared: (state) => JSON.stringify(sharedState(state)),
  // Reads either form (and the old v1 form).
  deserialize: (raw, task) => normalizeNextWordState(task, parse(raw)),

  // A student's own writing is theirs: the tutor watches, they do not edit it.
  teacherEditable: false,

  // Live badges: Perfect Round and Storyteller (src/badges/definitions).
  badgeResult: (task, state) => nextWordBadgeResult(task, state),

  // Passes by itself when the core guesses are done; the rest is bonus.
  completion: 'auto',
  // Shown instead of "Correct!" when the task passes (a wrong guess still counts, so the generic
  // wording would mislead).
  passMessage: 'Round done!',

  // Writing the sentences and moving the slider are continuous; a tap, a press, a voice switch
  // and Start again are discrete.
  classifyChange: (prev, next) => {
    const keys = [
      'voice',
      'packs',
      'sentence',
      'pending',
      'guesses',
      'right',
      'lookBack',
      'startWord',
      'treeIndex',
      'finished',
      'kept',
      'copied',
    ]
    if (prev?.cards?.length !== next?.cards?.length) return 'discrete'
    if (keys.some((key) => JSON.stringify(prev?.[key]) !== JSON.stringify(next?.[key]))) {
      return 'discrete'
    }
    if (JSON.stringify(prev?.last ?? null) !== JSON.stringify(next?.last ?? null)) return 'discrete'
    if (prev?.own !== next?.own || prev?.temperature !== next?.temperature) return 'continuous'
    return 'discrete'
  },

  grade: (task, state) => {
    const { done, goal, core } = gradeTask(task, state)
    if (isWriteMode(task)) {
      return {
        passed: done,
        suggestion: done ? null : `Keep a card you like: ${goal - core} more to go.`,
      }
    }
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
    if (isWriteMode(task)) {
      const { goal, core, done } = gradeTask(task, state)
      const norm = normalizeNextWordState(task, state)
      const latest = norm.cards[norm.cards.length - 1]?.text
      const parts = [
        `${norm.cards.length} of ${goal} cards kept`,
        packVoicesOf(task, norm).length > 1
          ? `mixing ${packVoicesOf(task, norm)
              .map((entry) => entry.label)
              .join(' + ')}`
          : null,
        norm.startWord ? `started “${norm.startWord}”` : null,
        `looked back ${norm.usedLookBack || lookBackOf(task, state)}`,
        norm.copies > 0 ? `${norm.copies} copied` : null,
        latest ? `latest: “${latest.length > 70 ? `${latest.slice(0, 69)}…` : latest}”` : null,
      ]
      return {
        text: parts.filter(Boolean).join(' · '),
        tone: done || core >= goal ? 'success' : 'neutral',
      }
    }
    const { goal, guesses, right, done } = gradeTask(task, state)
    const words = ownWordsOf(state)
    const parts = [
      roundSummaryText(guesses, goal + 1, goal, 'guessed'),
      `${right} right`,
      voiceOf(task, state).id === 'own' ? `${words} own ${words === 1 ? 'word' : 'words'}` : null,
      panelsOf(task).includes('lookback') ? `looked back ${lookBackOf(task, state)}` : null,
    ]
    return { text: parts.filter(Boolean).join(' · '), tone: done ? 'success' : 'neutral' }
  },

  report: {
    typeFields: () => ({ taskType: 'activity', activityType: 'next_word' }),
    normalizeSubmission: (task, submission) => {
      const raw = parse(submission)
      return raw ? normalizeNextWordState(task, raw) : null
    },
    // Write mode: across each student's latest attempt, the cards kept, the look-back they used
    // and how many runs were copies word for word. Nothing for the guessing round.
    summaryFields: (task, perStudent) => {
      if (!isWriteMode(task)) return {}
      let students = 0
      let cards = 0
      let copied = 0
      const lookBacks = {}
      for (const t of perStudent ?? []) {
        const latest = t.distinctAttempts?.[t.distinctAttempts.length - 1]?.submission
        const state = normalizeNextWordState(
          task,
          typeof latest === 'object' ? latest : parse(latest)
        )
        if (state.runs === 0 && state.cards.length === 0) continue
        students += 1
        cards += state.cards.length
        copied += state.copies
        const used = state.usedLookBack || state.lookBack
        lookBacks[used] = (lookBacks[used] ?? 0) + 1
      }
      return {
        nextWordWriteResults: {
          writtenCount: students,
          avgCardsKept: students ? Number((cards / students).toFixed(1)) : null,
          copiedCount: copied,
          lookBackUsed: lookBacks,
        },
      }
    },
  },

  printHtml: (task, { esc }) => {
    if (isWriteMode(task)) {
      return `<p>Press Go! and the bot writes a sentence. Keep ${passAtOf(task)} cards you like.</p>`
    }
    const texts = (task.texts ?? []).map((text) => `<li>${esc(text.title)}</li>`).join('')
    const goal = Number.isInteger(task.guesses) ? task.guesses : DEFAULT_GUESSES
    return `<p>Guess what the next word will be, ${goal} times.</p>${texts ? `<p>Voices:</p><ul>${texts}</ul>` : ''}`
  },
})
