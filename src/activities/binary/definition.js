// Binary activity definition (pure). Wraps the logic in ./binary.js in the activity contract.
import { defineActivity } from '../defineActivity.js'
import {
  DEFAULT_BITS,
  BINARY_MODES,
  HEX_BASES,
  ASCII_DIRECTIONS,
  ASCII_CODE_FORMATS,
  PIXEL_DIRECTIONS,
  asciiCode,
  gradeItem,
  gradeTask,
  solutionFor,
  validateBinaryTask,
} from './binary.js'

export const BINARY_MODE_LABELS = {
  make_number: 'Make the number',
  to_binary: 'Convert to binary',
  to_decimal: 'Convert to decimal',
  add: 'Binary addition',
  overflow: 'Overflow',
  hex: 'Hexadecimal',
  ascii: 'ASCII codes',
  pixels: 'Pixel pictures',
}

// The blank answer for one item, in the shape the UI edits (see gradeItem in binary.js).
export function emptyItemState(task, item) {
  const bits = task?.bits ?? DEFAULT_BITS
  switch (task?.mode) {
    case 'overflow':
      return { bits: '0'.repeat(bits), carries: '', overflow: '' }
    case 'hex':
      return item?.to === 'binary' ? { bits: '0'.repeat(bits) } : { answer: '' }
    case 'ascii':
      return item?.direction === 'decode'
        ? { answer: '' }
        : { codes: Array(String(item?.text ?? '').length).fill('') }
    case 'pixels': {
      const height = Number.isInteger(task?.height) ? task.height : 0
      const width = Number.isInteger(task?.width) ? task.width : 0
      return item?.direction === 'encode'
        ? { rows: Array(height).fill('') }
        : { cells: Array(height).fill('0'.repeat(width)) }
    }
    default:
      return task?.mode === 'to_decimal' ? { answer: '' } : { bits: '0'.repeat(bits), carries: '' }
  }
}

// Typed fields are continuous; everything else (bits, carries, the overflow yes/no, pixel
// cells) is a discrete click.
const TYPED_FIELDS = ['answer', 'codes', 'rows']
const same = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b)

