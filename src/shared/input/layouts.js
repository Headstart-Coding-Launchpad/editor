// Keyboard layout tables: which physical key (KeyboardEvent.code) and whether Shift is needed to
// type each character. Keyboard activities use this to prompt ("press Shift + 2") and to check a
// student used the right technique. UK only for now; add a layout by adding a table to LAYOUTS.
// Pure: safe to import from the CLI and from Node tests.

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'

// Keys whose unshifted/shifted characters differ between layouts: [code, unshifted, shifted].
const UK_SYMBOL_KEYS = [
  ['Backquote', '`', '¬'],
  ['Digit1', '1', '!'],
  ['Digit2', '2', '"'],
  ['Digit3', '3', '£'],
  ['Digit4', '4', '$'],
  ['Digit5', '5', '%'],
  ['Digit6', '6', '^'],
  ['Digit7', '7', '&'],
  ['Digit8', '8', '*'],
  ['Digit9', '9', '('],
  ['Digit0', '0', ')'],
  ['Minus', '-', '_'],
  ['Equal', '=', '+'],
  ['BracketLeft', '[', '{'],
  ['BracketRight', ']', '}'],
  ['Semicolon', ';', ':'],
  ['Quote', "'", '@'],
  // The UK # key sits beside Enter; browsers report its code as Backslash.
  ['Backslash', '#', '~'],
  ['IntlBackslash', '\\', '|'],
  ['Comma', ',', '<'],
  ['Period', '.', '>'],
  ['Slash', '/', '?'],
]

// Friendly names for the keys students are asked to find.
const KEY_LABELS = {
  Backquote: '`',
  Digit1: '1',
  Digit2: '2',
  Digit3: '3',
  Digit4: '4',
  Digit5: '5',
  Digit6: '6',
  Digit7: '7',
  Digit8: '8',
  Digit9: '9',
  Digit0: '0',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Semicolon: ';',
  Quote: "'",
  Backslash: '#',
  IntlBackslash: '\\',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Space: 'Space',
  Enter: 'Enter',
  Tab: 'Tab',
  Backspace: 'Backspace',
}

function buildLayout(symbolKeys) {
  const chars = {}
  for (const letter of LETTERS) {
    const code = `Key${letter.toUpperCase()}`
    chars[letter] = { code, shift: false }
    chars[letter.toUpperCase()] = { code, shift: true }
    KEY_LABELS[code] ??= letter.toUpperCase()
  }
  for (const [code, plain, shifted] of symbolKeys) {
    chars[plain] = { code, shift: false }
    chars[shifted] = { code, shift: true }
  }
  chars[' '] = { code: 'Space', shift: false }
  chars['\n'] = { code: 'Enter', shift: false }
  chars['\t'] = { code: 'Tab', shift: false }
  return chars
}

export const LAYOUTS = {
  uk: buildLayout(UK_SYMBOL_KEYS),
}

export const DEFAULT_LAYOUT = 'uk'

export function isSupportedLayout(layout) {
  return Object.prototype.hasOwnProperty.call(LAYOUTS, layout)
}

// { code, shift } for a character, or null when the layout can't type it.
export function getKeyForChar(char, layout = DEFAULT_LAYOUT) {
  return LAYOUTS[layout]?.[char] ?? null
}

export function keyLabel(code) {
  return KEY_LABELS[code] ?? code
}

// Human-readable instruction for typing a character, e.g. '"' -> 'Shift + 2' on UK.
export function describeCharKeys(char, layout = DEFAULT_LAYOUT) {
  const key = getKeyForChar(char, layout)
  if (!key) return null
  const label = keyLabel(key.code)
  return key.shift ? `Shift + ${label}` : label
}
