// Locked lines in the CodeMirror editor (see ./lockedLines.js for the authoring side and the
// anchoring). A locked line is greyed with a 🔒 icon (labelled "Locked") and can't be typed in, deleted,
// cut, pasted over, re-indented or merged with its neighbours. New lines can still be added
// before, between and after locked lines:
//   - Enter on a locked line adds a new line: above it when the cursor is at (or before) the
//     line's first character, else below it.
//   - Backspace at the start of the line after a locked line, or Delete at the end of a locked
//     line, only works when it removes an empty line (it would otherwise merge a line into it).
//   - A deletion that spans locked lines (select-all + delete, cut, paste over) keeps them: the
//     text around them goes, the locked lines and the line breaks before them stay.
//   - The caret never rests inside locked text (calmer guided editor, 25 Nov; see
//     lockedSelectionFilter), and the touch keyboard stays shut there (inputmode="none"). A
//     refused edit shows a note beside the caret until the next key or click.
//
// Only the student's own edits are guarded (transactions with a user event, other than undo and
// redo). A value replaced from outside (task switch, Reset, a support stage, a teacher edit)
// goes through, and the locks are re-anchored by text on the new code — as are undo and redo.
//
// A VALUES lock (`#@lock-values`, P6-22) is a locked line whose values stay editable: the text
// between a plain string's quote marks (empty strings too) and its numbers (lineValueSpans in
// ./lockedLines.js), marked with the shared "you can change this" look (./editableValueStyle.js).
// An edit on such a line goes through only when it stays inside the line and leaves its value
// skeleton as it was. Its caret is always in a value (lockedSelectionFilter, tabField).
//
// EDIT ZONES (P6-30):
//   - A FENCED lock (`#@lock-first` / `#@lock-last`) is a locked line nothing can be added
//     before / after. Typing, Enter or a paste on the fenced side goes to the other side of the
//     line instead, with "This line stays last. Add your code above it."; any other edit that
//     would add there is dropped with that note. Enter on the line adds on its open side.
//   - A SLOT (`#@slot`, `#@slot n`) is an editable stretch of at most n lines (one by default),
//     a dashed row. An edit that would give it more lines, or join a line onto it, is dropped
//     with "This space takes one line"; a deletion across slots clears their text. Enter goes
//     from slot to slot (enterInSlots).
//   - `puzzle.noNewLines`: an edit that adds lines outside the slots is dropped.
//
// Dispatch `setLockedLineSets.of(sets)` (the task's lock sets, getTaskLockSets) to (re)place the
// locks; `[]` or null clears them.
import {
  EditorSelection,
  EditorState,
  Prec,
  StateEffect,
  StateField,
  Transaction,
} from '@codemirror/state'
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  keymap,
  showTooltip,
} from '@codemirror/view'
import { insertNewlineAndIndent } from '@codemirror/commands'
import { chooseZones, lineValueSpans, scanLineValues } from './lockedLines.js'
import {
  EDITABLE_VALUE_CLASS,
  EDITABLE_VALUE_EMPTY_CLASS,
  editableValueTheme,
} from './editableValueStyle.js'

export const LOCKED_LINE_NOTE = 'This line is locked'
export const LOCKED_VALUES_NOTE = 'Only the values on this line can change'
export const LOCKED_VALUES_TAG = 'Change the values only'
export const FENCE_LAST_NOTE = 'This line stays last. Add your code above it.'
export const FENCE_FIRST_NOTE = 'This line stays first. Add your code below it.'
export const NO_NEW_LINES_NOTE = 'No new lines in this task. Change the lines you can edit.'
export const slotNote = (size) =>
  size > 1 ? `This space takes up to ${size} lines` : 'This space takes one line'

export const setLockedLineSets = StateEffect.define()
// Shows the "This line is locked" note at a position (null hides it).
export const showLockedNote = StateEffect.define()

// `{ positions, values, first, last, slots, noNewLines }`: the start of each locked line, of
// each values-locked one and of the fenced ones (null when none); each slot's `{ from, to,
// size }` (its first line's start, its last line's end); and puzzle.noNewLines.
function anchorPositions(doc, sets) {
  const { locks, slots, noNewLines } = chooseZones(doc.toString(), sets)
  const start = (lock) => (lock ? doc.line(lock.line).from : null)
  return {
    positions: locks.map(start),
    values: locks.filter((lock) => lock.values).map(start),
    first: start(locks.find((lock) => lock.fence === 'first')),
    last: start(locks.find((lock) => lock.fence === 'last')),
    slots: slots.map((slot) => ({
      from: doc.line(slot.line).from,
      to: doc.line(slot.line + slot.lines - 1).to,
      size: slot.size,
    })),
    noNewLines,
  }
}

