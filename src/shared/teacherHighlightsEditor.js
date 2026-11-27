// Tutor highlights and pins in CodeMirror, in the student's editor and the tutor's mirror alike:
// box / band / pin caret plus a note row with one Got it button. Behaviour and rules:
// docs/agents/classroom-behaviours.md, "Teacher Code Highlights".
import { ChangeSet, StateEffect, StateField } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, WidgetType } from '@codemirror/view'
import { decodeFileKey } from './fileKeys'

export const PIN_NOTE_MAX = 80
export const PIN_PRESETS = [
  'Write this here',
  'Look at this line',
  'Check your spelling',
  'Something is missing',
]

// The CodeMirror user-event types that are the student's own editing (see CodeEditor.jsx).
export const USER_EDIT_EVENTS = ['input', 'delete', 'move', 'undo', 'redo']

export const setTeacherHighlights = StateEffect.define()

const isPin = (h) => h.kind === 'pin'

/** The session's `teacherHighlights` map as editor items, for one file (or every file: null). */
export function teacherHighlightsFor(raw, file = null) {
  return Object.entries(raw ?? {})
    .filter(([, h]) => file === null || decodeFileKey(h.file) === file)
    .map(([id, h]) => ({ id, kind: h.kind, from: h.from, to: h.to, emoji: h.emoji, note: h.note }))
}

/**
 * The smallest single change turning `current` into `next`: the shared prefix and suffix are
 * left alone, so decorations on untouched text (teacher highlights, the remote selection) map
 * through an outside update instead of being wiped by a whole-document replace.
 */
export function minimalReplace(current, next) {
  const max = Math.min(current.length, next.length)
  let start = 0
  while (start < max && current.charCodeAt(start) === next.charCodeAt(start)) start++
  let end = 0
  while (
    end < max - start &&
    current.charCodeAt(current.length - 1 - end) === next.charCodeAt(next.length - 1 - end)
  ) {
    end++
  }
  return { from: start, to: current.length - end, insert: next.slice(start, next.length - end) }
}

/**
 * A pending spot or range made on `prevText`, moved through the change to `nextText` the way the
 * editor moves it (so what Drop pin sends matches the marker); null once a range's code is gone.
 */
export function mapThroughText(item, prevText, nextText) {
  if (prevText === nextText) return item
  const moved = mapItem(item, ChangeSet.of([minimalReplace(prevText, nextText)], prevText.length))
  return isPin(moved) || moved.from < moved.to ? moved : null
}

// A pin's caret; `pending` is the tutor's clicked spot before Drop pin (mirror only, no note).
class PinWidget extends WidgetType {
  constructor(pending) {
    super()
    this.pending = !!pending
  }
  eq(other) {
    return other.pending === this.pending
  }
  toDOM() {
    const caret = document.createElement('span')
    caret.className = this.pending ? 'cm-teacherPin cm-teacherPinPending' : 'cm-teacherPin'
    caret.setAttribute('aria-hidden', 'true')
    return caret
  }
}

/** Left margin (px) putting the pill under the arrow, inside the visible editor width. */
export function noteMarginLeft(arrowX, pillWidth, visibleWidth) {
  return Math.max(0, Math.min(arrowX - 24, visibleWidth - pillWidth - 8))
}

class NoteRowWidget extends WidgetType {
  constructor(item) {
    super()
    this.item = item
  }
  eq(other) {
    const [a, b] = [this.item, other.item]
    return ['id', 'emoji', 'note', 'from', 'to'].every((key) => a[key] === b[key])
  }
  toDOM(view) {
    const { id, emoji, note, from, to } = this.item
    const row = document.createElement('div')
    row.className = 'cm-teacherNote'
    row.setAttribute('role', 'note')
    Object.assign(row.dataset, { from, to })
    const pill = document.createElement('span')
    pill.className = 'cm-teacherNotePill'
    const mark = document.createElement('span')
    mark.textContent = emoji || (isPin(this.item) ? '📌' : '★')
    mark.setAttribute('aria-hidden', 'true')
    const text = document.createElement('span')
    text.className = 'cm-teacherNoteText'
    text.textContent = note || ''
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'cm-teacherNoteGotIt'
    button.dataset.highlightId = id
    button.textContent = view.state.readOnly ? 'Remove' : 'Got it ✓'
    pill.append(mark, text, button)
    row.append(pill)
    // A press on the words or the row's empty space keeps the caret and focus in the code, so
    // typing goes on working (the button's own press is CodeEditor's).
    row.addEventListener('mousedown', (event) => {
      if (event.target.closest('.cm-teacherNoteGotIt')) return
      event.preventDefault()
      view.focus()
    })
    return row
  }
  // Only a mouse press or click on the button reaches the editor's handlers (CodeEditor's
  // mousedown, and click with detail 0 for Enter/Space). Its keys stay the button's own; a click
  // on the words does nothing.
  ignoreEvent(event) {
    const onButton = !!event.target?.closest?.('.cm-teacherNoteGotIt')
    return !(onButton && (event.type === 'mousedown' || event.type === 'click'))
  }
}

