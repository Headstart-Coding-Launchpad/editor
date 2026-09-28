// Keyboard activity definition (pure). Wraps ./keyboard.js in the activity contract.
import { defineActivity } from '../defineActivity.js'
import { DEFAULT_LAYOUT, getKeyForChar } from '../../shared/input/index.js'
import { gradeKeyboardTask, validateKeyboardTask } from './keyboard.js'

const MODE_LABELS = {
  type_text: 'Type the text',
  find_key: 'Find the key',
  symbols: 'Type the symbols',
  shortcuts: 'Keyboard shortcuts',
}

function solutionItem(task, item) {
  switch (task.mode) {
    case 'type_text':
      return {
        typed: item.text,
        accuracy: 1,
        wpm: task.targetWpm ?? 0,
        shiftCapitals: [...item.text].filter((c) => c !== c.toLowerCase()).length,
        capsLockCapitals: 0,
        source: 'hardware',
      }
    case 'find_key':
      return { pressed: true, source: 'hardware' }
    case 'symbols':
      return {
        typedChar: item.char,
        shift: !!getKeyForChar(item.char, task.layout ?? DEFAULT_LAYOUT)?.shift,
        source: 'hardware',
      }
    case 'shortcuts':
      return { performed: true, via: 'keyboard', source: 'hardware' }
    default:
      return {}
  }
}

export default defineActivity({
  id: 'keyboard',
  label: 'Keyboard skills',
  category: 'digital_skills',
  icon: '⌨️',
  description:
    'Practise typing, capital letters with Shift, symbols on a UK keyboard, and shortcuts like Ctrl+C.',
  yaml: { type: 'keyboard' },
  requires: { physicalKeyboard: true },
  // Tablets without a keyboard get the built-in on-screen keyboard; items marked hardwareOnly
  // still need a real one.
  touchFallback: 'virtual_keyboard',

  defaultTask: (prev = {}) => ({
    id: prev.id,
    title: prev.title ?? '',
    description: prev.description ?? '',
    taskType: 'activity',
    activityType: 'keyboard',
    mode: 'type_text',
    layout: DEFAULT_LAYOUT,
    requireShiftForCapitals: true,
    items: [{ id: 'a', text: 'Hello World' }],
  }),

  validateTask: (task, { n } = {}) => validateKeyboardTask(task, n),

  initialState: (task) => ({
    v: 1,
    items: Object.fromEntries((task?.items ?? []).map((item) => [item.id, {}])),
  }),

  solutionState: (task) => ({
    v: 1,
    items: Object.fromEntries(
      (task?.items ?? []).map((item) => [item.id, solutionItem(task, item)])
    ),
  }),

  // Keystrokes are continuous (synced only while the teacher watches); finishing an item is a
  // discrete change every teacher card should see.
  classifyChange: (prev, next) => {
    const done = (state) =>
      Object.values(state?.items ?? {}).filter(
        (r) => r.pressed || r.performed || r.typedChar || r.done
      ).length
    return done(prev) === done(next) ? 'continuous' : 'discrete'
  },

  grade: (task, state) => {
    const result = gradeKeyboardTask(task, state)
    return { passed: result.done, suggestion: result.hint }
  },

  getProgress: (task, state) => {
    const { total, correct } = gradeKeyboardTask(task, state)
    return { kind: 'items', filled: correct, total, correct }
  },

  summarize: (task, state) => {
    const { total, correct } = gradeKeyboardTask(task, state)
    return { text: `${correct}/${total} done`, tone: correct === total ? 'success' : 'neutral' }
  },

  printHtml: (task, { esc }) => {
    const rows = (task.items ?? []).map((item) => {
      const text = item.text ?? item.key ?? item.char ?? item.combo ?? ''
      const prompt = item.prompt ? ` — ${esc(item.prompt)}` : ''
      return `<li><code>${esc(text)}</code>${prompt}</li>`
    })
    return `<p><strong>${esc(MODE_LABELS[task.mode] ?? 'Keyboard')}</strong></p><ol>${rows.join('')}</ol>`
  },
})