// A slot's edges through a change: its start stays before text typed there, its end after.
function mapSlot(slot, changes) {
  return { from: changes.mapPos(slot.from, -1), to: changes.mapPos(slot.to, 1), size: slot.size }
}

function mapLineStarts(starts, tr) {
  const out = []
  for (const pos of starts) {
    const mapped = tr.state.doc.lineAt(tr.changes.mapPos(pos, 1)).from
    if (!out.includes(mapped)) out.push(mapped)
  }
  return out.sort((a, b) => a - b)
}

// Whether a document change is the student's own guarded edit (see the header).
function isGuardedEdit(tr) {
  const event = tr.annotation(Transaction.userEvent)
  if (!event) return false
  return !tr.isUserEvent('undo') && !tr.isUserEvent('redo')
}

/**
 * Holds `{ sets, positions, values }`: the lock sets, the start of each locked line (ascending),
 * and the starts of the values-locked ones among them.
 */
export const lockedLinesField = StateField.define({
  create() {
    return { sets: [], positions: [], values: [], first: null, last: null, slots: [] }
  },
  update(value, tr) {
    let next = value
    if (tr.docChanged && value.sets.length > 0) {
      if (isGuardedEdit(tr)) {
        // A guarded edit never breaks a locked line (a values line only changes inside its
        // values) or a slot's edges, so each one moves with its line.
        const mapStart = (pos) => (pos == null ? null : mapLineStarts([pos], tr)[0])
        next = {
          sets: value.sets,
          positions: mapLineStarts(value.positions, tr),
          values: mapLineStarts(value.values, tr),
          first: mapStart(value.first),
          last: mapStart(value.last),
          slots: value.slots.map((slot) => mapSlot(slot, tr.changes)),
          noNewLines: value.noNewLines,
        }
      } else {
        next = { sets: value.sets, ...anchorPositions(tr.state.doc, value.sets) }
      }
    }
    for (const effect of tr.effects) {
      if (!effect.is(setLockedLineSets)) continue
      const sets = Array.isArray(effect.value) ? effect.value.filter(Array.isArray) : []
      next = { sets, ...anchorPositions(tr.state.doc, sets) }
    }
    return next
  },
})

/** The locked line numbers of a state (1-based, ascending). */
export function getLockedLineNumbers(state) {
  const field = state.field(lockedLinesField, false)
  if (!field) return []
  return field.positions.map((pos) => state.doc.lineAt(pos).number)
}

// The locked lines of a state as `{ from, to, values }` ranges (their text, no line break).
function lockedRanges(state) {
  const field = state.field(lockedLinesField, false)
  if (!field) return []
  return field.positions.map((pos) => {
    const line = state.doc.lineAt(pos)
    return { from: line.from, to: line.to, values: field.values.includes(pos) }
  })
}

/** Whether the locked line starting at `lineFrom` is a values lock (#@lock-values). */
function isValuesLine(state, lineFrom) {
  return !!state.field(lockedLinesField, false)?.values.includes(lineFrom)
}

/**
 * The editable value spans of the values-locked line `pos` is on, as document `{ from, to }`
 * ranges, or null when `pos` is not on a values-locked line.
 */
export function lockedValueSpansAt(state, pos) {
  const line = lockedLineAt(state, pos)
  if (!line || !isValuesLine(state, line.from)) return null
  return lineValueSpans(line.text).map((span) => ({
    from: line.from + span.from,
    to: line.from + span.to,
    kind: span.kind,
  }))
}

/** The locked line `pos` is on, or null. */
export function lockedLineAt(state, pos) {
  const field = state.field(lockedLinesField, false)
  if (!field || field.positions.length === 0) return null
  const line = state.doc.lineAt(pos)
  return field.positions.includes(line.from) ? line : null
}

/** Whether `pos` is on a locked line (values-locked lines included). */
export function isLockedPos(state, pos) {
  return lockedLineAt(state, pos) != null
}

/**
 * Whether `pos` is on a fully locked line (not a values lock): nothing there can change, so
 * scrubbing is off. A values-locked line's numbers and colours still scrub.
 */
export function isFullyLockedPos(state, pos) {
  const line = lockedLineAt(state, pos)
  return !!line && !isValuesLine(state, line.from)
}

/**
 * Whether one change keeps a values-locked line (`range`, `{ from, to }` in `doc`) intact: it
 * stays inside the line, adds no line break, and leaves the line's value skeleton as it was
 * (only string contents and numbers changed), or flips one whole True / False to the other (a
 * scrub's click, P6-31; typing over one still can't, as a half-typed word changes the skeleton).
 */
