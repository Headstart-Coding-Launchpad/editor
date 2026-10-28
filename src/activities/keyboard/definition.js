// Keyboard activity definition (pure). Wraps ./keyboard.js in the activity contract.
import { defineActivity } from '../defineActivity.js'
import { DEFAULT_LAYOUT, getKeyForChar } from '../../shared/input/index.js'
import {
  gradeKeyboardItem,
  gradeKeyboardTask,
  keyboardBadgeResult,
  keyboardItems,
  validateKeyboardTask,
  KEYBOARD_MODES,
} from './keyboard.js'
import { roundSummaryText } from '../round.js'
import { EDIT_REQUIRE_KEYS, editSolution } from './editText.js'
import {
  MAX_CODE_LENGTH,
  MAX_CODE_LINES,
  TYPE_CODE_LANGUAGES,
  normaliseCode,
  typeCodeSolution,
} from './typeCode.js'
import {
  DEFAULT_FALLING_SECONDS,
  FALLING_ROUND_ID,
  MAX_FALLING_SECONDS,
  MAX_TOKEN_LENGTH,
  MIN_FALLING_SECONDS,
  fallingSolution,
} from './fallingWords.js'

export const KEYBOARD_MODE_LABELS = {
  type_text: 'Type the text',
  find_key: 'Find the key',
  symbols: 'Type the symbols',
  shortcuts: 'Keyboard shortcuts',
  edit_text: 'Fix the text',
  type_code: 'Type the code',
  falling_words: 'Falling words',
}

const ITEM_MODES = KEYBOARD_MODES.filter((mode) => mode !== 'falling_words')
// Modes whose results carry speed and accuracy, kept as typing history across lessons.
export const HISTORY_MODES = ['type_text', 'type_code', 'falling_words']