// Points each note's arrow at its words (the middle of a one-row highlight, else its start) and
// keeps the pill inside the visible editor. Re-measured whenever the code, the notes, the
// editor's size or the scrolled viewport change.
function measureNotes(view) {
  view.requestMeasure({
    key: measureNotes,
    read: () => {
      const scroller = view.scrollDOM.getBoundingClientRect()
      return [...view.contentDOM.querySelectorAll('.cm-teacherNote')].map((row) => {
        const box = row.getBoundingClientRect()
        const max = view.state.doc.length
        const start = view.coordsAtPos(Math.min(+row.dataset.from, max), 1)
        const end = view.coordsAtPos(Math.min(+row.dataset.to, max), -1)
        if (!start || !box.width) return { row, x: null }
        const sameRow = end && Math.abs(end.top - start.top) < 2
        const pin = row.dataset.from === row.dataset.to
        const x =
          (pin ? start.left : sameRow ? (start.left + end.right) / 2 : start.left + 6) - box.left
        const visible = scroller.left + view.scrollDOM.clientWidth - box.left
        const pillWidth = row.firstChild.offsetWidth
        const margin = noteMarginLeft(x, pillWidth, visible)
        // The arrow stays on the pill's top edge, clear of its rounded corners.
        return { row, margin, x: Math.max(margin + 12, Math.min(x, margin + pillWidth - 12)) }
      })
    },
    write: (notes) => {
      for (const { row, x, margin } of notes) {
        if (x == null) continue
        row.style.setProperty('--note-arrow', `${x}px`)
        row.firstChild.style.marginLeft = `${margin}px`
      }
    },
  })
}

const noteMeasurer = ViewPlugin.define((view) => {
  measureNotes(view)
  return {
    update(update) {
      const notesChanged =
        update.startState.field(teacherHighlightsField, false) !==
        update.state.field(teacherHighlightsField, false)
      if (notesChanged || update.geometryChanged || update.viewportChanged) measureNotes(view)
    },
  }
})

function buildDecorations(doc, items) {
  const ranges = []
  for (const h of items) {
    // A selection ending at the very start of a line (a whole line with its newline) belongs
    // to the line before.
    const endsAtLineStart = h.to > h.from && doc.lineAt(h.to).from === h.to
    const first = doc.lineAt(h.from)
    const last = doc.lineAt(endsAtLineStart ? h.to - 1 : h.to)
    if (isPin(h)) {
      ranges.push(Decoration.widget({ widget: new PinWidget(h.pending), side: 1 }).range(h.from))
      if (h.pending) continue
    } else if (first.number === last.number) {
      ranges.push(Decoration.mark({ class: 'cm-teacherHighlight' }).range(h.from, h.to))
    } else {
      for (let n = first.number; n <= last.number; n++) {
        ranges.push(Decoration.line({ class: 'cm-teacherHighlightBand' }).range(doc.line(n).from))
      }
    }
    ranges.push(
      Decoration.widget({ widget: new NoteRowWidget(h), block: true, side: 1 }).range(last.to)
    )
  }
  return Decoration.set(ranges, true)
}

const blue = 'rgba(37, 99, 235, 0.6)'
const teacherHighlightsTheme = EditorView.baseTheme({
  '.cm-teacherHighlight': {
    backgroundColor: 'rgba(37, 99, 235, 0.16)',
    outline: `1px solid ${blue}`,
    borderRadius: '3px',
  },
  '.cm-teacherHighlightBand': {
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    boxShadow: `inset 3px 0 0 ${blue}`,
  },
  '.cm-teacherPin': {
    display: 'inline-block',
    width: 0,
    height: '1.2em',
    borderLeft: '2px solid #2563eb',
    verticalAlign: 'text-bottom',
  },
  '.cm-teacherPinPending': { borderLeft: '3px solid #6222CC', boxShadow: '0 0 0 2px #ede9fe' },
  '.cm-teacherNote': {
    position: 'relative',
    padding: '7px 0 3px',
    fontFamily: 'var(--font-body)',
    fontSize: '0.82em',
    lineHeight: 1.4,
    cursor: 'default',
    '&::before': {
      content: '""',
      position: 'absolute',
      top: '2px',
      left: 'var(--note-arrow, 18px)',
      width: '8px',
      height: '8px',
      background: '#dbeafe',
      borderLeft: `1px solid ${blue}`,
      borderTop: `1px solid ${blue}`,
      transform: 'translateX(-4px) rotate(45deg)',
    },
  },
  '.cm-teacherNotePill': {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    maxWidth: 'calc(100% - 8px)',
    padding: '2px 3px 2px 8px',
    border: `1px solid ${blue}`,
    borderRadius: '8px',
    background: '#dbeafe',
    color: '#1e3a8a',
    fontWeight: 700,
    whiteSpace: 'normal',
  },
  '.cm-teacherNoteText:empty': { display: 'none' },
  '.cm-teacherNoteGotIt': {
    flexShrink: 0,
    border: 'none',
    borderRadius: '6px',
    background: '#6222CC',
    color: '#fff',
    font: 'inherit',
    padding: '2px 10px',
    cursor: 'pointer',
  },
  '@media (pointer: coarse)': {
    '.cm-teacherNoteGotIt': { minHeight: '44px', minWidth: '88px' },
  },
})

