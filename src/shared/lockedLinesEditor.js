// Locked lines in the CodeMirror editor (see ./lockedLines.js for the authoring side and the
// anchoring). A locked line is greyed with a "🔒 Locked" tag and can't be typed in, deleted,
// cut, pasted over, re-indented or merged with its neighbours. New lines can still be added
// before, between and after locked lines:
//   - Enter on a locked line adds a new line: above it when the cursor is at (or before) the
//     line's first character, else below it.
//   - Backspace at the start of the line after a locked line, or Delete at the end of a locked
//     line, only works when it removes an empty line (it would otherwise merge a line into it).
//   - A deletion that spans locked lines (select-all + delete, cut, paste over) keeps them: the
//     text around them goes, the locked lines and the line breaks before them stay.
//   - The arrow keys skip locked lines; a typing attempt on one does nothing and shows "This
//     line is locked" (also on a tap or click), announced to screen readers.
//   - On a touch screen the on-screen keyboard is told not to open (inputmode="none") while the
//     cursor is inside a locked line.
//
// Only the student's own edits are guarded (transactions with a user event, other than undo and
// redo). A value replaced from outside (task switch, Reset, a support stage, a teacher edit)
// goes through, and the locks are re-anchored by text on the new code — as are undo and redo.
//
// A VALUES lock (`#@lock-values`, P6-22) is a locked line whose values stay editable: the text
// between a plain string's quote marks (empty strings too) and its numbers (lineValueSpans in
// ./lockedLines.js), marked with the shared "you can change this" look (./editableValueStyle.js).
// An edit on such a line goes through only when it stays inside the line and leaves its value
// skeleton as it was (so the name, `=`, quote marks and brackets can't change); clicking or
// moving onto the line puts the caret in the nearest value.
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
import { chooseLocks, lineValueSpans, scanLineValues } from './lockedLines.js'
import {
  EDITABLE_VALUE_CLASS,
  EDITABLE_VALUE_EMPTY_CLASS,
  editableValueTheme,
} from './editableValueStyle.js'

export const LOCKED_LINE_NOTE = 'This line is locked'
export const LOCKED_VALUES_NOTE = 'Only the values on this line can change'
export const LOCKED_VALUES_TAG = 'Change the values only'
const NOTE_MS = 1800

export const setLockedLineSets = StateEffect.define()
// Shows the "This line is locked" note at a position (null hides it).
export const showLockedNote = StateEffect.define()

