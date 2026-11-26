// Tutor highlights and pins in the CodeMirror editor (docs/agents/classroom-behaviours.md,
// "Teacher Code Highlights"). The same field draws them in the student's own editor and in the
// tutor's read-only mirror.
//
// - A highlight marks a range: a tight box when it sits on one line, one full-width band with a
//   left bar when it spans lines. A user edit inside it clears it for good.
// - A pin (`kind: 'pin'`, from === to) marks a spot with a thin caret. It stays while the child
//   types there (typed text goes before it) and moves with the code.
// - Each one gets a note row: a block widget under its last line (so it never covers code or the
//   lesson hint chip), with the mark, the tutor's words and one "Got it ✓" button (a "Remove"
//   button in the tutor's read-only mirror). Clicking the words does nothing. Its arrow is
//   measured from the editor, so it points at the words on a wrapped line too.
import { StateEffect, StateField } from '@codemirror/state'
import { Decoration, EditorView, WidgetType } from '@codemirror/view'
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

class PinWidget extends WidgetType {
  toDOM() {
    const caret = document.createElement('span')
    caret.className = 'cm-teacherPin'
    caret.setAttribute('aria-hidden', 'true')
    return caret
  }
}

class NoteRowWidget extends WidgetType {
  constructor(item) {
    super()
    this.item = item
  }
  eq(other) {
    const [a, b] = [this.item, other.item]
    return a.id === b.id && a.emoji === b.emoji && a.note === b.note && a.from === b.from
  }
  toDOM(view) {
    const { id, emoji, note, from, to } = this.item
    const row = document.createElement('div')
    row.className = 'cm-teacherNote'
    row.setAttribute('role', 'note')
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
    // Point the arrow at the words: the middle of a one-row highlight, else its start.
    view.requestMeasure({
      read: () => {
        const start = view.coordsAtPos(from, 1)
        const end = view.coordsAtPos(to, -1)
        const box = row.getBoundingClientRect()
        if (!start || !box.width) return null
        const sameRow = end && Math.abs(end.top - start.top) < 2
        return (sameRow ? (start.left + end.right) / 2 : start.left + 6) - box.left
      },
      write: (x) => {
        if (x == null) return
        row.style.setProperty('--note-arrow', `${Math.max(x, 12)}px`)
        pill.style.marginLeft = `${Math.max(x - 24, 0)}px`
      },
    })
    return row
  }
  // Only the button reaches the editor's handlers; a click on the words does nothing.
  ignoreEvent(event) {
    return !event.target?.closest?.('.cm-teacherNoteGotIt')
  }
}

function buildDecorations(doc, items) {
  const ranges = []
  for (const h of items) {
    // A selection ending at the very start of a line (a whole line with its newline) belongs
    // to the line before.
    const endsAtLineStart = h.to > h.from && doc.lineAt(h.to).from === h.to
    const first = doc.lineAt(h.from)
    const last = doc.lineAt(endsAtLineStart ? h.to - 1 : h.to)
    if (isPin(h)) {
      ranges.push(Decoration.widget({ widget: new PinWidget(), side: 1 }).range(h.from))
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

export const teacherHighlightsField = StateField.define({
  create() {
    return { decorations: Decoration.none, highlights: [] }
  },
  update(value, transaction) {
    let highlights = value.highlights
    let changed = false
    if (transaction.docChanged && highlights.length > 0) {
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
      const map = (pos, assoc) => transaction.changes.mapPos(pos, assoc)
      highlights = highlights
        .filter((h) => !touched.has(h.id))
        .map((h) => {
          if (!isPin(h)) return { ...h, from: map(h.from, 1), to: map(h.to, -1) }
          const at = map(h.from, 1)
          return { ...h, from: at, to: at }
        })
        .filter((h) => isPin(h) || h.from < h.to)
      changed = true
    }
    for (const effect of transaction.effects) {
      if (!effect.is(setTeacherHighlights)) continue
      // The incoming list says which exist. One already shown keeps its mapped position (the
      // stored one predates the latest edits); a new one is placed at its stored position.
      const max = transaction.state.doc.length
      const current = new Map(highlights.map((h) => [h.id, h]))
      highlights = []
      for (const h of effect.value ?? []) {
        const existing = current.get(h.id)
        if (existing) {
          highlights.push({ ...existing, emoji: h.emoji, note: h.note })
          continue
        }
        const from = Math.min(Math.max(h.from ?? 0, 0), max)
        const to = isPin(h) ? from : Math.min(Math.max(h.to ?? from, 0), max)
        if (!isPin(h) && from >= to) continue
        highlights.push({ id: h.id, kind: h.kind, emoji: h.emoji, note: h.note, from, to })
      }
      changed = true
    }
    if (!changed) return value
    return { highlights, decorations: buildDecorations(transaction.state.doc, highlights) }
  },
  provide: (field) => [
    EditorView.decorations.from(field, (value) => value.decorations),
    teacherHighlightsTheme,
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