// Moves a highlight (from forward, to back) or a pin (typed text goes before it) through a change.
function mapItem(h, changes) {
  const from = changes.mapPos(h.from, 1)
  return { ...h, from, to: isPin(h) ? from : changes.mapPos(h.to, -1) }
}

export const teacherHighlightsField = StateField.define({
  create() {
    return { decorations: Decoration.none, highlights: [], hidden: new Map() }
  },
  update(value, transaction) {
    let { highlights, hidden } = value
    let changed = false
    const { doc } = transaction.state
    if (transaction.docChanged && (highlights.length > 0 || hidden.size > 0)) {
      // The user's own edit inside a highlighted range clears that highlight for good. A pin,
      // every other highlight, and everything under an outside change (task switch, a live
      // mirror update) is mapped so it stays on its code.
      const touched = new Set()
      if (USER_EDIT_EVENTS.some((type) => transaction.isUserEvent(type))) {
        transaction.changes.iterChangedRanges((fromA, toA) => {
          for (const h of highlights) {
            if (!isPin(h) && fromA < h.to && toA > h.from) touched.add(h.id)
          }
        })
      }
      highlights = highlights
        .filter((h) => !touched.has(h.id))
        .map((h) => mapItem(h, transaction.changes))
        .filter((h) => isPin(h) || h.from < h.to)
      hidden = new Map([...hidden].map(([id, h]) => [id, mapItem(h, transaction.changes)]))
      changed = true
    }
    for (const effect of transaction.effects) {
      if (!effect.is(setTeacherHighlights)) continue
      // The incoming list says which exist. One already shown keeps its mapped position (the
      // stored one predates the latest edits). One hidden for a while (the caller passed [] during
      // a tutor edit, a broadcast or a previous task's view) comes back where it had moved to:
      // its spot when hidden if the code is the same again, else that spot mapped through the
      // changes since. Only a new one is placed at its stored position.
      const max = doc.length
      const current = new Map(highlights.map((h) => [h.id, h]))
      const incoming = new Set((effect.value ?? []).map((h) => h.id))
      hidden = new Map(hidden)
      for (const h of highlights) {
        if (!incoming.has(h.id)) hidden.set(h.id, { ...h, at: h, doc })
      }
      highlights = []
      for (const h of effect.value ?? []) {
        const existing = current.get(h.id)
        if (existing) {
          highlights.push({ ...existing, emoji: h.emoji, note: h.note })
          continue
        }
        const back = hidden.get(h.id)
        hidden.delete(h.id)
        const placed = back ? (back.doc.eq(doc) ? back.at : back) : h
        const from = Math.min(Math.max(placed.from ?? 0, 0), max)
        const to = isPin(h) ? from : Math.min(Math.max(placed.to ?? from, 0), max)
        if (!isPin(h) && from >= to) continue
        const { id, kind, emoji, note, pending } = h
        highlights.push({ id, kind, emoji, note, pending, from, to })
      }
      changed = true
    }
    if (!changed) return value
    return { highlights, hidden, decorations: buildDecorations(doc, highlights) }
  },
  provide: (field) => [
    EditorView.decorations.from(field, (value) => value.decorations),
    teacherHighlightsTheme,
    noteMeasurer,
  ],
})

/**
 * The ids of the highlights a view update cleared because the user edited inside them; the
 * editor reports each through onHighlightDismiss.
 */
export function highlightsClearedByUserEdit(update) {
  const ids = (state) => state.field(teacherHighlightsField, false)?.highlights ?? []
  const before = ids(update.startState)
  if (before.length === 0) return []
  const after = new Set(ids(update.state).map((h) => h.id))
  return before.filter((h) => !after.has(h.id)).map((h) => h.id)
}