// `{ positions, values }`: the start of each locked line, and of each values-locked one.
function anchorPositions(doc, sets) {
  const locks = chooseLocks(doc.toString(), sets)
  return {
    positions: locks.map((lock) => doc.line(lock.line).from),
    values: locks.filter((lock) => lock.values).map((lock) => doc.line(lock.line).from),
  }
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
    return { sets: [], positions: [], values: [] }
  },
  update(value, tr) {
    let next = value
    if (tr.docChanged && value.sets.length > 0) {
      if (isGuardedEdit(tr)) {
        // A guarded edit never breaks a locked line (a values line only changes inside its
        // values), so each one moves with its line.
        next = {
          sets: value.sets,
          positions: mapLineStarts(value.positions, tr),
          values: mapLineStarts(value.values, tr),
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

// The value span `pos` is in or at the edge of, or null.
function spanAround(spans, pos) {
  return (spans ?? []).find((span) => pos >= span.from && pos <= span.to) ?? null
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
 * (only string contents and numbers changed).
 */
export function valuesChangeAllowed(doc, range, change) {
  const insert = change.insert ?? ''
  if (change.from < range.from || change.to > range.to || insert.includes('\n')) return false
  const text = doc.sliceString(range.from, range.to)
  const next = text.slice(0, change.from - range.from) + insert + text.slice(change.to - range.from)
  return scanLineValues(next).skeleton === scanLineValues(text).skeleton
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
  return {
    changes,
    selection: tr.startState.selection.map(changes, 1),
    effects: tr.startState.readOnly
      ? []
      : [showLockedNote.of({ pos: changes.mapPos(blockedAt, 1), values })],
    annotations: event ? [Transaction.userEvent.of(event)] : [],
  }
})

// The arrow keys skip locked lines; a tap or click on one shows the note.
const lockedSelectionFilter = EditorState.transactionFilter.of((tr) => {
  if (tr.docChanged || !tr.selection || !tr.isUserEvent('select')) return tr
  const state = tr.startState
  const main = tr.selection.main
  if (!main.empty) return tr
  const line = lockedLineAt(state, main.head)
  if (!line) return tr
  const spans = lockedValueSpansAt(state, main.head)
  if (spans) {
    const moved = valuesLineSelection(state, tr, line, spans)
    if (moved !== undefined) return moved
  }
  if (tr.isUserEvent('select.pointer')) {
    if (state.readOnly) return tr
    return {
      selection: tr.selection,
      effects: showLockedNote.of(line.from),
      annotations: [Transaction.userEvent.of('select.pointer')],
    }
  }
  const before = state.selection.main.head
  const beforeLine = state.doc.lineAt(before)
  let pos = null
  if (beforeLine.number !== line.number) {
    // A move onto the line from another: on to the next unlocked line that way, keeping the
    // column, or the locked line's end (going down) or start (going up) when there is none.
    const down = line.number > beforeLine.number
    const column = main.head - line.from
    for (
      let n = line.number + (down ? 1 : -1);
      n >= 1 && n <= state.doc.lines;
      n += down ? 1 : -1
    ) {
      const candidate = state.doc.line(n)
      if (lockedLineAt(state, candidate.from)) continue
      pos = candidate.from + Math.min(column, candidate.length)
      break
    }
    if (pos == null) pos = down ? line.to : line.from
  } else if (main.head > line.from && main.head < line.to) {
    // Along the line: to its end going right, its start going left.
    pos = main.head > before ? line.to : line.from
  }
  if (pos == null || pos === main.head) return tr
  return {
    selection: EditorSelection.cursor(pos),
    scrollIntoView: tr.scrollIntoView,
    annotations: [Transaction.userEvent.of('select')],
  }
})

// The caret on a values-locked line (#@lock-values): inside (or at the edge of) a value it stays;
// a click elsewhere on the line goes to the nearest value; a move along the line jumps to the
// next value that way, and a move onto the line from another lands in the value nearest the
// column. `undefined` falls back to the locked-line rules (no value that way, or none at all).
function valuesLineSelection(state, tr, line, spans) {
  const head = tr.selection.main.head
  if (spanAround(spans, head)) return tr
  if (spans.length === 0) return undefined
  const to = (pos, event) => ({
    selection: EditorSelection.cursor(pos),
    scrollIntoView: tr.scrollIntoView,
    annotations: [Transaction.userEvent.of(event)],
  })
  const nearestEdge = () => {
    let best = null
    for (const span of spans) {
      for (const edge of [span.from, span.to]) {
        if (best == null || Math.abs(edge - head) < Math.abs(best - head)) best = edge
      }
    }
    return best
  }
  if (tr.isUserEvent('select.pointer')) return to(nearestEdge(), 'select.pointer')
  const before = state.selection.main.head
  if (state.doc.lineAt(before).number !== line.number) return to(nearestEdge(), 'select')
  if (head > before) {
    const next = spans.find((span) => span.from >= head)
    return next ? to(next.from, 'select') : undefined
  }
  const prev = [...spans].reverse().find((span) => span.to <= head)
  return prev ? to(prev.to, 'select') : undefined
}

// Enter on a locked line: a new line above it (cursor at or before its first character) or
// below it (anywhere else).
function enterOnLockedLine(view) {
  const { state } = view
  if (state.readOnly) return false
  const sel = state.selection.main
  if (!sel.empty) return false
  const line = lockedLineAt(state, sel.head)
  if (!line) return false
  const indent = /^\s*/.exec(line.text)[0]
  if (sel.head <= line.from + indent.length && sel.head < line.to) {
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

class LockedTagWidget extends WidgetType {
  eq() {
    return true
  }
  toDOM() {
    const tag = document.createElement('span')
    tag.className = 'cm-lockedTag'
    tag.title = LOCKED_LINE_NOTE
    const icon = document.createElement('span')
    icon.setAttribute('aria-hidden', 'true')
    icon.textContent = '🔒 '
    tag.appendChild(icon)
    tag.appendChild(document.createTextNode('Locked'))
    return tag
  }
}

const lockedLineDeco = Decoration.line({
  class: 'cm-lockedLine',
  attributes: { title: LOCKED_LINE_NOTE },
})

const lockedValuesLineDeco = Decoration.line({
  class: 'cm-lockedLine cm-lockedValuesLine',
  attributes: { title: LOCKED_VALUES_NOTE },
})

const editableValueMark = Decoration.mark({ class: EDITABLE_VALUE_CLASS })

class ValuesTagWidget extends WidgetType {
  eq() {
    return true
  }
  toDOM() {
    const tag = document.createElement('span')
    tag.className = 'cm-lockedTag'
    tag.title = LOCKED_VALUES_NOTE
    const icon = document.createElement('span')
    icon.setAttribute('aria-hidden', 'true')
    icon.textContent = '🔒 '
    tag.appendChild(icon)
    tag.appendChild(document.createTextNode(LOCKED_VALUES_TAG))
    return tag
  }
}

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
      ranges.push(Decoration.widget({ widget: new ValuesTagWidget(), side: 1 }).range(line.to))
      continue
    }
    ranges.push(lockedLineDeco.range(line.from))
    ranges.push(Decoration.widget({ widget: new LockedTagWidget(), side: 1 }).range(line.to))
  }
  return Decoration.set(ranges, true)
})

// The on-screen keyboard stays shut while the cursor is inside a locked line.
const lockedInputMode = EditorView.contentAttributes.compute(
  [lockedLinesField, 'selection'],
  (state) => {
    const head = state.selection.main.head
    const line = lockedLineAt(state, head)
    if (!line || head <= line.from || head >= line.to) return {}
    // A values-locked line's values take typing.
    if (spanAround(lockedValueSpansAt(state, head), head)) return {}
    return { inputmode: 'none' }
  }
)

// The note: `{ pos, id }` while it shows.
const lockedNoteField = StateField.define({
  create() {
    return null
  },
  update(value, tr) {
    let next = value && tr.docChanged ? { ...value, pos: tr.changes.mapPos(value.pos) } : value
    for (const effect of tr.effects) {
      if (!effect.is(showLockedNote)) continue
      // A position, or `{ pos, values }` (a values-locked line: say only its values change).
      const raw = typeof effect.value === 'number' ? { pos: effect.value } : effect.value
      next =
        raw == null
          ? null
          : {
              pos: Math.min(Math.max(raw.pos, 0), tr.state.doc.length),
              values: !!raw.values,
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
          dom.textContent = `🔒 ${note.values ? LOCKED_VALUES_NOTE : LOCKED_LINE_NOTE}`
          return { dom }
        },
      }
    }),
})

// Hides the note after a moment, and announces it to screen readers.
const lockedNotePlugin = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.view = view
      this.timer = null
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
      const words = note.values ? LOCKED_VALUES_NOTE : LOCKED_LINE_NOTE
      setTimeout(() => {
        this.region.textContent = words
      }, 30)
      clearTimeout(this.timer)
      const id = note.id
      this.timer = setTimeout(() => {
        if (this.view.state.field(lockedNoteField, false)?.id === id) {
          this.view.dispatch({ effects: showLockedNote.of(null) })
        }
      }, NOTE_MS)
    }
    destroy() {
      clearTimeout(this.timer)
      this.region.remove()
    }
  }
)

