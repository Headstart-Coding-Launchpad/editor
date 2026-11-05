// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { codesForKey } from '../OnScreenKeyboard.jsx'
import { describeCharKeys } from '../../../shared/input/index.js'

// The UK Shift pairing the showKey glow lights (request 133): the symbol's key and both Shift
// keys, read from the on-screen keyboard's own key map.
const SHIFTED = {
  '(': 'Digit9',
  ')': 'Digit0',
  '"': 'Digit2',
  '£': 'Digit3',
  ':': 'Semicolon',
  '{': 'BracketLeft',
  '}': 'BracketRight',
  '+': 'Equal',
  '@': 'Quote',
  '~': 'Backslash',
  '!': 'Digit1',
  _: 'Minus',
  '?': 'Slash',
}
const PLAIN = {
  ',': 'Comma',
  '=': 'Equal',
  '.': 'Period',
  ';': 'Semicolon',
  '[': 'BracketLeft',
  ']': 'BracketRight',
  '#': 'Backslash',
  "'": 'Quote',
}

describe('UK Shift pairing (showKey)', () => {
  it.each(Object.entries(SHIFTED))('%s lights its key and both Shift keys', (char, code) => {
    expect(codesForKey(char, 'uk')).toEqual([code, 'ShiftLeft', 'ShiftRight'])
    expect(describeCharKeys(char, 'uk')).toMatch(/^Shift \+ /)
  })

  it.each(Object.entries(PLAIN))('%s lights only its key, no Shift', (char, code) => {
    expect(codesForKey(char, 'uk')).toEqual([code])
  })

  it('says the words shown under the big symbol', () => {
    expect(describeCharKeys('(', 'uk')).toBe('Shift + 9')
    expect(describeCharKeys('"', 'uk')).toBe('Shift + 2')
    expect(describeCharKeys(':', 'uk')).toBe('Shift + ;')
    expect(describeCharKeys('@', 'uk')).toBe("Shift + '")
    expect(describeCharKeys('~', 'uk')).toBe('Shift + #')
  })
})
