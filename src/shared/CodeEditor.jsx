/**
 * Shared CodeMirror React wrapper — used by both the classroom app and lesson builder.
 * Accepts the language type, current value, an onChange callback, and a readOnly flag.
 * Creates a single EditorView and updates it imperatively to avoid full re-mounts.
 */
import React, { useEffect, useImperativeHandle, useRef } from 'react'
import { EditorState, StateEffect, StateField } from '@codemirror/state'
import { Decoration, EditorView, WidgetType, keymap } from '@codemirror/view'
import { indentUnit } from '@codemirror/language'
import {
  createBaseExtensions,
  readOnlyCompartment,
  languageCompartment,
  tabSizeCompartment,
  indentUnitCompartment,
  getLanguageExtension,
  getTabSize,
  getIndentUnit,
} from './codemirror'

const setRemoteSelection = StateEffect.define()

class RemoteCursorWidget extends WidgetType {
  toDOM() {
    const marker = document.createElement('span')
    marker.className = 'cm-remoteCursor'
    marker.setAttribute('aria-hidden', 'true')
    return marker
  }
}

const remoteSelectionField = StateField.define({
  create() {
    return Decoration.none
  },
  update(markers, transaction) {
    markers = markers.map(transaction.changes)
    for (const effect of transaction.effects) {
      if (!effect.is(setRemoteSelection)) continue
      const selection = effect.value
      if (!selection) return Decoration.none
      const max = transaction.state.doc.length
      const from = Math.min(Math.max(selection.from ?? 0, 0), max)
      const to = Math.min(Math.max(selection.to ?? from, 0), max)
      if (from === to) {
        return Decoration.set([
          Decoration.widget({ widget: new RemoteCursorWidget(), side: 1 }).range(from),
        ])
      }
      return Decoration.set([
        Decoration.mark({ class: 'cm-remoteSelection' }).range(
          Math.min(from, to),
          Math.max(from, to)
        ),
      ])
    }
    return markers
  },
  provide: (field) => EditorView.decorations.from(field),
})

// Teacher-authored markup highlights: unlike remoteSelection, this holds
// any number of ranges at once. Each range gets an inline background mark,
// and each highlighted line gets emoji "badges" the student clicks to
// dismiss. The badges float in the empty space past the end of the line from
// a zero-width anchor, so they never push code sideways, make the line
// taller, or cover any of the student's code.
export const setTeacherHighlights = StateEffect.define()

class TeacherHighlightBadgesWidget extends WidgetType {
  constructor(badges) {
    super()
    this.badges = badges
  }
  eq(other) {
    return (
      other.badges.length === this.badges.length &&
      other.badges.every(
        (b, i) =>
          b.id === this.badges[i].id &&
          b.emoji === this.badges[i].emoji &&
          b.note === this.badges[i].note
      )
    )
  }
  toDOM() {
    const anchor = document.createElement('span')
    anchor.className = 'cm-teacherHighlightAnchor'
    const row = document.createElement('span')
    row.className = 'cm-teacherHighlightBadges'
    anchor.appendChild(row)

    for (const highlight of this.badges) {
      const badge = document.createElement('button')
      badge.type = 'button'
      badge.className = 'cm-teacherHighlightBadge'
      badge.title = highlight.note
        ? `${highlight.note} (click to dismiss)`
        : 'Dismiss this highlight'
      badge.setAttribute('aria-label', badge.title)
      badge.dataset.highlightId = highlight.id

      const emojiSpan = document.createElement('span')
      emojiSpan.textContent = highlight.emoji || '★'
      badge.appendChild(emojiSpan)

      const labelSpan = document.createElement('span')
      labelSpan.className = 'cm-teacherHighlightBadgeLabel'
      labelSpan.textContent = '✕'
      badge.appendChild(labelSpan)

      row.appendChild(badge)
    }
    return anchor
  }
  ignoreEvent() {
    return false
  }
}

function buildTeacherHighlightDecorations(doc, highlights) {
  const ranges = []
  const badgesByLineEnd = new Map()
  for (const h of highlights) {
    ranges.push(Decoration.mark({ class: 'cm-teacherHighlight' }).range(h.from, h.to))
    // A selection ending at the very start of a line (e.g. a whole line
    // including its newline) belongs to the previous line.
    const endsAtLineStart = doc.lineAt(h.to).from === h.to
    const line = doc.lineAt(endsAtLineStart ? h.to - 1 : h.to)
    if (!badgesByLineEnd.has(line.to)) badgesByLineEnd.set(line.to, [])
    badgesByLineEnd.get(line.to).push(h)
  }
  for (const [lineEnd, badges] of badgesByLineEnd) {
    ranges.push(
      Decoration.widget({ widget: new TeacherHighlightBadgesWidget(badges), side: 1 }).range(
        lineEnd
      )
    )
  }
  return Decoration.set(ranges, true)
}

export const teacherHighlightsField = StateField.define({
  create() {
    return { decorations: Decoration.none, highlights: [] }
  },
  update(value, transaction) {
    let highlights = value.highlights
    let changed = false
    if (transaction.docChanged && highlights.length > 0) {
      highlights = highlights
        .map((h) => ({
          ...h,
          from: transaction.changes.mapPos(h.from, 1),
          to: transaction.changes.mapPos(h.to, -1),
        }))
        .filter((h) => h.from < h.to)
      changed = true
    }
    for (const effect of transaction.effects) {
      if (!effect.is(setTeacherHighlights)) continue
      const max = transaction.state.doc.length
      highlights = []
      for (const h of effect.value ?? []) {
        const from = Math.min(Math.max(h.from ?? 0, 0), max)
        const to = Math.min(Math.max(h.to ?? from, 0), max)
        if (from >= to) continue
        highlights.push({ id: h.id, emoji: h.emoji, note: h.note, from, to })
      }
      changed = true
    }
    if (!changed) return value
    return {
      highlights,
      decorations: buildTeacherHighlightDecorations(transaction.state.doc, highlights),
    }
  },
  provide: (field) => EditorView.decorations.from(field, (value) => value.decorations),
})

