// Small, serialisable summaries of recorded input. Summaries are what input checks evaluate and
// what may be synced to the teacher; raw event logs never leave the student's device.
// Pure.

import { comboOf, isModifierKey } from './events.js'
import { recognizeGestures } from './gestures.js'

const isLetter = (char) => char.toLowerCase() !== char.toUpperCase()

// Printable characters typed, with how each was produced. Uppercase letters record whether
// Shift or Caps Lock made them, so a check can require "used Shift, not Caps Lock".
export function typedCharacters(events) {
  return events
    .filter(
      (e) =>
        e.kind === 'keydown' &&
        !isModifierKey(e.key) &&
        e.key.length === 1 &&
        !e.mods.mod &&
        !e.mods.alt
    )
    .map((e) => {
      const upperLetter = isLetter(e.key) && e.key === e.key.toUpperCase()
      let method = null
      if (upperLetter) method = e.mods.shift ? 'shift' : e.capsLock ? 'caps_lock' : null
      return { char: e.key, shift: e.mods.shift, capsLock: e.capsLock, method, source: e.source }
    })
}

export function summarizeInput(events) {
  const keydowns = events.filter((e) => e.kind === 'keydown' && !e.repeat)
  const typed = typedCharacters(events)
  const shortcuts = {}
  for (const event of keydowns) {
    const combo = comboOf(event)
    if (combo && (event.mods.mod || event.mods.alt)) shortcuts[combo] = (shortcuts[combo] ?? 0) + 1
  }
  const gestures = recognizeGestures(events.filter((e) => e.pointerType || e.kind === 'scroll'))
  const count = (name) => gestures.filter((g) => g.gesture === name).length
  const times = events.map((e) => e.t).filter((t) => typeof t === 'number')
  const pointerTypes = [...new Set(events.map((e) => e.pointerType).filter(Boolean))].sort()
  const sources = [...new Set(events.map((e) => e.source).filter(Boolean))].sort()

  return {
    keystrokes: keydowns.filter((e) => !isModifierKey(e.key)).length,
    shiftCapitals: typed.filter((c) => c.method === 'shift').length,
    capsLockCapitals: typed.filter((c) => c.method === 'caps_lock').length,
    shortcuts,
    clicks: count('click'),
    doubleClicks: count('double_click'),
    rightClicks: count('right_click'),
    drags: count('drag'),
    scrolls: count('scroll'),
    hovers: count('hover'),
    taps: count('tap'),
    doubleTaps: count('double_tap'),
    longPresses: count('long_press'),
    pointerTypes,
    sources,
    durationMs: times.length ? Math.max(...times) - Math.min(...times) : 0,
  }
}

// Accuracy compares the typed text with the target position by position; WPM uses the
// standard five characters per word and counts only correct characters.
export function typingStats(target, typed, durationMs) {
  const targetText = String(target ?? '')
  const typedText = String(typed ?? '')
  let correct = 0
  for (let i = 0; i < typedText.length; i += 1) if (typedText[i] === targetText[i]) correct += 1
  const accuracy = typedText.length ? correct / typedText.length : 1
  const minutes = durationMs > 0 ? durationMs / 60000 : 0
  const wpm = minutes > 0 ? correct / 5 / minutes : 0
  return {
    correctChars: correct,
    typedChars: typedText.length,
    accuracy: Math.round(accuracy * 1000) / 1000,
    wpm: Math.round(wpm * 10) / 10,
    complete: typedText === targetText,
  }
}
