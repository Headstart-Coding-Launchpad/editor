// Template Activity activity definition (pure). Wraps the logic in ./template_activity.js in the
// activity contract (src/activities/defineActivity.js; docs/architecture/activities.md).
// Node-safe: no JSX, React or DOM imports (activityInterface.test.js checks).
import { defineActivity } from '../defineActivity.js'
import {
  gradeItem,
  gradeTask,
  solutionFor,
  validateTemplateActivityTask,
} from './template_activity.js'

export default defineActivity({
  id: 'template_activity',
  label: 'Template Activity',
  category: 'computing',
  // TODO(new-activity): pick an icon and describe what students do in one sentence (shown in
  // `lessons capabilities` and the Builder activity gallery).
  icon: '🧩',
  description: 'Answer each question by typing a short answer.',
  yaml: { type: 'template_activity' },

  // TODO(new-activity): device needs. `requires` lists physicalKeyboard / finePointer / hover;
  // `touchFallback` is 'equivalent' (touch works), 'virtual_keyboard' or 'block'.
  // requires: { physicalKeyboard: true },
  // touchFallback: 'virtual_keyboard',

  // The task the Builder creates and the contract tests validate. It must pass validateTask.
  defaultTask: (prev = {}) => ({
    id: prev.id,
    title: prev.title ?? '',
    description: prev.description ?? '',
    taskType: 'activity',
    activityType: 'template_activity',
    items: [{ id: 'a', prompt: 'What is 2 + 2?', answer: '4' }],
  }),

  validateTask: (task, { n } = {}) => ({
    errors: validateTemplateActivityTask(task, n),
    warnings: [],
  }),

  // State is JSON on students/{id}/currentAnswer: keep it small (under 2 KB) and versioned.
  initialState: (task) => ({
    v: 1,
    items: Object.fromEntries((task?.items ?? []).map((item) => [item.id, { answer: '' }])),
  }),

  solutionState: (task) => ({
    v: 1,
    items: Object.fromEntries(
      (task?.items ?? []).map((item) => [item.id, solutionFor(task, item)])
    ),
  }),

  // Per-keystroke / per-pointer-move changes MUST be 'continuous' (only synced while the teacher
  // watches this student). Button presses and finished items are 'discrete'.
  // TODO(new-activity): classify your own state changes.
  classifyChange: (prev, next) => {
    const ids = new Set([...Object.keys(prev?.items ?? {}), ...Object.keys(next?.items ?? {})])
    for (const id of ids) {
      if (prev?.items?.[id]?.answer !== next?.items?.[id]?.answer) return 'continuous'
    }
    return 'discrete'
  },

  grade: (task, state) => {
    const results = (task.items ?? []).map((item) => ({
      item,
      ...gradeItem(task, item, state?.items?.[item.id]),
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
    return { text: `${correct}/${total} correct`, tone: correct === total ? 'success' : 'neutral' }
  },

  printHtml: (task, { esc }) => {
    const rows = (task.items ?? []).map(
      (item) => `<li>${esc(item.prompt)} <em>(answer: ${esc(item.answer)})</em></li>`
    )
    return `<ol>${rows.join('')}</ol>`
  },
})
