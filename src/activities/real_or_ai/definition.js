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
    'Tap the picture or text you think AI made. The answer shows at once, with a note on the tell that gives it away.',
  yaml: { type: 'real_or_ai' },

  // Buttons only: works with mouse, touch and keyboard, so there are no device requirements.
  requires: {},
  touchFallback: 'equivalent',

  fields: {
    task: [
      {
        name: 'coreItems',
        type: 'number',
        description:
          'How many pairs make the round (1 to the number of pairs). The task passes when that many are done; the rest are bonus pairs. Defaults to all pairs.',
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
            authored: true,
            description:
              'The clue to look for, shown as a short note after the tap. An id like too_smooth (shown as "Too smooth") or plain text.',
          },
          {
            name: 'reliable',
            type: 'boolean',
            authored: true,
            description: 'Whether that clue can be trusted on its own. Leave out to say nothing.',
          },
          {
            name: 'reveal',
            type: 'string',
            authored: true,
            description: 'Optional extra sentence shown under the tell note.',
          },
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
    items: [
      {
        id: 'a',
        kind: 'text',
        a: 'The cat sat on the mat and watched the rain.',
        b: 'As an AI language model, the feline positioned itself upon the mat.',
        answer: 'b',
        tell: 'stiff wording',
        reliable: false,
        reveal: 'Stiff, over-formal wording can be a clue, but people write that way too.',
      },
    ],
  }),

  validateTask: (task, { n } = {}) => ({
    errors: validateRealOrAiTask(task, n),
    warnings: [],
  }),

  // Per item: { pick: 'a' | 'b' | '', done: boolean }, plus `right`: right picks so far, which
  // only goes up within a round (Play again resets it). Small (about 30 bytes an item).
  initialState: (task) => ({
    v: 1,
    right: 0,
    items: Object.fromEntries(
      (task?.items ?? []).map((item) => [item.id, { pick: '', done: false }])
    ),
  }),

  solutionState: (task) => ({
    v: 1,
    right: (task?.items ?? []).length,
    items: Object.fromEntries(
      (task?.items ?? []).map((item) => [item.id, solutionFor(task, item)])
    ),
  }),

  // The answers live inside items (answer, tell, reliable, reveal): seal the whole list, as the
  // multiple-choice quiz seals its options.
  sealedFields: ['items'],

  // Every change is one tap on a side: discrete, so the tutor's card follows the student's picks
  // as they make them.
  classifyChange: () => 'discrete',

  // Marked as you go: the task passes once the core pairs are done. Right and wrong picks both
  // count: the activity is about learning the tells, and the score is reported separately.
  completion: 'auto',
  // Passing means the round is finished, not that the picks were right.
  passMessage: 'Round done!',

  grade: (task, state) => {
    const results = (task.items ?? []).map((item) => ({
      item,
      ...gradeItem(task, item, state?.items?.[item.id]),
    }))
    const firstOpen = results.find((result) => !result.done)
    return {
      passed: gradeTask(task, state).passed,
      suggestion: firstOpen?.hint ?? null,
      itemResults: Object.fromEntries(results.map((result) => [result.item.id, result.correct])),
    }
  },

  getProgress: (task, state) => {
    const { total, core, done, correct } = gradeTask(task, state)
    const counted = Math.min(done, core)
    return {
      kind: 'items',
      filled: counted,
      total: core,
      correct: Math.min(correct, counted),
      bonus: Math.max(0, Math.min(done, total) - core),
    }
  },

  summarize: (task, state) => {
    const { total, passed, finished, correct } = gradeTask(task, state)
    return {
      text: summaryText(task, state),
      tone: passed && finished && correct === total ? 'success' : 'neutral',
    }
  },

  report: {
    typeFields: () => ({ taskType: 'activity', activityType: 'real_or_ai' }),
    normalizeSubmission: (task, submission) => parseSubmission(submission) ?? submission ?? null,
    // Per item across the class, from each student's latest attempt: how many played it and how
    // many picked the AI one.
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
          }
        }),
      }
    },
  },

  printHtml: (task, { esc }) => {
    const rows = (task.items ?? []).map((item) => {
      const side = item.answer === 'b' ? 'B' : 'A'
      const clue = item.tell ? `; tell: ${esc(tellLabel(item.tell))}` : ''
      const trust =
        item.reliable === true ? '; reliable' : item.reliable === false ? '; not reliable' : ''
      return `<li>${esc(item.a)} | ${esc(item.b)} <em>(AI: ${side}${clue}${trust})</em>${item.reveal ? `<br>${esc(item.reveal)}` : ''}</li>`
    })
    return `<ol>${rows.join('')}</ol>`
  },
})