const lockedTheme = EditorView.baseTheme({
  '.cm-lockedLine': {
    backgroundColor: 'rgba(148, 163, 184, 0.16)',
    color: '#64748b',
  },
  '.cm-lockedLine span': { color: 'inherit !important' },
  // A values-locked line's values read as normal code: they are the part that can change.
  [`.cm-lockedLine .${EDITABLE_VALUE_CLASS}, .cm-lockedLine .${EDITABLE_VALUE_CLASS} span`]: {
    color: '#1f2937 !important',
  },
  '.cm-lockedTag': {
    marginLeft: '1.2em',
    padding: '0 6px',
    borderRadius: '999px',
    border: '1px solid #cbd5e1',
    background: '#f1f5f9',
    color: '#475569 !important',
    fontFamily: 'var(--font-body, sans-serif)',
    fontSize: '0.78em',
    fontStyle: 'normal',
    fontWeight: 600,
    userSelect: 'none',
    WebkitUserSelect: 'none',
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
  },
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
    lockedSelectionFilter,
    Prec.highest(keymap.of([{ key: 'Enter', run: enterOnLockedLine }])),
    lockedDecorations,
    lockedInputMode,
    lockedNoteField,
    lockedNotePlugin,
    lockedTheme,
    editableValueTheme,
  ]
}
