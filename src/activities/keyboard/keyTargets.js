// The Keyboard activity's highlight targets (request 133 part B): `key:<key>` makes one key glow
// on the keyboard picture or the on-screen keyboard, from a task's `highlight` field or the
// tutor's Highlight menu (src/shared/controlHighlight.js). Every character on the layout (letters
// once, lower case: `key:A` finds `key:a`), plus Space, Enter, Tab and Shift. OnScreenKeyboard
// marks each key with the same ids (keyHighlightIds). Pure: the CLI reads it too.
import { DEFAULT_LAYOUT, LAYOUTS } from '../../shared/input/index.js'

// What a screen reader says: "Your tutor is pointing at the open bracket key".
const SYMBOL_NAMES = {
  '`': 'backtick',
  '¬': 'not sign',
  '!': 'exclamation mark',
  '"': 'quote',
  '£': 'pound sign',
  $: 'dollar sign',
  '%': 'percent',
  '^': 'caret',
  '&': 'ampersand',
  '*': 'star',
  '(': 'open bracket',
  ')': 'close bracket',
  '-': 'minus',
  _: 'underscore',
  '=': 'equals',
  '+': 'plus',
  '[': 'open square bracket',
  ']': 'close square bracket',
  '{': 'open curly bracket',
  '}': 'close curly bracket',
  ';': 'semicolon',
  ':': 'colon',
  "'": 'single quote',
  '@': 'at sign',
  '#': 'hash',
  '~': 'tilde',
  '\\': 'backslash',
  '|': 'bar',
  ',': 'comma',
  '<': 'less than',
  '.': 'full stop',
  '>': 'greater than',
  '/': 'slash',
  '?': 'question mark',
}

export const NAMED_KEY_TARGETS = ['Space', 'Enter', 'Tab', 'Shift']

// The typed characters a key target can name on a layout, symbols first (what a tutor points at
// most), then digits, then letters.
export function keyTargetChars(layout = DEFAULT_LAYOUT) {
  const chars = Object.keys(LAYOUTS[layout] ?? {}).filter(
    (char) => char.length === 1 && char.trim() !== '' && char === char.toLowerCase()
  )
  const rank = (char) => (/[a-z]/.test(char) ? 2 : /[0-9]/.test(char) ? 1 : 0)
  return chars.sort((a, b) => rank(a) - rank(b))
}

function spokenName(option) {
  if (option === 'Space') return 'Space bar'
  if (option === 'Shift') return 'Shift keys'
  if (NAMED_KEY_TARGETS.includes(option)) return `${option} key`
  if (/^[a-z]$/.test(option)) return `${option.toUpperCase()} key`
  return `${SYMBOL_NAMES[option] ?? option} key`
}

export function keyboardHighlightTargets(layout = DEFAULT_LAYOUT) {
  const options = [...keyTargetChars(layout), ...NAMED_KEY_TARGETS]
  return [
    {
      id: 'key',
      label: 'Keys',
      options,
      optionNames: Object.fromEntries(options.map((option) => [option, spokenName(option)])),
      example: '(',
    },
  ]
}

// The ids a key on the picture answers to (space-separated in data-highlight-target): its plain
// and shifted characters, or its name. `chars` is { plain, shifted } (OnScreenKeyboard's charsByCode).
export function keyHighlightIds(code, chars) {
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'key:Shift'
  if (code === 'Space' || code === 'Enter' || code === 'Tab') return `key:${code}`
  if (!chars) return undefined
  const ids = [chars.plain, chars.shifted]
    .filter((char) => char && char === char.toLowerCase())
    .map((char) => `key:${char}`)
  return ids.length ? ids.join(' ') : undefined
}
