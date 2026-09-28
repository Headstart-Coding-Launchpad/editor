// Binary activity definition (pure). Wraps the logic in ./binary.js in the activity contract.
import { defineActivity } from '../defineActivity.js'
import { DEFAULT_BITS, gradeItem, gradeTask, solutionFor, validateBinaryTask } from './binary.js'

const MODE_LABELS = {
  make_number: 'Make the number',
  to_binary: 'Convert to binary',
  to_decimal: 'Convert to decimal',
  add: 'Binary addition',
}

function emptyItemState(task) {
  const bits = task?.bits ?? DEFAULT_BITS
  return task?.mode === 'to_decimal' ? { answer: '' } : { bits: '0'.repeat(bits), carries: '' }
}

export default defineActivity({
  id: 'binary',
  label: 'Binary',
  category: 'computing',
  icon: '🔢',
  description:
    'Toggle bits to make numbers, convert between binary and decimal, and add in binary.',
  yaml: { type: 'binary' },

  defaultTask: (prev = {}) => ({
    id: prev.id,
    title: prev.title ?? '',
    description: prev.description ?? '',
    taskType: 'activity',
    activityType: 'binary',
    mode: 'make_number',
    bits: DEFAULT_BITS,
    showPlaceValues: true,
    items: [{ id: 'a', target: 5 }],
  }),

  validateTask: (task, { n } = {}) => ({ errors: validateBinaryTask(task, n), warnings: [] }),

  initialState: (task) => ({
    v: 1,
    items: Object.fromEntries((task?.items ?? []).map((item) => [item.id, emptyItemState(task)])),
  }),

  solutionState: (task) => ({
    v: 1,
    items: Object.fromEntries(
      (task?.items ?? []).map((item) => [item.id, solutionFor(task, item)])
    ),
  }),

  // Typing a decimal answer is continuous (synced only while the teacher watches); toggling a
  // bit is a discrete action like choosing a quiz answer.
  classifyChange: (prev, next) => {
    const ids = new Set([...Object.keys(prev?.items ?? {}), ...Object.keys(next?.items ?? {})])
    for (const id of ids) {
      if (prev?.items?.[id]?.answer !== next?.items?.[id]?.answer) return 'continuous'
    }
    return 'discrete'
  },

  grade: (task, state) => {
    const progress = gradeTask(task, state)
    const firstWrong = (task.items ?? []).find(
      (item) => !gradeItem(task, item, state?.items?.[item.id]).correct
    )
    return {
      passed: progress.done,
      suggestion: firstWrong
        ? gradeItem(task, firstWrong, state?.items?.[firstWrong.id]).hint
        : null,
      itemResults: Object.fromEntries(
        (task.items ?? []).map((item) => [
          item.id,
          gradeItem(task, item, state?.items?.[item.id]).correct,
        ])
      ),
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
    const bits = task.bits ?? DEFAULT_BITS
    const rows = (task.items ?? []).map((item) => {
      const solution = solutionFor(task, item)
      const question =
        task.mode === 'to_decimal'
          ? `${esc(item.value)} = ?`
          : task.mode === 'add'
            ? `${esc(item.a)} + ${esc(item.b)} = ?`
            : `Make ${esc(String(item.target))} with ${bits} bits`
      const answer = solution.answer ?? solution.bits
      return `<li>${question} <em>(answer: ${esc(answer)})</em></li>`
    })
    return `<p><strong>${esc(MODE_LABELS[task.mode] ?? 'Binary')}</strong></p><ol>${rows.join('')}</ol>`
  },
})