export function valuesChangeAllowed(doc, range, change) {
  const insert = change.insert ?? ''
  if (change.from < range.from || change.to > range.to || insert.includes('\n')) return false
  const text = doc.sliceString(range.from, range.to)
  const from = change.from - range.from
  const to = change.to - range.from
  if (isBooleanFlip(text, from, to, insert)) return true
  const next = text.slice(0, from) + insert + text.slice(to)
  return scanLineValues(next).skeleton === scanLineValues(text).skeleton
}

const BOOLEAN_FLIPS = { True: 'False', False: 'True' }

// Whether replacing text[from, to) with `insert` swaps a whole True for False or back.
function isBooleanFlip(text, from, to, insert) {
  const word = text.slice(from, to)
  if (BOOLEAN_FLIPS[word] !== insert) return false
  return !/[\w.]/.test(text[from - 1] ?? '') && !/\w/.test(text[to] ?? '')
}

/**
 * Whether one change (`{ from, to, insert }` in `doc`, a CodeMirror Text) would alter the locked
 * line `range` (`{ from, to }`): change its text, or join another line onto it.
 */
export function changeBreaksLock(doc, range, change) {
  const { from, to } = change
  const insert = change.insert ?? ''
  if (from === to && insert === '') return false
  // Touches the line's text, or inserts inside it.
  if (from < range.to && to > range.from) return true
  if (from === to && from > range.from && from < range.to) return true
  // Ends where the line starts: what's left before it on its line must be nothing.
  if (to === range.from) {
    if (insert.endsWith('\n')) return false
    return !(insert === '' && doc.lineAt(from).from === from)
  }
  // Starts where the line ends: what follows it on its line must be nothing.
  if (from === range.to) {
    if (insert.startsWith('\n')) return false
    return !(insert === '' && doc.lineAt(to).to === to)
  }
  return false
}

// The spans a deletion is cut around: each locked line plus the line break before it.
function protectedSpans(ranges) {
  const spans = []
  for (const range of ranges) {
    const from = range.from > 0 ? range.from - 1 : range.from
    const last = spans[spans.length - 1]
    if (last && from <= last.to) last.to = Math.max(last.to, range.to)
    else spans.push({ from, to: range.to })
  }
  return spans
}

/**
 * Filters one change against the locked lines (`ranges`, ascending): `{ kept, blocked, at }`.
 * `kept` lists the change, or what is left of it, that leaves every locked line as it was — a
 * deletion spanning locked lines is cut around them (the insert stays with the first piece);
 * `blocked` says something was dropped, and `at` is the start of the first locked line it hit.
 */
export function filterLockedChange(doc, ranges, change) {
  const insert = change.insert ?? ''
  const hit = (c) =>
    ranges.find(
      (range) =>
        changeBreaksLock(doc, range, c) && !(range.values && valuesChangeAllowed(doc, range, c))
    ) ?? null
  const first = hit({ ...change, insert })
  if (!first)
    return { kept: [{ from: change.from, to: change.to, insert }], blocked: false, at: null }
  const kept = []
  if (change.from < change.to) {
    let pieces = [{ from: change.from, to: change.to }]
    for (const span of protectedSpans(ranges)) {
      pieces = pieces.flatMap((piece) => {
        if (span.to <= piece.from || span.from >= piece.to) return [piece]
        const out = []
        if (piece.from < span.from) out.push({ from: piece.from, to: span.from })
        if (span.to < piece.to) out.push({ from: span.to, to: piece.to })
        return out
      })
    }
    for (const piece of pieces) {
      const withInsert = piece.from === change.from && insert ? { ...piece, insert } : null
      if (withInsert && !hit(withInsert)) {
        kept.push(withInsert)
        continue
      }
      const bare = { ...piece, insert: '' }
      if (piece.from < piece.to && !hit(bare)) kept.push(bare)
    }
  }
  return { kept, blocked: true, at: first.from }
}

// The guard: cuts a student's edit down to what leaves the locked lines alone.
const lockedEditFilter = EditorState.transactionFilter.of((tr) => {
  if (!tr.docChanged || !isGuardedEdit(tr)) return tr
  const ranges = lockedRanges(tr.startState)
  if (ranges.length === 0) return tr
  const doc = tr.startState.doc
  const specs = []
  let blockedAt = null
  tr.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    const result = filterLockedChange(doc, ranges, {
      from: fromA,
      to: toA,
      insert: inserted.toString(),
    })
    specs.push(...result.kept)
    if (result.blocked && blockedAt == null) blockedAt = result.at
  })
  if (blockedAt == null) return tr
  const changes = tr.startState.changes(specs)
  const event = tr.annotation(Transaction.userEvent)
  const values = isValuesLine(tr.startState, blockedAt)
  const selection = tr.startState.selection.map(changes, 1)
  return {
    changes,
    selection,
    effects: tr.startState.readOnly
      ? []
      : [showLockedNote.of({ pos: selection.main.head, values })],
    annotations: event ? [Transaction.userEvent.of(event)] : [],
  }
})

