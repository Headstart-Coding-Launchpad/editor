// Small, serialisable summaries of recorded input. Summaries are what input checks evaluate and
// what may be synced to the teacher; raw event logs never leave the student's device.
// Pure.

import { isModifierKey } from './events.js'

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
