// Real or AI activity definition (pure). Wraps the logic in ./real_or_ai.js in the
// activity contract (src/activities/defineActivity.js; docs/architecture/activities.md).
// Node-safe: no JSX, React or DOM imports (activityInterface.test.js checks).
import { defineActivity } from '../defineActivity.js'
import {
  gradeItem,
  gradeTask,
  ITEM_KINDS,
  SIDES,
  solutionFor,
  summaryText,
  tellLabel,
  validateRealOrAiTask,
} from './real_or_ai.js'

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

export default defineActivity({
  id: 'real_or_ai',
  label: 'Real or AI',
  category: 'digital_skills',
  icon: '🕵️',
  description:
    'Compare a pair of pictures or texts, pick the one made by AI, name the clue that gave it away, then see whether the clue can be trusted.',
  yaml: { type: 'real_or_ai' },

  // Buttons only: works with mouse, touch and keyboard, so there are no device requirements.
  requires: {},
  touchFallback: 'equivalent',

  fields: {
    task: [
      {
        name: 'tells',
        type: 'array',
        required: true,
        authored: true,
        description:
          'The clues the student chooses from (at least two). Written as ids like too_smooth (shown as "Too smooth") or as plain text.',
      },
      {
        name: 'items',
        type: 'array',
        required: true,
        authored: true,
        itemFields: [
          { name: 'id', type: 'string', required: true },
          { name: 'kind', type: 'string', values: ITEM_KINDS, description: 'Default image.' },
          {
            name: 'a',
            type: 'string',
            required: true,
            authored: true,
            description: 'Image path or URL (kind image) or the text (kind text).',
          },
          { name: 'b', type: 'string', required: true, authored: true },
          { name: 'altA', type: 'string', authored: true, description: 'Alt text for image a.' },
          { name: 'altB', type: 'string', authored: true, description: 'Alt text for image b.' },
          {
            name: 'answer',
            type: 'string',
            required: true,
            authored: true,
            values: SIDES,
            description: 'Which side is the AI one.',
          },
          {
            name: 'tell',
            type: 'string',
            required: true,
            authored: true,
            description: 'The clue to look for; one of the task tells.',
          },
          {
            name: 'reliable',
            type: 'boolean',
            required: true,
            authored: true,
            description: 'Whether that clue can be trusted on its own.',
          },
          { name: 'reveal', type: 'string', required: true, authored: true },
        ],
      },
    ],
  },

  defaultTask: (prev = {}) => ({
    id: prev.id,
    title: prev.title ?? '',
    description: prev.description ?? '',
    taskType: 'activity',
    activityType: 'real_or_ai',
    tells: ['odd_detail', 'too_smooth', 'none_reliable'],
    items: [
      {
        id: 'a',
        kind: 'text',
        a: 'The cat sat on the mat and watched the rain.',
        b: 'As an AI language model, the feline positioned itself upon the mat.',
        answer: 'b',
        tell: 'odd_detail',
        reliable: false,
        reveal: 'Stiff, over-formal wording can be a clue, but people write that way too.',
      },
    ],
  }),

  validateTask: (task, { n } = {}) => ({
    errors: validateRealOrAiTask(task, n),
    warnings: [],
  }),

  // Per item: { pick: 'a' | 'b' | '', tell: '', done: boolean }. Small (about 50 bytes an item).
  initialState: (task) => ({
    v: 1,
    items: Object.fromEntries(
      (task?.items ?? []).map((item) => [item.id, { pick: '', tell: '', done: false }])
    ),
  }),

  solutionState: (task) => ({
    v: 1,
    items: Object.fromEntries(
      (task?.items ?? []).map((item) => [item.id, solutionFor(task, item)])
    ),
  }),

  // The answers live inside items (answer, tell, reliable, reveal): seal the whole list, as the
  // multiple-choice quiz seals its options.
  sealedFields: ['items'],

  // Every change is a button press (a pick, a clue, Reveal): all discrete, so the tutor's card
  // follows the student's picks as they make them, before the item is revealed.
  classifyChange: () => 'discrete',

  // Finishes itself on the Reveal of the last item. Right and wrong picks both finish: the
  // activity is about learning the clues, and the score is reported separately.
  completion: 'auto',

  grade: (task, state) => {
    const results = (task.items ?? []).map((item) => ({
      item,
      ...gradeItem(task, item, state?.items?.[item.id]),
    }))
    const firstOpen = results.find((result) => !result.done)
    return {
      passed: results.length > 0 && !firstOpen,
      suggestion: firstOpen?.hint ?? null,
      itemResults: Object.fromEntries(results.map((result) => [result.item.id, result.correct])),
    }
  },

  getProgress: (task, state) => {
    const { total, done, correct } = gradeTask(task, state)
    return { kind: 'items', filled: done, total, correct }
  },

  summarize: (task, state) => {
    const { total, finished, correct } = gradeTask(task, state)
    const text = summaryText(task, state)
    return {
      text,
      tone: finished && correct === total ? 'success' : 'neutral',
    }
  },

  report: {
    typeFields: () => ({ taskType: 'activity', activityType: 'real_or_ai' }),
    normalizeSubmission: (task, submission) => parseSubmission(submission) ?? submission ?? null,
    // Per item across the class, from each student's latest attempt: how many revealed it, how
    // many picked the AI one, how many named the author's clue.
    summaryFields: (task, perStudent) => {
      const states = perStudent
        .map((t) =>
          parseSubmission(t.distinctAttempts?.[t.distinctAttempts.length - 1]?.submission)
        )
        .filter(Boolean)
      if (states.length === 0) return {}
      return {
        itemResults: (task.items ?? []).map((item) => {
          const graded = states.map((state) => gradeItem(task, item, state.items?.[item.id]))
          return {
            itemId: item.id,
            tell: item.tell,
            reliable: item.reliable,
            revealed: graded.filter((g) => g.done).length,
            rightPick: graded.filter((g) => g.correct).length,
            tellMatch: graded.filter((g) => g.tellMatches).length,
          }
        }),
      }
    },
  },

  printHtml: (task, { esc }) => {
    const rows = (task.items ?? []).map((item) => {
      const side = item.answer === 'b' ? 'B' : 'A'
      return `<li>${esc(item.a)} | ${esc(item.b)} <em>(AI: ${side}; clue: ${esc(tellLabel(item.tell))}; ${item.reliable ? 'reliable' : 'not reliable'})</em><br>${esc(item.reveal)}</li>`
    })
    return `<p>Clues: ${(task.tells ?? []).map((t) => esc(tellLabel(t))).join(', ')}</p><ol>${rows.join('')}</ol>`
  },
})