// Runtime error-line highlight: a single whole-line marker showing where the
// student's last Run threw. Cleared automatically the moment the document
// changes (first keystroke after the error), not just on the next Run.
export const setErrorLine = StateEffect.define()

export const errorLineField = StateField.define({
  create() {
    return Decoration.none
  },
  update(deco, transaction) {
    for (const effect of transaction.effects) {
      if (!effect.is(setErrorLine)) continue
      const line = effect.value
      if (line == null) return Decoration.none
      const maxLine = transaction.state.doc.lines
      const lineNum = Math.min(Math.max(Math.trunc(line), 1), maxLine)
      const lineInfo = transaction.state.doc.line(lineNum)
      return Decoration.set([Decoration.line({ class: 'cm-errorLine' }).range(lineInfo.from)])
    }
    if (transaction.docChanged) return Decoration.none
    return deco
  },
  provide: (field) => EditorView.decorations.from(field),
})

export const CodeEditor = React.forwardRef(function CodeEditor(
  {
    value = '',
    language = 'python',
    readOnly = false,
    onChange,
    onSelectionChange,
    onActivity,
    remoteSelection = null,
    teacherHighlights = [],
    onHighlightDismiss,
    errorLine = null,
    onRunShortcut,
    style,
  },
  ref
) {
  const containerRef = useRef(null)
  const viewRef = useRef(null)
  const onChangeRef = useRef(onChange)
  const onSelectionChangeRef = useRef(onSelectionChange)
  const onActivityRef = useRef(onActivity)
  const onHighlightDismissRef = useRef(onHighlightDismiss)
  const onRunShortcutRef = useRef(onRunShortcut)
  onChangeRef.current = onChange
  onSelectionChangeRef.current = onSelectionChange
  onActivityRef.current = onActivity
  onHighlightDismissRef.current = onHighlightDismiss
  onRunShortcutRef.current = onRunShortcut

  // Mount the editor once
  useEffect(() => {
    if (!containerRef.current) return

    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          ...createBaseExtensions(language, readOnly),
          remoteSelectionField,
          teacherHighlightsField,
          errorLineField,
          keymap.of([
            {
              key: 'Mod-Enter',
              run: () => {
                if (!onRunShortcutRef.current) return false
                onRunShortcutRef.current()
                return true
              },
            },
          ]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current?.(update.state.doc.toString())
            }
            if (update.docChanged || update.selectionSet) {
              const selection = update.state.selection.main
              onSelectionChangeRef.current?.({ from: selection.from, to: selection.to })
            }
          }),
          EditorView.domEventHandlers({
            copy: () => {
              onActivityRef.current?.({ type: 'copy', at: Date.now() })
              return false
            },
            paste: () => {
              onActivityRef.current?.({ type: 'paste', at: Date.now() })
              return false
            },
            mousedown: (event) => {
              const badge = event.target.closest?.('.cm-teacherHighlightBadge')
              if (badge) {
                onHighlightDismissRef.current?.(badge.dataset.highlightId)
                return true
              }
              onActivityRef.current?.({ type: 'click', at: Date.now() })
              return false
            },
          }),
        ],
      }),
      parent: containerRef.current,
    })
    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep readOnly compartment in sync
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: readOnlyCompartment.reconfigure(EditorState.readOnly.of(readOnly)),
    })
  }, [readOnly])

  // Keep language in sync
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: [
        languageCompartment.reconfigure(getLanguageExtension(language)),
        tabSizeCompartment.reconfigure(EditorState.tabSize.of(getTabSize(language))),
        indentUnitCompartment.reconfigure(indentUnit.of(getIndentUnit(language))),
      ],
    })
  }, [language])

  // Sync external value changes (e.g. task switch, sandbox push)
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value ?? '' },
      })
    }
  }, [value])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({ effects: setRemoteSelection.of(remoteSelection) })
  }, [remoteSelection])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({ effects: setTeacherHighlights.of(teacherHighlights) })
  }, [teacherHighlights])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({ effects: setErrorLine.of(errorLine) })
  }, [errorLine])

  // Lets an on-screen "insert symbol" button row (see PythonEditor.jsx) type
  // into the editor the same way a keyboard keypress would, without either
  // side needing to know about CodeMirror's EditorView internals.
  useImperativeHandle(
    ref,
    () => ({
      insertAtCursor(text) {
        const view = viewRef.current
        if (!view || readOnly) return
        const { from, to } = view.state.selection.main
        view.dispatch({
          changes: { from, to, insert: text },
          selection: { anchor: from + text.length },
        })
        view.focus()
      },
    }),
    [readOnly]
  )

  return (
    <div
      ref={containerRef}
      style={{
        height: '100%',
        overflow: 'auto',
        border: readOnly ? '1px solid rgba(239,68,68,0.3)' : '1px solid #e5e7eb',
        borderRadius: '8px',
        background: readOnly ? 'rgba(239,68,68,0.04)' : '#fafafa',
        ...style,
      }}
    />
  )
})
