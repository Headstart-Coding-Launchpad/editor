// Mouse activity definition (pure). Wraps ./mouse.js in the activity contract.
import { defineActivity } from '../defineActivity.js'
import { describeMouseItem, gradeMouseTask, validateMouseTask } from './mouse.js'

// The student view records the device it ran on in state.device, so grading on a touch screen
// accepts touch equivalents and skips hover items.
const deviceOf = (state) => ({ touch: !!state?.device?.touch })

export default defineActivity({
  id: 'mouse',
  label: 'Mouse skills',
  category: 'digital_skills',
  icon: '🖱️',
  description:
    'Practise clicking, double-clicking, right-clicking, dragging, scrolling and hovering (with touch-screen equivalents).',
  yaml: { type: 'mouse' },
  requires: { finePointer: true },
  touchFallback: 'equivalent',

  defaultTask: (prev = {}) => ({
    id: prev.id,
    title: prev.title ?? '',
    description: prev.description ?? '',
    taskType: 'activity',
    activityType: 'mouse',
    touch: 'equivalent',
    targets: [
      { id: 'star', label: 'star', emoji: '⭐', x: 0.3, y: 0.5, size: 'large' },
      { id: 'box', label: 'box', emoji: '📦', x: 0.7, y: 0.5, size: 'large' },
    ],
    items: [
      { id: 'a', action: 'click', target: 'star' },
      { id: 'b', action: 'drag', target: 'star', to: 'box' },
    ],
  }),

  validateTask: (task, { n } = {}) => validateMouseTask(task, n),

  initialState: (task) => ({
    v: 1,
    device: { touch: false },
    items: Object.fromEntries((task?.items ?? []).map((item) => [item.id, {}])),
  }),

  solutionState: (task) => ({
    v: 1,
    device: { touch: false },
    items: Object.fromEntries((task?.items ?? []).map((item) => [item.id, { via: item.action }])),
  }),

  grade: (task, state) => {
    const result = gradeMouseTask(task, state, deviceOf(state))
    return { passed: result.done, suggestion: result.hint }
  },

  getProgress: (task, state) => {
    const { total, correct } = gradeMouseTask(task, state, deviceOf(state))
    return { kind: 'items', filled: correct, total, correct }
  },

  summarize: (task, state) => {
    const { total, correct } = gradeMouseTask(task, state, deviceOf(state))
    const touch = state?.device?.touch ? ' (touch)' : ''
    return {
      text: `${correct}/${total} done${touch}`,
      tone: correct === total ? 'success' : 'neutral',
    }
  },

  printHtml: (task, { esc }) =>
    `<ol>${(task.items ?? []).map((item) => `<li>${esc(describeMouseItem(task, item))}</li>`).join('')}</ol>`,
})
