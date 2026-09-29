// Pure logic for the Keyboard activity's edit_text mode: the student starts with a line
// containing mistakes (`start`) and fixes it in place until it reads `target`, editing rather
// than retyping. Node-safe.
//
// The edit model is { text, orig, caret, anchor }:
//   text    the line as it is now
//   orig    one '1' / '0' per character of text: '1' for a character of `start` that has never
//           been deleted, '0' for one the student typed
//   caret   0..text.length, the text cursor
//   anchor  null, or where a Shift selection started (selection = anchor..caret)
// "Edited, not retyped": at least `minKept` of the characters start and target share (their
// longest common subsequence) must still be original characters at the end.

// Keys an item's `requireKeys` may ask for; `select` is any Shift selection (Shift + arrow /
// Home / End, or Ctrl+A).
export const EDIT_REQUIRE_KEYS = [
  'Backspace',
  'Delete',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'select',
]
export const DEFAULT_MIN_KEPT = 0.9

export function lcsLength(a, b) {
  const x = [...String(a ?? '')]
  const y = [...String(b ?? '')]
  let prev = new Array(y.length + 1).fill(0)
  for (let i = 1; i <= x.length; i++) {
    const row = new Array(y.length + 1).fill(0)
    for (let j = 1; j <= y.length; j++) {
      row[j] = x[i - 1] === y[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], row[j - 1])
    }
    prev = row
  }
  return prev[y.length]
}

export function initialEditModel(item) {
  const text = String(item?.start ?? '')
  return { text, orig: '1'.repeat(text.length), caret: text.length, anchor: null }
}

function selectionOf(model) {
  if (model.anchor == null || model.anchor === model.caret) return null
  return [Math.min(model.anchor, model.caret), Math.max(model.anchor, model.caret)]
}

function removeRange(model, from, to) {
  return {
    text: model.text.slice(0, from) + model.text.slice(to),
    orig: model.orig.slice(0, from) + model.orig.slice(to),
    caret: from,
    anchor: null,
  }
}

function moveTo(model, caret, extend) {
  const clamped = Math.max(0, Math.min(model.text.length, caret))
  return { ...model, caret: clamped, anchor: extend ? (model.anchor ?? model.caret) : null }
}

// Applies one normalised keydown ({ key, mods: { shift, mod, alt } }) to the model. Returns
// { model, used } where `used` names the requireKeys token the key counts as (or null), or
// null when the key isn't an editing key (the browser keeps it, e.g. Tab).
export function applyEditKey(model, event) {
  const { key } = event
  const shift = !!event.mods?.shift
  const mod = !!event.mods?.mod
  const selection = selectionOf(model)

  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    const left = key === 'ArrowLeft'
    if (shift) {
      return { model: moveTo(model, model.caret + (left ? -1 : 1), true), used: 'select' }
    }
    const caret = selection ? selection[left ? 0 : 1] : model.caret + (left ? -1 : 1)
    return { model: moveTo(model, caret, false), used: key }
  }
  if (key === 'Home' || key === 'End') {
    const caret = key === 'Home' ? 0 : model.text.length
    return { model: moveTo(model, caret, shift), used: shift ? 'select' : key }
  }
  if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'Enter') {
    return { model, used: null, handled: true }
  }
  if (mod && String(key).toLowerCase() === 'a') {
    return { model: { ...model, anchor: 0, caret: model.text.length }, used: 'select' }
  }
  if (key === 'Backspace') {
    if (selection) return { model: removeRange(model, ...selection), used: key }
    if (model.caret === 0) return { model, used: key }
    return { model: removeRange(model, model.caret - 1, model.caret), used: key }
  }
  if (key === 'Delete') {
    if (selection) return { model: removeRange(model, ...selection), used: key }
    if (model.caret >= model.text.length) return { model, used: key }
    return { model: removeRange(model, model.caret, model.caret + 1), used: key }
  }
  if (String(key).length === 1 && !mod && !event.mods?.alt) {
    const base = selection ? removeRange(model, ...selection) : model
    return {
      model: {
        text: base.text.slice(0, base.caret) + key + base.text.slice(base.caret),
        orig: base.orig.slice(0, base.caret) + '0' + base.orig.slice(base.caret),
        caret: base.caret + 1,
        anchor: null,
      },
      used: null,
    }
  }
  return null
}

