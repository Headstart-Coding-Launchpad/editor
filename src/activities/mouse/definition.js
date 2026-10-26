// Mouse activity definition (pure). Wraps ./mouse.js in the activity contract.
import { defineActivity } from '../defineActivity.js'
import { roundSummaryText } from '../round.js'
import {
  describeMouseItem,
  gradeMouseTask,
  mouseBadgeResult,
  validateMouseTask,
  MOUSE_ACTIONS,
  TARGET_SIZES,
  TOUCH_POLICIES,
} from './mouse.js'

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
  // Marked as you go: the task passes the moment the core items are done (no Check button).
  completion: 'auto',
  requires: { finePointer: true },
  touchFallback: 'equivalent',

  // Each item's `action` picks what the student does; there is no task-level mode.
  fields: {
    task: [
      {
        name: 'coreItems',
        type: 'number',
        description:
          'How many items make the round (1 to the number of items). The task passes when that many are done; the rest are bonus reps. Defaults to all items.',
      },
      {
        name: 'touch',
        type: 'string',
        values: TOUCH_POLICIES,
        description: 'What happens on touch screens (default equivalent).',
      },
      {
        name: 'targets',
        type: 'array',
        required: true,
        authored: true,
        itemFields: [
          { name: 'id', type: 'string', required: true },
          { name: 'label', type: 'string', authored: true },
          { name: 'emoji', type: 'string', authored: true },
          { name: 'x', type: 'number', required: true, description: '0 to 1 across the area.' },
          { name: 'y', type: 'number', required: true, description: '0 to 1 down the area.' },
          { name: 'size', type: 'string', values: TARGET_SIZES },
        ],
      },
      {
        name: 'items',
        type: 'array',
        required: true,
        authored: true,
        itemFields: [
          { name: 'id', type: 'string', required: true },
          { name: 'action', type: 'string', required: true, values: MOUSE_ACTIONS },
          { name: 'target', type: 'string', required: true, description: 'A target id.' },
          { name: 'to', type: 'string', description: 'Drop target id; required for drag.' },
          { name: 'prompt', type: 'string', authored: true },
        ],
      },
    ],
  },

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
    // Gestures that were not the answer (see missesOf in ./mouse.js): the Steady Hand badge.
    misses: 0,
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

  badgeResult: (task, state) => mouseBadgeResult(task, state, deviceOf(state)),

  getProgress: (task, state) => {
    const { total, correct, core } = gradeMouseTask(task, state, deviceOf(state))
    // Counted against the core; reps after it are reported as bonus.
    const counted = Math.min(correct, core)
    return {
      kind: 'items',
      filled: counted,
      total: core,
      correct: counted,
      bonus: Math.max(0, Math.min(correct, total) - core),
    }
  },

  summarize: (task, state) => {
    const { total, correct, core, done } = gradeMouseTask(task, state, deviceOf(state))
    const touch = state?.device?.touch ? ' (touch)' : ''
    return {
      text: `${roundSummaryText(correct, total, core)}${touch}`,
      tone: done ? 'success' : 'neutral',
    }
  },

  printHtml: (task, { esc }) =>
    `<ol>${(task.items ?? []).map((item) => `<li>${esc(describeMouseItem(task, item))}</li>`).join('')}</ol>`,
})