function solutionItem(task, item) {
  switch (task.mode) {
    case 'type_text':
      return {
        mode: 'type_text',
        typed: item.text,
        accuracy: 1,
        wpm: task.targetWpm ?? 0,
        cpm: (task.targetWpm ?? 0) * 5,
        corrections: 0,
        timeMs: 0,
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
    case 'edit_text':
      return editSolution(item)
    case 'type_code':
      return typeCodeSolution(task, item)
    case 'falling_words':
      return fallingSolution(task)
    default:
      return {}
  }
}

// The finished typing results of a history mode's items, for typing history.
function keyboardHistoryResults(task, state) {
  if (!HISTORY_MODES.includes(task?.mode)) return []
  return keyboardItems(task).flatMap((item) => {
    const result = state?.items?.[item.id]
    if (!result?.done || !Number.isFinite(Number(result.cpm))) return []
    if (!(Number(result.timeMs) > 0)) return []
    return [
      {
        itemId: String(item.id),
        mode: task.mode,
        cpm: result.cpm,
        wpm: result.wpm ?? Math.round((Number(result.cpm) / 5) * 10) / 10,
        accuracy: result.accuracy ?? 0,
        corrections: result.corrections ?? 0,
        timeMs: result.timeMs,
        ...(result.score != null ? { score: result.score } : {}),
        ...(typeof result.typed === 'string' ? { typed: result.typed } : {}),
        ...(result.solution ? { solution: true } : {}),
      },
    ]
  })
}

// The teacher card line for a falling_words round.
function summarizeFalling(result) {
  if (!result || result.cleared == null) return { text: 'falling: not started', tone: 'neutral' }
  const counts = `${result.cleared} cleared · ${result.missed ?? 0} missed`
  return result.done
    ? { text: `falling: ${counts} · ${result.score ?? 0} pts`, tone: 'success' }
    : { text: `falling: playing · ${counts}`, tone: 'neutral' }
}

export default defineActivity({
  id: 'keyboard',
  label: 'Keyboard skills',
  category: 'digital_skills',
  icon: '⌨️',
  description:
    'Practise typing, capital letters with Shift, symbols on a UK keyboard, shortcuts like Ctrl+C, typing real code, and a falling-words warm-up.',
  yaml: { type: 'keyboard' },
  // Marked as you go: the task passes the moment the core items are done (no Check button).
  completion: 'auto',
  requires: { physicalKeyboard: true },
  // Tablets without a keyboard get the built-in on-screen keyboard; items marked hardwareOnly
  // still need a real one, and so do edit_text, type_code and falling_words (the student view
  // shows a "needs a real keyboard" note for those).
  touchFallback: 'virtual_keyboard',

  fields: {
    modeField: 'mode',
    task: [
      { name: 'mode', type: 'string', required: true, values: KEYBOARD_MODES },
      { name: 'layout', type: 'string', values: ['uk'], description: 'Defaults to uk.' },
      {
        name: 'coreItems',
        type: 'number',
        modes: ITEM_MODES,
        description:
          'How many items make the round (1 to the number of items). The task passes when that many are done; the rest are bonus reps. Defaults to all items.',
      },
      {
        name: 'requireShiftForCapitals',
        type: 'boolean',
        modes: ['type_text'],
        description:
          'Capitals must be typed with Shift, not Caps Lock. Off when left out (a new task made in the Builder turns it on).',
      },
      {
        name: 'minAccuracy',
        type: 'number',
        modes: ['type_text', 'type_code'],
        description: '0 to 1. Defaults to 1 for type_text, 0.9 for type_code.',
      },
      { name: 'targetWpm', type: 'number', modes: ['type_text'] },
      {
        name: 'language',
        type: 'string',
        values: TYPE_CODE_LANGUAGES,
        modes: ['type_code'],
        description:
          'Syntax colouring and the Tab width (4 spaces for python, 2 for html). Defaults to python.',
      },
      {
        name: 'targetCpm',
        type: 'number',
        modes: ['type_code'],
        description: 'Optional speed goal in characters a minute; checked only when set.',
      },
      {
        name: 'showHistory',
        type: 'boolean',
        modes: HISTORY_MODES,
        description:
          "Show the student's last and best score from earlier lessons beside each item, and how far they've come when they finish (needs a class list match). Can also be set per item.",
      },
      {
        name: 'durationSeconds',
        type: 'number',
        modes: ['falling_words'],
        description: `Length of the round, ${MIN_FALLING_SECONDS} to ${MAX_FALLING_SECONDS} (default ${DEFAULT_FALLING_SECONDS}).`,
      },
      {
        name: 'words',
        type: 'array',
        required: true,
        authored: true,
        modes: ['falling_words'],
        description: `Words or code tokens to type (symbols and spaces allowed, at most ${MAX_TOKEN_LENGTH} characters each).`,
      },
      {
        name: 'minKept',
        type: 'number',
        modes: ['edit_text'],
        description:
          'Share (0 to 1, default 0.9) of the characters start and target share that must never be deleted and retyped.',
      },
      {
        name: 'showTarget',
        type: 'boolean',
        modes: ['edit_text'],
        description: 'Show the corrected line above the edit box (default true).',
      },
      {
        name: 'items',
        type: 'array',
        required: true,
        authored: true,
        modes: ITEM_MODES,
        itemFields: [
          { name: 'id', type: 'string', required: true },
          {
            name: 'text',
            type: 'string',
            required: true,
            authored: true,
            modes: ['type_text'],
            description: 'Up to 200 characters, typeable on the layout.',
          },
          {
            name: 'code',
            type: 'string',
            required: true,
            authored: true,
            modes: ['type_code'],
            description: `A block of code, with newlines and indentation (at most ${MAX_CODE_LENGTH} characters, ${MAX_CODE_LINES} lines).`,
          },
          {
            name: 'key',
            type: 'string',
            required: true,
            authored: true,
            modes: ['find_key'],
            description: 'One character or a named key (Enter, Backspace, Delete, …).',
          },
          {
            name: 'char',
            type: 'string',
            required: true,
            authored: true,
            modes: ['symbols'],
          },
          {
            name: 'combo',
            type: 'string',
            required: true,
            authored: true,
            modes: ['shortcuts'],
            description: 'e.g. Ctrl+C.',
          },
          {
            name: 'start',
            type: 'string',
            required: true,
            authored: true,
            modes: ['edit_text'],
            description: 'The line with mistakes the student starts from.',
          },
          {
            name: 'target',
            type: 'string',
            required: true,
            authored: true,
            modes: ['edit_text'],
            description: 'The corrected line.',
          },
          {
            name: 'requireKeys',
            type: 'array',
            values: EDIT_REQUIRE_KEYS,
            modes: ['edit_text'],
            description: 'Keys that must be used while editing; select = any Shift selection.',
          },
          {
            name: 'prompt',
            type: 'string',
            authored: true,
            modes: ['find_key', 'symbols', 'shortcuts', 'edit_text'],
          },
          { name: 'practiceText', type: 'string', authored: true, modes: ['shortcuts'] },
          {
            name: 'requireShiftForCapitals',
            type: 'boolean',
            modes: ['type_text'],
            description: 'Per-item override of the task setting.',
          },
          {
            name: 'showHistory',
            type: 'boolean',
            modes: ['type_text', 'type_code'],
            description: 'Per-item override of the task setting.',
          },
          {
            name: 'hardwareOnly',
            type: 'boolean',
            description: 'Needs a physical keyboard; the on-screen keyboard skips it.',
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
    activityType: 'keyboard',
    mode: 'type_text',
    layout: DEFAULT_LAYOUT,
    requireShiftForCapitals: true,
    items: [{ id: 'a', text: 'Hello World' }],
  }),

  validateTask: (task, { n } = {}) => validateKeyboardTask(task, n),

  initialState: (task) => ({
    v: 1,
    items: Object.fromEntries(keyboardItems(task).map((item) => [item.id, {}])),
  }),

  // Typing modes mark their shown answers `solution: true`, so typing history skips them.
  solutionState: (task) => ({
    v: 1,
    items: Object.fromEntries(
      keyboardItems(task).map((item) => [
        item.id,
        HISTORY_MODES.includes(task.mode)
          ? { ...solutionItem(task, item), solution: true }
          : solutionItem(task, item),
      ])
    ),
  }),

  // Typing history (src/shared/typingHistory.js): every finished type_text, type_code and
  // falling_words result, shown to the student where `showHistory` is set.
  history: {
    modes: (task) => (HISTORY_MODES.includes(task?.mode) ? [task.mode] : []),
    results: (task, state) => keyboardHistoryResults(task, state),
    shows: (task, item) =>
      HISTORY_MODES.includes(task?.mode) && (item?.showHistory ?? task?.showHistory) === true,
  },

  // Keystrokes are continuous (synced only while the teacher watches); finishing an item is a
  // discrete change every teacher card should see, and so is each cleared or missed falling
  // word: the card's "falling: playing · 3 cleared" line has to move while the game runs, not
  // only when it ends (#242).
  classifyChange: (prev, next) => {
    const progress = (state) =>
      Object.values(state?.items ?? {}).reduce(
        (sum, r) =>
          sum +
          (r.pressed || r.performed || r.typedChar || r.done ? 1 : 0) +
          (Number(r.cleared) || 0) +
          (Number(r.missed) || 0),
        0
      )
    return progress(prev) === progress(next) ? 'continuous' : 'discrete'
  },

  // Live badges: Keyboard Ace reads the accuracy of the typing modes.
  badgeResult: (task, state) => keyboardBadgeResult(task, state),

  grade: (task, state) => {
    const result = gradeKeyboardTask(task, state)
    return { passed: result.done, suggestion: result.hint }
  },

  getProgress: (task, state) => {
    const { total, correct, core } = gradeKeyboardTask(task, state)
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
    if (task?.mode === 'falling_words') return summarizeFalling(state?.items?.[FALLING_ROUND_ID])
    const { total, correct, core, done } = gradeKeyboardTask(task, state)
    const doneText = roundSummaryText(correct, total, core)
    if (task?.mode === 'type_code') {
      // Averages over the blocks typed so far: "2/3 done · 94% · 71 cpm".
      const typed = keyboardItems(task)
        .map((item) => state?.items?.[item.id])
        .filter((result) => result?.done)
      const average = (field) =>
        typed.reduce((sum, result) => sum + (result[field] ?? 0), 0) / (typed.length || 1)
      const stats = typed.length
        ? ` · ${Math.round(average('accuracy') * 100)}% · ${Math.round(average('cpm'))} cpm`
        : ''
      return {
        text: `${doneText}${stats}`,
        tone: done ? 'success' : 'neutral',
      }
    }
    // edit_text: say how many finished lines were typed out again instead of edited.
    const retyped =
      task?.mode === 'edit_text'
        ? (task.items ?? []).filter((item) => {
            const result = state?.items?.[item.id]
            return result?.done && gradeKeyboardItem(task, item, result).retyped
          }).length
        : 0
    return {
      text: `${doneText}${retyped ? ` · ${retyped} retyped` : ''}`,
      tone: done ? 'success' : 'neutral',
    }
  },

  printHtml: (task, { esc }) => {
    const heading = `<p><strong>${esc(KEYBOARD_MODE_LABELS[task.mode] ?? 'Keyboard')}</strong></p>`
    if (task.mode === 'falling_words') {
      const words = (task.words ?? []).map((word) => `<code>${esc(word)}</code>`).join(' ')
      return `${heading}<p>${task.durationSeconds ?? DEFAULT_FALLING_SECONDS} seconds: ${words}</p>`
    }
    if (task.mode === 'type_code') {
      const blocks = (task.items ?? []).map(
        (item) => `<li><pre><code>${esc(normaliseCode(item.code, task.language))}</code></pre></li>`
      )
      return `${heading}<ol>${blocks.join('')}</ol>`
    }
    const rows = (task.items ?? []).map((item) => {
      const text =
        item.start != null
          ? `${item.start} → ${item.target ?? ''}`
          : (item.text ?? item.key ?? item.char ?? item.combo ?? '')
      const prompt = item.prompt ? ` — ${esc(item.prompt)}` : ''
      return `<li><code>${esc(text)}</code>${prompt}</li>`
    })
    return `${heading}<ol>${rows.join('')}</ol>`
  },
})