// ─── Edit zones (P6-30) ──────────────────────────────────────────────────────

const newlineCount = (text) => (text.match(/\n/g) ?? []).length

/**
 * What is wrong with a student's edit (`changes`) against the edit zones of `state`: null when
 * nothing, else `{ kind, at, size? }` — 'slot' (a slot would have too many lines, or a line would
 * join onto it), 'last' / 'first' (something added on a fenced side) or 'noNewLines' (lines added
 * outside the slots). `at` is where its note shows.
 */
export function zoneViolation(state, changes) {
  const field = state.field(lockedLinesField, false)
  if (!field) return null
  const oldDoc = state.doc
  const newDoc = changes.apply(oldDoc)
  let slotGrowth = 0
  let lastSlotLine = 0
  for (const slot of field.slots) {
    const from = changes.mapPos(slot.from, -1)
    const to = changes.mapPos(slot.to, 1)
    const fromLine = newDoc.lineAt(from)
    const toLine = newDoc.lineAt(to)
    const lines = toLine.number - fromLine.number + 1
    // Also two slots run together onto one line.
    if (
      fromLine.from !== from ||
      toLine.to !== to ||
      lines > slot.size ||
      fromLine.number <= lastSlotLine
    ) {
      return { kind: 'slot', size: slot.size, at: slot.from }
    }
    lastSlotLine = toLine.number
    slotGrowth += lines - (oldDoc.lineAt(slot.to).number - oldDoc.lineAt(slot.from).number + 1)
  }
  if (field.last != null) {
    const oldTail = oldDoc.sliceString(oldDoc.lineAt(field.last).to)
    const newTail = newDoc.sliceString(newDoc.lineAt(changes.mapPos(field.last, 1)).to)
    if (newTail.trim() !== '' || newlineCount(newTail) > newlineCount(oldTail)) {
      return { kind: 'last', at: field.last }
    }
  }
  if (field.first != null) {
    const oldHead = oldDoc.sliceString(0, field.first)
    const newHead = newDoc.sliceString(0, newDoc.lineAt(changes.mapPos(field.first, 1)).from)
    if (newHead.trim() !== '' || newlineCount(newHead) > newlineCount(oldHead)) {
      return { kind: 'first', at: field.first }
    }
  }
  if (field.noNewLines && newDoc.lines - oldDoc.lines > slotGrowth) {
    return { kind: 'noNewLines', at: state.selection.main.head }
  }
  return null
}

/**
 * An edit made wholly on a fenced side, moved to the open side of the fenced line (`violation`
 * 'last' / 'first'): what was typed or pasted goes on a new line just above a last line (below a
 * first line), with the line's indentation, and the cursor ends after it. Null when the edit
 * isn't wholly on that side or deletes anything.
 */
function moveFencedEdit(state, changes, violation) {
  const line = state.doc.lineAt(violation.at)
  let inserted = ''
  let wholly = true
  changes.iterChanges((fromA, toA, _fromB, _toB, text) => {
    if (fromA !== toA) wholly = false
    if (violation.kind === 'last' ? fromA < line.to : toA > line.from) wholly = false
    inserted += text.toString()
  })
  if (!wholly) return null
  const text = inserted.replace(/^\n+/, '').replace(/\n+$/, '')
  const body = text.trim() === '' ? '' : text
  const indent = /^\s*/.exec(line.text)[0]
  if (violation.kind === 'last') {
    const insert = `${indent}${body}\n`
    return {
      changes: { from: line.from, insert },
      selection: EditorSelection.cursor(line.from + insert.length - 1),
    }
  }
  const insert = `\n${indent}${body}`
  return {
    changes: { from: line.to, insert },
    selection: EditorSelection.cursor(line.to + insert.length),
  }
}

function hasZones(field) {
  return (
    !!field &&
    (field.first != null || field.last != null || field.slots.length > 0 || field.noNewLines)
  )
}

