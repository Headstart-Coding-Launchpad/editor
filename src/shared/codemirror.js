import { EditorState, Compartment } from '@codemirror/state'
import {
  EditorView,
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

export function getLanguageExtension(type) {
  switch (type) {
    case 'python':
      return python()
    case 'html':
      return html()
    case 'css':
      return css()
    case 'javascript':
      return javascript()
    default:
      return python()
  }
}

export function getTabSize(type) {
  return type === 'python' ? 4 : 2
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
