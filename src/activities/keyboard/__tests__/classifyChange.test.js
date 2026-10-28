// @vitest-environment node
import { describe, expect, it } from 'vitest'
import keyboard from '../definition.js'

// What the tutor card sees without watching: a finished item, and each cleared or missed
// falling word (#242). Keystrokes inside an item stay continuous.
describe('keyboard classifyChange', () => {
  it('treats a keystroke inside an item as continuous', () => {
    const prev = { items: { a: { typed: 'H' } } }
    const next = { items: { a: { typed: 'Hi' } } }
    expect(keyboard.classifyChange(prev, next)).toBe('continuous')
  })

  it('treats a finished item as discrete', () => {
    const prev = { items: { a: { typed: 'Hi Sam' } } }
    const next = { items: { a: { typed: 'Hi Sam', done: true } } }
    expect(keyboard.classifyChange(prev, next)).toBe('discrete')
  })

  it('treats a cleared or missed falling word as discrete, so the card moves during the game', () => {
    const playing = { items: { fw: { cleared: 2, missed: 1 } } }
    expect(keyboard.classifyChange(playing, { items: { fw: { cleared: 3, missed: 1 } } })).toBe(
      'discrete'
    )
    expect(keyboard.classifyChange(playing, { items: { fw: { cleared: 2, missed: 2 } } })).toBe(
      'discrete'
    )
    expect(keyboard.classifyChange(playing, { items: { fw: { cleared: 2, missed: 1 } } })).toBe(
      'continuous'
    )
  })
})