// The guard for the edit zones: drops a student's edit that breaks them, or moves one made on a
// fenced side to the open side. Runs after lockedEditFilter, on what that left.
const zoneEditFilter = EditorState.transactionFilter.of((tr) => {
  if (!tr.docChanged || !isGuardedEdit(tr)) return tr
  const state = tr.startState
  const field = state.field(lockedLinesField, false)
  if (!hasZones(field)) return tr
  const violation = zoneViolation(state, tr.changes)
  if (!violation) return tr
  const event = tr.annotation(Transaction.userEvent)
  const { kind, size } = violation
  const pos = state.selection.main.head
  const effects = state.readOnly ? [] : [showLockedNote.of({ pos, kind, size })]
  const annotations = event ? [Transaction.userEvent.of(event)] : []
  if (kind === 'slot') {
    // A deletion across slots clears the text inside them instead (a replacement is dropped).
    const specs = []
    let inserts = false
    tr.changes.iterChanges((fromA, toA, _fromB, _toB, text) => {
      if (text.length > 0) inserts = true
      for (const slot of field.slots) {
        const from = Math.max(fromA, slot.from)
        const to = Math.min(toA, slot.to)
        if (from < to) specs.push({ from, to })
      }
    })
    const changes = !inserts && specs.length > 0 && state.changes(specs)
    if (changes && !zoneViolation(state, changes)) return { changes, effects, annotations }
  }
  if (kind === 'last' || kind === 'first') {
    const moved = moveFencedEdit(state, tr.changes, violation)
    const changes = moved && state.changes(moved.changes)
    // The moved edit must itself be allowed (e.g. not a new line under puzzle.noNewLines).
    if (changes && !zoneViolation(state, changes)) {
      return {
        changes,
        selection: moved.selection,
        scrollIntoView: true,
        effects,
        annotations,
      }
    }
  }
  return { effects }
})

// A value selected whole (an empty one as a caret in its quote marks).
const whole = (span) => EditorSelection.range(span.from, span.to)

// The nearest place that can change past line `n` going `dir` (1 / -1): a free line (caret at
// `column`) or a values line's first / last value, whole; null when none.
function hop(state, n, dir, column) {
  for (let k = n + dir; k >= 1 && k <= state.doc.lines; k += dir) {
    const line = state.doc.line(k)
    if (!lockedLineAt(state, line.from)) {
      return EditorSelection.cursor(line.from + Math.min(column, line.length))
    }
    const spans = lockedValueSpansAt(state, line.from)
    if (spans?.length) return whole(dir > 0 ? spans[0] : spans[spans.length - 1])
  }
  return null
}

// On a values line a click selects a value whole (a second one goes inside) and moves go value
// to value, then off the line. A click on a fully locked line hops to the nearest line that can
// change; the arrows skip it, or go along it to its end or start, where Enter adds a line.
const lockedSelectionFilter = EditorState.transactionFilter.of((tr) => {
  if (tr.docChanged || !tr.selection || !tr.isUserEvent('select')) return tr
  const state = tr.startState
  const { head, empty } = tr.selection.main
  const line = empty && lockedLineAt(state, head)
  if (!line) return tr
  const pointer = tr.isUserEvent('select.pointer')
  const spans = lockedValueSpansAt(state, head) ?? []
  const before = state.selection.main
  const beforeLine = state.doc.lineAt(before.head).number
  const down = line.number > beforeLine || (line.number === beforeLine && head > before.head)
  const column = head - line.from
  let target = null
  if (spans.length > 0) {
    const inside = spans.find((span) => head >= span.from && head <= span.to)
    const near = (a, b) => (Math.abs(a.from - head) <= Math.abs(b.from - head) ? a : b)
    if (pointer) {
      const span = inside ?? spans.reduce(near)
      if (span === inside && before.from === span.from && before.to === span.to) return tr
      target = whole(span)
    } else if (beforeLine !== line.number) target = whole(spans.reduce(near))
    else if (inside) return tr
    else {
      const next = down ? spans.find((s) => s.from >= head) : spans.findLast((s) => s.to <= head)
      target = next
        ? whole(next)
        : (hop(state, line.number, down ? 1 : -1, 0) ?? whole(spans.reduce(near)))
    }
  } else if (pointer) {
    if (state.readOnly) return tr
    const below = hop(state, line.number, 1, column)
    const above = hop(state, line.number, -1, column)
    const lines = (sel) => (sel ? Math.abs(state.doc.lineAt(sel.head).number - line.number) : 1e9)
    target = lines(below) <= lines(above) ? below : above
    return {
      selection: target ?? tr.selection,
      effects: showLockedNote.of(target?.head ?? head),
      annotations: [Transaction.userEvent.of('select.pointer')],
    }
  } else if (beforeLine !== line.number) {
    target = hop(state, line.number, down ? 1 : -1, column)
    target ??= EditorSelection.cursor(down ? line.to : line.from)
  } else if (head > line.from && head < line.to) {
    target = EditorSelection.cursor(down ? line.to : line.from)
  }
  if (!target || (target.empty && target.head === head)) return tr
  return {
    selection: target,
    scrollIntoView: tr.scrollIntoView,
    annotations: [Transaction.userEvent.of(pointer ? 'select.pointer' : 'select')],
  }
})

