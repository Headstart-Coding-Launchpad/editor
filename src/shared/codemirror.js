import { EditorState, Compartment, RangeSet, StateEffect, StateField } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  GutterMarker,
  WidgetType,
  gutter,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
} from '@codemirror/view'
import { defaultKeymap, indentWithTab, history, historyKeymap } from '@codemirror/commands'
import {
  bracketMatching,
  syntaxHighlighting,
  defaultHighlightStyle,
  indentOnInput,
  indentUnit,
  HighlightStyle,
} from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import { autocompletion, closeBrackets } from '@codemirror/autocomplete'
import { python } from '@codemirror/lang-python'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { javascript } from '@codemirror/lang-javascript'

// ─── Headstart brand theme ───────────────────────────────────────────────────

const headstartTheme = EditorView.theme(
  {
    '&': {
      fontSize: '15px',
      fontFamily: "'JetBrains Mono', monospace",
      backgroundColor: '#fafafa',
      height: '100%',
    },
    // CodeMirror's base theme sets `monospace` on the scroller, which beats the font above.
    // Ligatures off so != and <= show as typed, not as ≠ and ≤ (as in the output panel).
    '.cm-scroller': { fontFamily: "'JetBrains Mono', monospace", fontVariantLigatures: 'none' },
    '.cm-content': { padding: '8px 0', caretColor: '#6222CC' },
    '.cm-line': { padding: '0 14px' },
    '.cm-activeLine': { backgroundColor: 'rgba(240, 234, 250, 0.5)' },
    '.cm-gutters': {
      backgroundColor: '#f0f0f0',
      color: '#9ca3af',
      border: 'none',
      borderRight: '1px solid #e5e7eb',
    },
    '.cm-activeLineGutter': { backgroundColor: '#e8daf8' },
    '.cm-selectionBackground, ::selection': { backgroundColor: '#e9d5ff' },
    '.cm-focused .cm-selectionBackground': { backgroundColor: '#e9d5ff' },
    '.cm-remoteSelection': { backgroundColor: 'rgba(250, 204, 21, 0.42)' },
    '.cm-remoteCursor': {
      borderLeft: '2px solid #f59e0b',
      marginLeft: '-1px',
      height: '1.25em',
      display: 'inline-block',
      verticalAlign: 'text-bottom',
    },
    '.cm-teacherHighlight': {
      backgroundColor: 'rgba(37, 99, 235, 0.18)',
      borderBottom: '2px solid rgba(37, 99, 235, 0.6)',
    },
    // Badges float past the end of the highlighted line (see
    // teacherHighlightsField): a zero-size inline anchor with an absolutely
    // positioned pill row, so the code layout never changes.
    '.cm-teacherHighlightAnchor': {
      position: 'relative',
      display: 'inline-block',
      width: 0,
      height: 0,
    },
    '.cm-teacherHighlightBadges': {
      position: 'absolute',
      left: '10px',
      top: '-0.95em',
      display: 'inline-flex',
      gap: '4px',
      whiteSpace: 'nowrap',
      zIndex: 2,
    },
    '.cm-teacherHighlightBadge': {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      border: '1px solid rgba(37, 99, 235, 0.5)',
      background: '#dbeafe',
      color: '#1e40af',
      borderRadius: '999px',
      padding: '0 7px 0 5px',
      margin: 0,
      boxShadow: '0 1px 2px rgba(15, 23, 42, 0.15)',
      fontSize: '0.78em',
      fontWeight: 700,
      fontFamily: 'var(--font-body)',
      lineHeight: 1.5,
      cursor: 'pointer',
    },
    '.cm-teacherHighlightBadge:hover': {
      background: '#bfdbfe',
    },
    '.cm-teacherHighlightBadgeLabel': {
      letterSpacing: '0.01em',
    },
    '.cm-errorLine': {
      backgroundColor: 'rgba(220, 38, 38, 0.14)',
      borderLeft: '3px solid #dc2626',
    },
    '.cm-cursor': { borderLeftColor: '#6222CC', borderLeftWidth: '2px' },
    '.cm-matchingBracket': { backgroundColor: '#e9d5ff', outline: 'none' },
    '.cm-tooltip.cm-tooltip-autocomplete': {
      border: '1px solid #e5e7eb',
      borderRadius: '6px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    },
  },
  { dark: false }
)

const headstartHighlight = HighlightStyle.define([
  { tag: t.keyword, color: '#7c3aed', fontWeight: 'bold' },
  { tag: t.string, color: '#059669' },
  { tag: t.comment, color: '#9ca3af', fontStyle: 'italic' },
  { tag: t.number, color: '#0284c7' },
  { tag: t.operator, color: '#374151' },
  { tag: t.function(t.variableName), color: '#2563eb' },
  { tag: t.definition(t.variableName), color: '#111827' },
  { tag: t.typeName, color: '#b45309' },
  { tag: t.bool, color: '#7c3aed' },
  { tag: t.null, color: '#7c3aed' },
  { tag: t.atom, color: '#7c3aed' },
  { tag: t.className, color: '#b45309' },
  { tag: t.attributeName, color: '#0284c7' },
  { tag: t.attributeValue, color: '#059669' },
  { tag: t.tagName, color: '#b91c1c' },
  { tag: t.angleBracket, color: '#6b7280' },
  { tag: t.propertyName, color: '#2563eb' },
])

// ─── Compartments for runtime config changes ─────────────────────────────────

export const readOnlyCompartment = new Compartment()
export const languageCompartment = new Compartment()
export const tabSizeCompartment = new Compartment()
export const indentUnitCompartment = new Compartment()

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Editor language name → CodeMirror language support. Unknown names get Python.
const LANGUAGE_EXTENSIONS = { python, html, css, javascript }
// Tab width per editor language (PEP 8's four spaces for Python); every other language uses 2.
const TAB_SIZES = { python: 4 }
const DEFAULT_TAB_SIZE = 2

export function getLanguageExtension(type) {
  const language = Object.hasOwn(LANGUAGE_EXTENSIONS, type ?? '') ? type : 'python'
  return LANGUAGE_EXTENSIONS[language]()
}

export function getTabSize(type) {
  return Object.hasOwn(TAB_SIZES, type ?? '') ? TAB_SIZES[type] : DEFAULT_TAB_SIZE
}

export function getIndentUnit(type) {
  return ' '.repeat(getTabSize(type))
}

export function createBaseExtensions(type = 'python', readOnly = false) {
  return [
    lineNumbers(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    history(),
    bracketMatching(),
    closeBrackets(),
    autocompletion(),
    indentOnInput(),
    drawSelection(),
    keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
    headstartTheme,
    syntaxHighlighting(headstartHighlight),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    languageCompartment.of(getLanguageExtension(type)),
    tabSizeCompartment.of(EditorState.tabSize.of(getTabSize(type))),
    indentUnitCompartment.of(indentUnit.of(getIndentUnit(type))),
    readOnlyCompartment.of(EditorState.readOnly.of(readOnly)),
  ]
}

// ─── Line hints ──────────────────────────────────────────────────────────────
// Author hints attached to lines of starter code (see ./lineHints.js for the authoring syntax
// and anchoring). Each hinted line gets a 💡 gutter marker whose title is the hint, and the hint
// as faded ghost text after the line's content. Neither is part of the document, so hints never
// reach the student's code, the clipboard or the undo history. A hint follows its line through
// edits and disappears when the line itself is deleted (its text and a line break removed);
// clearing the line's text keeps it, so the student can rewrite the line with the hint in view.
//
// Dispatch `setLineHints.of([{ line, text }])` (1-based lines, already anchored — see
// chooseLineHints) to replace the hints; `[]` or null clears them.
export const setLineHints = StateEffect.define()

// Whether a change removed the whole line [from, to] together with a line break next to it.
function lineRemoved(changes, from, to) {
  let removed = false
  changes.iterChangedRanges((fromA, toA) => {
    if (fromA <= from && toA >= to && (fromA < from || toA > to)) removed = true
  })
  return removed
}

// Holds the hints as `[{ pos, text }]`, `pos` the start of the hinted line.
export const lineHintsField = StateField.define({
  create() {
    return []
  },
  update(hints, transaction) {
    let next = hints
    if (transaction.docChanged && hints.length > 0) {
      next = []
      for (const hint of hints) {
        const line = transaction.startState.doc.lineAt(hint.pos)
        if (lineRemoved(transaction.changes, line.from, line.to)) continue
        const mapped = transaction.changes.mapPos(line.from, 1)
        next.push({ pos: transaction.state.doc.lineAt(mapped).from, text: hint.text })
      }
    }
    for (const effect of transaction.effects) {
      if (!effect.is(setLineHints)) continue
      const { doc } = transaction.state
      next = (effect.value ?? [])
        .filter(
          (hint) =>
            Number.isInteger(hint?.line) &&
            hint.line >= 1 &&
            hint.line <= doc.lines &&
            typeof hint.text === 'string' &&
            hint.text
        )
        .map((hint) => ({ pos: doc.line(hint.line).from, text: hint.text }))
    }
    return next
  },
})

// The hints grouped by line: `[{ line, texts }]` in document order.
function hintsByLine(state) {
  const byLine = new Map()
  for (const hint of state.field(lineHintsField)) {
    const line = state.doc.lineAt(hint.pos)
    if (!byLine.has(line.from)) byLine.set(line.from, { line, texts: [] })
    byLine.get(line.from).texts.push(hint.text)
  }
  return [...byLine.values()].sort((a, b) => a.line.from - b.line.from)
}

// What a state's hints show as `[{ line, text }]` (texts joined per line).
export function getLineHints(state) {
  if (!state.field(lineHintsField, false)) return []
  return hintsByLine(state).map(({ line, texts }) => ({
    line: line.number,
    text: texts.join(' · '),
  }))
}

class LineHintGhostWidget extends WidgetType {
  constructor(text) {
    super()
    this.text = text
  }
  eq(other) {
    return other.text === this.text
  }
  toDOM() {
    const ghost = document.createElement('span')
    ghost.className = 'cm-lineHintGhost'
    ghost.textContent = this.text
    ghost.title = this.text
    return ghost
  }
}

class LineHintGutterMarker extends GutterMarker {
  constructor(text) {
    super()
    this.text = text
  }
  eq(other) {
    return other.text === this.text
  }
  toDOM() {
    const icon = document.createElement('span')
    icon.className = 'cm-lineHintIcon'
    icon.textContent = '💡'
    icon.title = this.text
    icon.setAttribute('role', 'img')
    icon.setAttribute('aria-label', `Hint: ${this.text}`)
    return icon
  }
}

const lineHintDecorations = EditorView.decorations.compute([lineHintsField], (state) =>
  Decoration.set(
    hintsByLine(state).map(({ line, texts }) =>
      Decoration.widget({ widget: new LineHintGhostWidget(texts.join(' · ')), side: 2 }).range(
        line.to
      )
    )
  )
)

const lineHintGutter = gutter({
  class: 'cm-lineHintGutter',
  markers: (view) =>
    RangeSet.of(
      hintsByLine(view.state).map(({ line, texts }) =>
        new LineHintGutterMarker(texts.join('\n')).range(line.from)
      )
    ),
})

const lineHintTheme = EditorView.baseTheme({
  '.cm-lineHintGutter .cm-gutterElement': {
    padding: '0 2px',
    cursor: 'help',
    fontSize: '0.8em',
  },
  // Padding, not margin: the cursor at the end of a hinted line is drawn against the ghost's
  // box, so a margin would leave it floating out past the line's last character.
  '.cm-lineHintGhost': {
    paddingLeft: '1.5em',
    color: '#9ca3af',
    fontStyle: 'italic',
    fontFamily: 'var(--font-body, sans-serif)',
    fontSize: '0.88em',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    pointerEvents: 'none',
  },
})

// The line-hint extension: add it to an editor, then dispatch setLineHints.
export function lineHintsExtension() {
  return [lineHintsField, lineHintDecorations, lineHintGutter, lineHintTheme]
}