// Share of the characters start and target have in common that are still the student's
// original ones (1 when they have none in common).
export function keptShare(item, result) {
  const shared = lcsLength(item?.start, item?.target)
  if (shared === 0) return 1
  const kept = [...String(result?.orig ?? '')].filter((c) => c === '1').length
  return Math.min(1, kept / shared)
}

// The solution result: target reached, keeping every shared character, every required key used.
export function editSolution(item) {
  const start = [...String(item?.start ?? '')]
  const target = [...String(item?.target ?? '')]
  // Mark target characters that line up with start (a longest common subsequence) as original.
  const table = Array.from({ length: start.length + 1 }, () => new Array(target.length + 1).fill(0))
  for (let i = start.length - 1; i >= 0; i--) {
    for (let j = target.length - 1; j >= 0; j--) {
      table[i][j] =
        start[i] === target[j]
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1])
    }
  }
  const orig = new Array(target.length).fill('0')
  for (let i = 0, j = 0; i < start.length && j < target.length;) {
    if (start[i] === target[j]) {
      orig[j] = '1'
      i++
      j++
    } else if (table[i + 1][j] >= table[i][j + 1]) i++
    else j++
  }
  return {
    text: target.join(''),
    orig: orig.join(''),
    caret: target.length,
    anchor: null,
    used: [...(item?.requireKeys ?? [])],
    source: 'hardware',
    done: true,
  }
}

const REQUIRE_HINTS = {
  Delete: 'Put the cursor just before the extra letter and press Delete.',
  Backspace: 'Put the cursor just after the mistake and press Backspace.',
  ArrowLeft: 'Use the arrow keys to move the cursor to the mistake.',
  ArrowRight: 'Use the arrow keys to move the cursor to the mistake.',
  Home: 'Press Home to jump to the start of the line.',
  End: 'Press End to jump to the end of the line.',
  select: 'Hold Shift and press an arrow key to select letters, then delete them.',
}

// Grade one edit_text item from its stored result
// { text, orig, caret, anchor, used, source, done }.
export function gradeEditItem(task, item, result = {}) {
  if (String(result.text ?? item.start ?? '') !== String(item.target ?? '')) {
    return { correct: false, hint: 'Keep going: make the line match exactly.' }
  }
  const minKept = task?.minKept ?? DEFAULT_MIN_KEPT
  if (keptShare(item, result) < minKept) {
    return {
      correct: false,
      retyped: true,
      hint: 'You typed it all again. Try moving the cursor to the mistake with the arrow keys.',
    }
  }
  const used = new Set(result.used ?? [])
  const missing = (item.requireKeys ?? []).find((key) => !used.has(key))
  if (missing) {
    return {
      correct: false,
      hint: `${REQUIRE_HINTS[missing]} Backspace deletes to the left, Delete deletes to the right.`,
    }
  }
  if (result.source === 'virtual')
    return { correct: false, hint: 'Use a real keyboard for this one.' }
  return { correct: true, hint: null }
}

// Validation messages for one edit_text item (`label` is "Task N item M").
export function validateEditItem(item, label, isTypeable, maxLength) {
  const errors = []
  for (const field of ['start', 'target']) {
    const text = item?.[field]
    if (typeof text !== 'string' || text === '') {
      errors.push(`${label}: ${field} is required.`)
    } else if (text.length > maxLength) {
      errors.push(`${label}: ${field} must be at most ${maxLength} characters.`)
    } else {
      const untypeable = [...new Set([...text].filter((c) => !isTypeable(c)))]
      if (untypeable.length) {
        errors.push(
          `${label}: ${field} has characters that can't be typed: ${untypeable.join(' ')}`
        )
      }
    }
  }
  if (typeof item?.start === 'string' && item.start !== '' && item.start === item.target) {
    errors.push(`${label}: start and target are the same, so there is nothing to fix.`)
  }
  if (item?.requireKeys != null) {
    if (!Array.isArray(item.requireKeys)) {
      errors.push(`${label}: requireKeys must be a list, such as [Delete] or [Backspace, select].`)
    } else {
      const unknown = item.requireKeys.filter((key) => !EDIT_REQUIRE_KEYS.includes(key))
      if (unknown.length) {
        errors.push(
          `${label}: requireKeys has keys it can't check (${unknown.join(', ')}). Use ${EDIT_REQUIRE_KEYS.join(', ')}.`
        )
      }
    }
  }
  return errors
}