// Tab / Shift-Tab on a values line: the next / previous value, whole, then on off the line.
const tabField = (dir) => (view) => {
  const { state } = view
  const sel = state.selection.main
  const spans = lockedValueSpansAt(state, sel.head)
  if (!spans?.length) return false
  const at = spans.findIndex((span) => sel.from >= span.from && sel.to <= span.to)
  const next = at < 0 ? spans[dir > 0 ? 0 : spans.length - 1] : spans[at + dir]
  const target = next ? whole(next) : hop(state, state.doc.lineAt(sel.head).number, dir, 0)
  // Nowhere to go: the browser's Tab leaves the editor (no keyboard trap).
  if (!target) return false
  view.dispatch({ selection: target, scrollIntoView: true, userEvent: 'select' })
  return true
}

// Enter in a full slot, or on the locked line just above a slot: on to the (next) slot, or past
// the last one to the next line that can change; never a new, unmarked line.
function enterInSlots(view) {
  const { state } = view
  const { head, empty } = state.selection.main
  const slots = state.field(lockedLinesField, false)?.slots ?? []
  if (state.readOnly || !empty || slots.length === 0) return enterOnLockedLine(view)
  const lineNo = (pos) => state.doc.lineAt(pos).number
  const here = lineNo(head)
  const slot = slots.find((s) => head >= s.from && head <= s.to)
  let from = null
  if (slot) {
    if (lineNo(slot.to) - lineNo(slot.from) + 1 < slot.size) return false
    from = slot.to
  } else if (lockedLineAt(state, head) && slots.some((s) => lineNo(s.from) === here + 1)) {
    from = state.doc.lineAt(head).to
  } else return enterOnLockedLine(view)
  const next = slots.find((s) => s.from > from)
  const target = next
    ? EditorSelection.cursor(state.doc.lineAt(next.from).to)
    : hop(state, lineNo(from), 1, 0)
  if (!target && !slot) return enterOnLockedLine(view)
  // Past the last slot with nowhere to go: say why nothing happened.
  const effects = target ? [] : showLockedNote.of({ pos: head, kind: 'slot', size: slot.size })
  view.dispatch({
    selection: target ?? undefined,
    scrollIntoView: true,
    effects,
    userEvent: 'select',
  })
  return true
}

// Enter on a locked line: a new line above it (cursor at or before its first character) or
// below it (anywhere else). A fenced line adds on its open side only: above a last line, below a
// first one.
function enterOnLockedLine(view) {
  const { state } = view
  if (state.readOnly) return false
  const sel = state.selection.main
  if (!sel.empty) return false
  const line = lockedLineAt(state, sel.head)
  if (!line) return false
  const indent = /^\s*/.exec(line.text)[0]
  const field = state.field(lockedLinesField)
  const above =
    field.last === line.from ||
    (field.first !== line.from && sel.head <= line.from + indent.length && sel.head < line.to)
  if (above) {
    view.dispatch({
      changes: { from: line.from, insert: `${indent}\n` },
      selection: { anchor: line.from + indent.length },
      scrollIntoView: true,
      userEvent: 'input',
    })
    return true
  }
  if (sel.head !== line.to) view.dispatch({ selection: { anchor: line.to } })
  return insertNewlineAndIndent(view)
}

// ─── Showing the locks ───────────────────────────────────────────────────────

// The icon at the end of a locked line (🔒, read out as "Locked"), of a fenced one with its short
// words in view ("🔒 nothing below"), of a values-locked one (🔒, read out as "Change the values
// only") or of a slot's first line (✎, read out as "This space takes one line"; while the slot
// is empty "✎ your line goes here"; not colour alone).
class LockedTagWidget extends WidgetType {
  constructor(label = 'Locked', title = LOCKED_LINE_NOTE, words = '', className = '', icon = '🔒') {
    super()
    Object.assign(this, { label, title, words, className, icon })
  }
  eq(other) {
    return ['label', 'title', 'words', 'className', 'icon'].every((k) => other[k] === this[k])
  }
  toDOM() {
    const tag = document.createElement('span')
    tag.className = `cm-lockedTag ${this.className}`.trim()
    tag.title = this.title
    tag.setAttribute('role', 'img')
    tag.setAttribute('aria-label', this.label)
    tag.textContent = this.words ? `${this.icon} ${this.words}` : this.icon
    return tag
  }
}

