// Pure logic for the Keyboard activity: task validation and grading for type_text, find_key,
// symbols and shortcuts. The student view records input with src/shared/input and stores a
// small per-item result; this file only reads those results. Node-safe.

import {
  DEFAULT_LAYOUT,
  describeCharKeys,
  getKeyForChar,
  isReservedCombo,
  isSupportedLayout,
  normalizeCombo,
} from '../../shared/input/index.js'

export const KEYBOARD_MODES = ['type_text', 'find_key', 'symbols', 'shortcuts']

// Named keys a find_key item may ask for, besides any typeable character.
export const NAMED_KEYS = [
  'Enter',
  'Backspace',
  'Tab',
  'Shift',
  'Space',
  'CapsLock',
  'Delete',
  'Escape',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
]

const MAX_TEXT_LENGTH = 200

const capitalsIn = (text) => [...text].filter((c) => c !== c.toLowerCase()).length

export function validateKeyboardTask(task, n) {
  const errors = []
  const warnings = []
  const where = `Task ${n}`
  if (!KEYBOARD_MODES.includes(task?.mode)) {
    errors.push(`${where}: keyboard mode must be one of ${KEYBOARD_MODES.join(', ')}.`)
    return { errors, warnings }
  }
  const layout = task.layout ?? DEFAULT_LAYOUT
  if (!isSupportedLayout(layout)) {
    errors.push(`${where}: keyboard layout "${layout}" is not supported (use "uk").`)
    return { errors, warnings }
  }
  if (task.minAccuracy != null && !(task.minAccuracy > 0 && task.minAccuracy <= 1)) {
    errors.push(`${where}: minAccuracy must be a number above 0 and at most 1.`)
  }
  if (task.targetWpm != null && !(Number.isFinite(task.targetWpm) && task.targetWpm > 0)) {
    errors.push(`${where}: targetWpm must be a positive number.`)
  }
  const items = Array.isArray(task.items) ? task.items : []
  if (items.length === 0) errors.push(`${where}: keyboard task needs at least one item.`)
  const seen = new Set()
  items.forEach((item, i) => {
    const label = `${where} item ${i + 1}`
    if (item?.id == null || item.id === '') errors.push(`${label}: needs an id.`)
    else if (seen.has(String(item.id)))
      errors.push(`${label}: id "${item.id}" is used more than once.`)
    seen.add(String(item?.id))

    if (task.mode === 'type_text') {
      const text = String(item?.text ?? '')
      if (!text) errors.push(`${label}: text is required.`)
      else if (text.length > MAX_TEXT_LENGTH) {
        errors.push(`${label}: text must be at most ${MAX_TEXT_LENGTH} characters.`)
      } else {
        const untypeable = [...new Set([...text].filter((c) => !getKeyForChar(c, layout)))]
        if (untypeable.length) {
          errors.push(
            `${label}: can't be typed on a ${layout.toUpperCase()} keyboard: ${untypeable.join(' ')}`
          )
        }
      }
    } else if (task.mode === 'find_key') {
      const key = item?.key
      if (!NAMED_KEYS.includes(key) && !(typeof key === 'string' && getKeyForChar(key, layout))) {
        errors.push(`${label}: key must be a character or one of ${NAMED_KEYS.join(', ')}.`)
      }
    } else if (task.mode === 'symbols') {
      const char = item?.char
      if (typeof char !== 'string' || [...char].length !== 1 || !getKeyForChar(char, layout)) {
        errors.push(
          `${label}: char must be one character that can be typed on a ${layout.toUpperCase()} keyboard.`
        )
      }
    } else if (task.mode === 'shortcuts') {
      const combo = normalizeCombo(item?.combo)
      if (!combo || !combo.includes('+')) {
        errors.push(`${label}: combo must be a shortcut like "Ctrl+C".`)
      } else if (isReservedCombo(combo)) {
        errors.push(
          `${label}: "${item.combo}" is kept by the browser, so students can't press it here. Teach it with a quiz question instead.`
        )
      }
      if (!item?.prompt)
        warnings.push(`${label}: add a prompt telling students what the shortcut does.`)
    }
  })
  return { errors, warnings }
}

// What the student has to press, in words ("Shift + 2"), for prompts and hints.
export function describeItem(task, item) {
  const layout = task?.layout ?? DEFAULT_LAYOUT
  switch (task?.mode) {
    case 'symbols':
      return describeCharKeys(item.char, layout)
    case 'find_key':
      return NAMED_KEYS.includes(item.key) ? item.key : describeCharKeys(item.key, layout)
    case 'shortcuts':
      return normalizeCombo(item.combo)
        .split('+')
        .map((part) => (part === 'mod' ? 'Ctrl' : part.length === 1 ? part.toUpperCase() : part))
        .join(' + ')
    default:
      return null
  }
}

// Grade one item from the result the student view stored for it:
//   type_text: { typed, accuracy, wpm, shiftCapitals, capsLockCapitals, source }
//   find_key:  { pressed }
//   symbols:   { typedChar, shift }
//   shortcuts: { performed, via }   (via: 'keyboard' | 'menu')
export function gradeKeyboardItem(task, item, result = {}) {
  const hardwareOk = !item.hardwareOnly || result.source !== 'virtual'
  switch (task?.mode) {
    case 'type_text': {
      const typed = String(result.typed ?? '')
      const minAccuracy = task.minAccuracy ?? 1
      const accurate =
        typed === item.text ||
        (typed.length >= item.text.length && (result.accuracy ?? 0) >= minAccuracy)
      if (!accurate) return { correct: false, hint: 'Check your typing matches the line exactly.' }
      const needsShift =
        (item.requireShiftForCapitals ?? task.requireShiftForCapitals) && capitalsIn(item.text) > 0
      if (needsShift && (result.capsLockCapitals ?? 0) > 0) {
        return {
          correct: false,
          hint: 'Try holding Shift for capital letters instead of Caps Lock.',
        }
      }
      if (task.targetWpm && (result.wpm ?? 0) < task.targetWpm) {
        return {
          correct: false,
          hint: `Nearly! Try again a little faster (aim for ${task.targetWpm} words a minute).`,
        }
      }
      if (!hardwareOk) return { correct: false, hint: 'Use a real keyboard for this one.' }
      return { correct: true, hint: null }
    }
    case 'find_key':
      return result.pressed && hardwareOk
        ? { correct: true, hint: null }
        : { correct: false, hint: `Look for the ${describeItem(task, item)} key.` }
    case 'symbols': {
      const key = getKeyForChar(item.char, task.layout ?? DEFAULT_LAYOUT)
      if (result.typedChar === item.char && (!key?.shift || result.shift) && hardwareOk) {
        return { correct: true, hint: null }
      }
      return { correct: false, hint: `Press ${describeItem(task, item)}.` }
    }
    case 'shortcuts':
      if (result.performed && result.via === 'keyboard' && hardwareOk)
        return { correct: true, hint: null }
      return result.performed
        ? { correct: false, hint: `Use the keys this time: ${describeItem(task, item)}.` }
        : { correct: false, hint: `Press ${describeItem(task, item)}.` }
    default:
      return { correct: false, hint: null }
  }
}

export function gradeKeyboardTask(task, state = {}) {
  const items = task?.items ?? []
  const results = items.map((item) => gradeKeyboardItem(task, item, state.items?.[item.id]))
  const correct = results.filter((r) => r.correct).length
  const firstWrong = results.find((r) => !r.correct)
  return {
    total: items.length,
    correct,
    done: items.length > 0 && correct === items.length,
    hint: firstWrong?.hint ?? null,
  }
}
