// Python slow-mo's marks in the code editor (CodeMirror 6): the line that just ran (a still
// amber band with a ▶ arrow — no animation, so it suits reduced motion as it is) and a loop pass
// counter at the end of each loop header line ("pass 3 of 4").
//
// Kept apart from src/shared/CodeEditor.jsx: PythonEditor installs it on demand through the
// editor's `getView()` handle (applySlowMoMarker). Modelled on CodeEditor's errorLineField: set
// by an effect, cleared as soon as the code changes.
import { StateEffect, StateField } from '@codemirror/state'
import { Decoration, EditorView, WidgetType } from '@codemirror/view'

// { line, passes: [{ line, label }] } | null
export const setSlowMoMarker = StateEffect.define()

class ArrowWidget extends WidgetType {
  eq() {
    return true
  }
  toDOM() {
    const span = document.createElement('span')
    span.className = 'cm-slowMoArrow'
    span.textContent = '▶'
    span.setAttribute('aria-hidden', 'true')
    return span
  }
  ignoreEvent() {
    return true
  }
}

class PassWidget extends WidgetType {
  constructor(label) {
    super()
    this.label = label
  }
  eq(other) {
    return other.label === this.label
  }
  toDOM() {
    const span = document.createElement('span')
    span.className = 'cm-slowMoPass'
    span.textContent = this.label
    // The slow-mo bar's live region reads the passes out; this is the visual copy.
    span.setAttribute('aria-hidden', 'true')
    return span
  }
  ignoreEvent() {
    return true
  }
}

/** The decorations for a marker (exported for tests). Out-of-range lines are skipped. */
export function buildSlowMoDecorations(doc, marker) {
  if (!marker) return Decoration.none
  const ranges = []
  const lines = doc.lines
  const valid = (line) => Number.isInteger(line) && line >= 1 && line <= lines
  if (valid(marker.line)) {
    const info = doc.line(marker.line)
    ranges.push(
      Decoration.line({
        class: 'cm-slowMoLine',
        attributes: { 'data-slowmo-current': 'true' },
      }).range(info.from)
    )
    ranges.push(Decoration.widget({ widget: new ArrowWidget(), side: -1 }).range(info.from))
  }
  for (const pass of Array.isArray(marker.passes) ? marker.passes : []) {
    if (!valid(pass?.line) || !pass.label) continue
    const info = doc.line(pass.line)
    ranges.push(Decoration.widget({ widget: new PassWidget(pass.label), side: 1 }).range(info.to))
  }
  return Decoration.set(ranges, true)
}

export const slowMoMarkerField = StateField.define({
  create() {
    return Decoration.none
  },
  update(deco, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setSlowMoMarker))
        return buildSlowMoDecorations(transaction.state.doc, effect.value)
    }
    // Editing ends slow-mo; the band must not drift onto another line meanwhile.
    if (transaction.docChanged) return Decoration.none
    return deco
  },
  provide: (field) => EditorView.decorations.from(field),
})

const slowMoMarkerTheme = EditorView.baseTheme({
  '.cm-slowMoLine': {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    boxShadow: 'inset 4px 0 0 #b45309',
  },
  '.cm-slowMoArrow': {
    color: '#b45309',
    fontSize: '0.7em',
    marginRight: '4px',
    verticalAlign: 'middle',
  },
  '.cm-slowMoPass': {
    display: 'inline-block',
    marginLeft: '12px',
    padding: '0 8px',
    borderRadius: '999px',
    border: '1px solid #b45309',
    background: '#fff7ed',
    color: '#7c2d12',
    fontFamily: 'var(--font-body, system-ui, sans-serif)',
    fontSize: '0.78em',
    fontWeight: '700',
    lineHeight: '1.6',
    verticalAlign: 'middle',
  },
})

export function slowMoMarkerExtension() {
  return [slowMoMarkerField, slowMoMarkerTheme]
}

/**
 * Shows `marker` in an editor view (installing the extension the first time), scrolling the
 * current line into view. `null` clears it.
 */
export function applySlowMoMarker(view, marker) {
  if (!view) return
  const installed = view.state.field(slowMoMarkerField, false) !== undefined
  if (!installed) {
    if (!marker) return
    view.dispatch({ effects: StateEffect.appendConfig.of(slowMoMarkerExtension()) })
  }
  const effects = [setSlowMoMarker.of(marker ?? null)]
  const line = marker?.line
  if (Number.isInteger(line) && line >= 1 && line <= view.state.doc.lines) {
    effects.push(EditorView.scrollIntoView(view.state.doc.line(line).from, { y: 'nearest' }))
  }
  view.dispatch({ effects })
}