const FENCE_TAGS = {
  last: new LockedTagWidget('Locked · nothing below', FENCE_LAST_NOTE, 'nothing below'),
  first: new LockedTagWidget('Locked · nothing above', FENCE_FIRST_NOTE, 'nothing above'),
}
const VALUES_TAG = new LockedTagWidget(LOCKED_VALUES_TAG, LOCKED_VALUES_NOTE)
const SLOT_EMPTY = 'your line goes here'
const slotMark = (size, empty) =>
  new LockedTagWidget(slotNote(size), slotNote(size), empty ? SLOT_EMPTY : '', 'cm-slotMark', '✎')

const lineDeco = (cls, title) => Decoration.line({ class: cls, attributes: { title } })
const lockedLineDeco = lineDeco('cm-lockedLine', LOCKED_LINE_NOTE)
const lockedValuesLineDeco = lineDeco('cm-lockedLine cm-lockedValuesLine', LOCKED_VALUES_NOTE)
const slotLineDeco = (size) => lineDeco('cm-slotLine', slotNote(size))

const editableValueMark = Decoration.mark({ class: EDITABLE_VALUE_CLASS })

// An empty editable string's box (`name = ""`), so there is somewhere to tap and type.
class EmptyValueWidget extends WidgetType {
  eq() {
    return true
  }
  toDOM() {
    const box = document.createElement('span')
    box.className = EDITABLE_VALUE_EMPTY_CLASS
    box.setAttribute('aria-hidden', 'true')
    return box
  }
  ignoreEvent() {
    return false
  }
}

const lockedDecorations = EditorView.decorations.compute([lockedLinesField], (state) => {
  const field = state.field(lockedLinesField)
  const ranges = []
  for (const pos of field.positions) {
    const line = state.doc.lineAt(pos)
    if (field.values.includes(pos)) {
      ranges.push(lockedValuesLineDeco.range(line.from))
      for (const span of lineValueSpans(line.text)) {
        const from = line.from + span.from
        const to = line.from + span.to
        ranges.push(
          from === to
            ? Decoration.widget({ widget: new EmptyValueWidget(), side: 1 }).range(from)
            : editableValueMark.range(from, to)
        )
      }
      ranges.push(Decoration.widget({ widget: VALUES_TAG, side: 1 }).range(line.to))
      continue
    }
    ranges.push(lockedLineDeco.range(line.from))
    const fence = pos === field.last ? 'last' : pos === field.first ? 'first' : null
    const widget = fence ? FENCE_TAGS[fence] : new LockedTagWidget()
    ranges.push(Decoration.widget({ widget, side: 1 }).range(line.to))
  }
  for (const slot of field.slots) {
    const first = state.doc.lineAt(slot.from)
    const last = state.doc.lineAt(slot.to)
    for (let n = first.number; n <= last.number; n += 1) {
      ranges.push(slotLineDeco(slot.size).range(state.doc.line(n).from))
    }
    const empty = slot.from === slot.to || state.doc.sliceString(slot.from, slot.to).trim() === ''
    ranges.push(Decoration.widget({ widget: slotMark(slot.size, empty), side: 1 }).range(first.to))
  }
  return Decoration.set(ranges, true)
})

// The on-screen keyboard stays shut while the cursor is inside a locked line, or anywhere on a
// values line but in one of its values.
const lockedInputMode = EditorView.contentAttributes.compute(
  [lockedLinesField, 'selection'],
  (state) => {
    const head = state.selection.main.head
    const line = lockedLineAt(state, head)
    if (!line) return {}
    const spans = lockedValueSpansAt(state, head)
    const inValue = spans?.some((span) => head >= span.from && head <= span.to)
    const shut = spans ? !inValue : head > line.from && head < line.to
    return shut ? { inputmode: 'none' } : {}
  }
)

// The words of a note (showLockedNote's value: a position, `{ pos, values }`, or an edit zone's
// `{ pos, kind, size }`).
function noteWords(raw) {
  if (raw.kind === 'last') return FENCE_LAST_NOTE
  if (raw.kind === 'first') return FENCE_FIRST_NOTE
  if (raw.kind === 'slot') return slotNote(raw.size ?? 1)
  if (raw.kind === 'noNewLines') return NO_NEW_LINES_NOTE
  return raw.values ? LOCKED_VALUES_NOTE : LOCKED_LINE_NOTE
}

