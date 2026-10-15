// The `#@peek` "stopped here" band in the CodeMirror editor: a dashed bar with ⏸ in the gap
// above the line a name-tag panel with `showVariables.at: marker` shows the values before
// ("The tags show the values here"). It shows from when the task opens, before any run, so a
// predict-mode student knows where to predict. After a run that never reached the line it reads
// "The program never reached this line". Deliberately unlike Python slow-mo's amber "this line
// ran" band (src/modules/python/slowMo/editorMarker.js): purple, dashed, between lines.
//
// The band is a block widget, not part of the document, so it never reaches the student's
// code, the clipboard or the undo history. It follows its line through edits (like the line
// hints in ./codemirror.js) and goes when that line is deleted; the caller re-places it from
// the code (getPeekBand in ./variablesPanel/variablesPanel.js, which re-anchors the peek the
// way the run does).
//
// Dispatch `setPeekBand.of({ line, missed })` (1-based line) to place it; null clears it.
import { StateEffect, StateField } from '@codemirror/state'
import { Decoration, EditorView, WidgetType } from '@codemirror/view'
import { lineRemoved } from './codemirror'

export const PEEK_BAND_TEXT = 'The tags show the values here'
export const PEEK_BAND_MISSED_TEXT = 'The program never reached this line'

export const setPeekBand = StateEffect.define()

/** What screen readers hear for the band above line `line`. */
export function peekBandLabel(line, missed = false) {
  const where = `Values shown just before line ${line}`
  return missed ? `${where}. ${PEEK_BAND_MISSED_TEXT}` : where
}

// Holds `{ pos, missed }` (`pos` the start of the marked line) or null.
export const peekBandField = StateField.define({
  create() {
    return null
  },
  update(band, transaction) {
    let next = band
    if (transaction.docChanged && band) {
      const line = transaction.startState.doc.lineAt(band.pos)
      if (lineRemoved(transaction.changes, line.from, line.to)) {
        next = null
      } else {
        const mapped = transaction.changes.mapPos(line.from, 1)
        next = { pos: transaction.state.doc.lineAt(mapped).from, missed: band.missed }
      }
    }
    for (const effect of transaction.effects) {
      if (!effect.is(setPeekBand)) continue
      const value = effect.value
      const { doc } = transaction.state
      next =
        value && Number.isInteger(value.line) && value.line >= 1 && value.line <= doc.lines
          ? { pos: doc.line(value.line).from, missed: !!value.missed }
          : null
    }
    return next
  },
})

/** The band a state shows: `{ line, missed }` or null. */
export function getPeekBandState(state) {
  const band = state.field(peekBandField, false)
  if (!band) return null
  return { line: state.doc.lineAt(band.pos).number, missed: band.missed }
}

class PeekBandWidget extends WidgetType {
  constructor(line, missed) {
    super()
    this.line = line
    this.missed = missed
  }
  eq(other) {
    return other.line === this.line && other.missed === this.missed
  }
  toDOM() {
    const band = document.createElement('div')
    band.className = `cm-peekBand${this.missed ? ' cm-peekBand--missed' : ''}`
    band.setAttribute('role', 'note')
    band.setAttribute('aria-label', peekBandLabel(this.line, this.missed))
    band.dataset.peekLine = String(this.line)
    const icon = document.createElement('span')
    icon.className = 'cm-peekBandIcon'
    icon.textContent = '⏸'
    icon.setAttribute('aria-hidden', 'true')
    const text = document.createElement('span')
    text.className = 'cm-peekBandText'
    text.textContent = this.missed ? PEEK_BAND_MISSED_TEXT : PEEK_BAND_TEXT
    band.append(icon, text)
    return band
  }
  ignoreEvent() {
    return true
  }
}

const peekBandDecorations = EditorView.decorations.compute([peekBandField], (state) => {
  const band = getPeekBandState(state)
  if (!band) return Decoration.none
  return Decoration.set([
    Decoration.widget({
      widget: new PeekBandWidget(band.line, band.missed),
      block: true,
      side: -1,
    }).range(state.doc.line(band.line).from),
  ])
})

const peekBandTheme = EditorView.baseTheme({
  '.cm-peekBand': {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    margin: '3px 0',
    padding: '1px 8px',
    border: '2px dashed #6d28d9',
    borderRadius: '6px',
    background: '#f5f3ff',
    color: '#4c1d95',
    fontFamily: 'var(--font-body, system-ui, sans-serif)',
    fontSize: '0.8em',
    fontWeight: '700',
    lineHeight: '1.5',
    whiteSpace: 'normal',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    cursor: 'default',
  },
  '.cm-peekBand--missed': {
    borderColor: '#6b7280',
    background: '#f3f4f6',
    color: '#374151',
  },
  '.cm-peekBandIcon': {
    flexShrink: '0',
  },
})

// The peek band extension: add it to an editor, then dispatch setPeekBand.
export function peekBandExtension() {
  return [peekBandField, peekBandDecorations, peekBandTheme]
}