export default defineActivity({
  id: 'binary',
  label: 'Binary',
  category: 'computing',
  icon: '🔢',
  description:
    'Toggle bits to make numbers, convert between binary, decimal and hex, add in binary, spot overflow, and use ASCII codes and pixel pictures.',
  yaml: { type: 'binary' },

  fields: {
    modeField: 'mode',
    task: [
      { name: 'mode', type: 'string', required: true, values: BINARY_MODES },
      { name: 'bits', type: 'number', description: '1 to 16 (default 8).' },
      {
        name: 'width',
        type: 'number',
        required: true,
        modes: ['pixels'],
        description: '1 to 16 pixels.',
      },
      { name: 'height', type: 'number', required: true, modes: ['pixels'] },
      { name: 'codeFormat', type: 'string', values: ASCII_CODE_FORMATS, modes: ['ascii'] },
      { name: 'showTable', type: 'boolean', modes: ['ascii'] },
      { name: 'showPlaceValues', type: 'boolean' },
      { name: 'showDecimal', type: 'boolean' },
      { name: 'requireCarries', type: 'boolean', modes: ['add', 'overflow'] },
      {
        name: 'items',
        type: 'array',
        required: true,
        authored: true,
        itemFields: [
          { name: 'id', type: 'string', required: true },
          {
            name: 'target',
            type: 'number',
            required: true,
            authored: true,
            modes: ['make_number', 'to_binary'],
          },
          {
            name: 'value',
            type: 'string',
            required: true,
            authored: true,
            modes: ['to_decimal', 'hex'],
            description: 'A bit string (to_decimal) or a number in the `from` base (hex).',
          },
          {
            name: 'a',
            type: 'string',
            required: true,
            authored: true,
            modes: ['add', 'overflow'],
          },
          {
            name: 'b',
            type: 'string',
            required: true,
            authored: true,
            modes: ['add', 'overflow'],
          },
          { name: 'from', type: 'string', required: true, values: HEX_BASES, modes: ['hex'] },
          { name: 'to', type: 'string', required: true, values: HEX_BASES, modes: ['hex'] },
          { name: 'text', type: 'string', required: true, authored: true, modes: ['ascii'] },
          {
            name: 'rows',
            type: 'array',
            required: true,
            authored: true,
            modes: ['pixels'],
            description: '`height` strings of `width` bits.',
          },
          {
            name: 'direction',
            type: 'string',
            required: true,
            values: [...new Set([...ASCII_DIRECTIONS, ...PIXEL_DIRECTIONS])],
            modes: ['ascii', 'pixels'],
            description: 'ascii: encode | decode; pixels: draw | encode.',
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
    activityType: 'binary',
    mode: 'make_number',
    bits: DEFAULT_BITS,
    showPlaceValues: true,
    items: [{ id: 'a', target: 5 }],
  }),

  validateTask: (task, { n } = {}) => ({ errors: validateBinaryTask(task, n), warnings: [] }),

  initialState: (task) => ({
    v: 1,
    items: Object.fromEntries(
      (task?.items ?? []).map((item) => [item.id, emptyItemState(task, item)])
    ),
  }),

  solutionState: (task) => ({
    v: 1,
    items: Object.fromEntries(
      (task?.items ?? []).map((item) => [item.id, solutionFor(task, item)])
    ),
  }),

  // Typing an answer, a character code or a row of bits is continuous (synced only while the
  // teacher watches); toggling a bit or a pixel, or answering yes/no, is a discrete action like
  // choosing a quiz answer.
  classifyChange: (prev, next) => {
    const ids = new Set([...Object.keys(prev?.items ?? {}), ...Object.keys(next?.items ?? {})])
    for (const id of ids) {
      for (const field of TYPED_FIELDS) {
        if (!same(prev?.items?.[id]?.[field], next?.items?.[id]?.[field])) return 'continuous'
      }
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
      const { question, answer } = printItem(task, item, bits, esc)
      return `<li>${question} <em>(answer: ${answer})</em></li>`
    })
    return `<p><strong>${esc(BINARY_MODE_LABELS[task.mode] ?? 'Binary')}</strong></p><ol>${rows.join('')}</ol>`
  },
})

// A small printable picture of pixel rows (1 = filled).
function pixelTable(rows, esc) {
  const body = rows
    .map(
      (row) =>
        `<tr>${[...row]
          .map(
            (bit) =>
              `<td style="width:12px;height:12px;border:1px solid #999;background:${bit === '1' ? '#222' : '#fff'}"></td>`
          )
          .join('')}</tr>`
    )
    .join('')
  return `<table style="border-collapse:collapse;display:inline-table;vertical-align:middle" aria-label="${esc(rows.join(' '))}">${body}</table>`
}

// Question and answer HTML (already escaped) for one printed item.
function printItem(task, item, bits, esc) {
  const solution = solutionFor(task, item)
  switch (task.mode) {
    case 'overflow':
      return {
        question: `${esc(item.a)} + ${esc(item.b)} = ? Did it overflow?`,
        answer: `${esc(solution.bits)}, yes`,
      }
    case 'hex':
      return {
        question: `${esc(String(item.value))} (${esc(item.from)}) in ${esc(item.to)} = ?`,
        answer: esc(solution.answer ?? solution.bits ?? ''),
      }
    case 'ascii': {
      const format = task.codeFormat ?? 'binary'
      const codes = [...String(item.text ?? '')].map((ch) => asciiCode(ch, format)).join(' ')
      return item.direction === 'decode'
        ? { question: `Decode ${esc(codes)}`, answer: esc(item.text) }
        : { question: `Encode "${esc(item.text)}" (${esc(format)})`, answer: esc(codes) }
    }
    case 'pixels': {
      const rows = Array.isArray(item.rows) ? item.rows.map(String) : []
      return item.direction === 'encode'
        ? { question: `Write the bits for ${pixelTable(rows, esc)}`, answer: esc(rows.join(' ')) }
        : { question: `Draw ${esc(rows.join(' '))}`, answer: pixelTable(rows, esc) }
    }
    default: {
      const question =
        task.mode === 'to_decimal'
          ? `${esc(item.value)} = ?`
          : task.mode === 'add'
            ? `${esc(item.a)} + ${esc(item.b)} = ?`
            : `Make ${esc(String(item.target))} with ${bits} bits`
      return { question, answer: esc(solution.answer ?? solution.bits) }
    }
  }
}