// The note: `{ pos, words, id }` while it shows.
const lockedNoteField = StateField.define({
  create() {
    return null
  },
  update(value, tr) {
    let next = value && tr.docChanged ? { ...value, pos: tr.changes.mapPos(value.pos) } : value
    for (const effect of tr.effects) {
      if (!effect.is(showLockedNote)) continue
      const raw = typeof effect.value === 'number' ? { pos: effect.value } : effect.value
      next =
        raw == null
          ? null
          : {
              pos: Math.min(Math.max(raw.pos, 0), tr.state.doc.length),
              words: noteWords(raw),
              // A slot isn't locked: its note gets the pencil of its tag.
              icon: raw.kind === 'slot' ? '✏️' : '🔒',
              id: (value?.id ?? 0) + 1,
            }
    }
    return next
  },
  provide: (field) =>
    showTooltip.compute([field], (state) => {
      const note = state.field(field)
      if (!note) return null
      return {
        pos: note.pos,
        above: true,
        create: () => {
          const dom = document.createElement('div')
          dom.className = 'cm-lockedNote'
          // Announced through the live region below, not here.
          dom.setAttribute('aria-hidden', 'true')
          dom.textContent = `${note.icon} ${note.words}`
          return { dom }
        },
      }
    }),
})

// Announces the note to screen readers; hideNoteSoon hides it.
const lockedNotePlugin = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.view = view
      this.region = document.createElement('div')
      this.region.className = 'cm-lockedLiveRegion'
      this.region.setAttribute('role', 'status')
      this.region.setAttribute('aria-live', 'polite')
      view.dom.appendChild(this.region)
    }
    update(update) {
      const before = update.startState.field(lockedNoteField, false)
      const note = update.state.field(lockedNoteField, false)
      if (!note || note.id === before?.id) return
      this.region.textContent = ''
      // A fresh text node, so the same words are announced again.
      const words = note.words
      setTimeout(() => {
        this.region.textContent = words
      }, 30)
    }
    destroy() {
      this.gone = true
      this.region.remove()
    }
  },
  { eventHandlers: { keydown: hideNoteSoon, pointerdown: hideNoteSoon } }
)

// On the next key or click (as the plugin): hides the note, unless that brought a new one.
function hideNoteSoon() {
  const id = this.view.state.field(lockedNoteField, false)?.id
  if (id == null) return
  setTimeout(() => {
    if (!this.gone && this.view.state.field(lockedNoteField, false)?.id === id)
      this.view.dispatch({ effects: showLockedNote.of(null) })
  })
}

const lockedTheme = EditorView.baseTheme({
  '.cm-lockedLine': { backgroundColor: 'rgba(148, 163, 184, 0.16)', color: '#64748b' },
  '.cm-lockedLine span': { color: 'inherit !important' },
  // A values-locked line's values read as normal code: they are the part that can change.
  [`.cm-lockedLine .${EDITABLE_VALUE_CLASS}, .cm-lockedLine .${EDITABLE_VALUE_CLASS} span`]: {
    color: '#1f2937 !important',
  },
  '.cm-lockedTag': {
    marginLeft: '1.2em',
    fontSize: '0.78em',
    opacity: 0.7,
    userSelect: 'none',
    WebkitUserSelect: 'none',
    pointerEvents: 'none',
  },
  // A slot: one dashed row with a soft wash (its hint chip says what goes there).
  '.cm-slotLine': {
    borderRadius: '4px',
    backgroundColor: 'rgba(250, 204, 21, 0.14)',
    outline: '1px dashed #d4a514',
    outlineOffset: '-1px',
  },
  '.cm-slotMark': { fontStyle: 'italic', color: '#7a5b00 !important', marginLeft: '0.6em' },
  '.cm-tooltip.cm-lockedNote': {
    padding: '4px 10px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    background: '#1e293b',
    color: '#fff',
    fontFamily: 'var(--font-body, sans-serif)',
    fontSize: '0.85rem',
    fontWeight: 600,
  },
  '.cm-lockedLiveRegion': {
    position: 'absolute',
    width: '1px',
    height: '1px',
    overflow: 'hidden',
    clip: 'rect(0 0 0 0)',
    whiteSpace: 'nowrap',
  },
})

/** The locked-lines extension: add it to an editor, then dispatch setLockedLineSets. */
export function lockedLinesExtension() {
  return [
    lockedLinesField,
    lockedEditFilter,
    zoneEditFilter,
    lockedSelectionFilter,
    Prec.highest(
      keymap.of([
        { key: 'Enter', run: enterInSlots },
        { key: 'Tab', run: tabField(1), shift: tabField(-1) },
      ])
    ),
    lockedDecorations,
    lockedInputMode,
    lockedNoteField,
    lockedNotePlugin,
    lockedTheme,
    editableValueTheme,
  ]
}
