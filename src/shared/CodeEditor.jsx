/**
 * Shared CodeMirror React wrapper — used by both the classroom app and lesson builder.
 * Accepts the language type, current value, an onChange callback, and a readOnly flag.
 * Creates a single EditorView and updates it imperatively to avoid full re-mounts.
 */
import React, { useEffect, useRef } from 'react'
import { EditorState, StateEffect, StateField } from '@codemirror/state'
import { Decoration, EditorView, WidgetType } from '@codemirror/view'
import {
  createBaseExtensions,
  readOnlyCompartment,
  languageCompartment,
  tabSizeCompartment,
  getLanguageExtension,
  getTabSize,
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
        return Decoration.set([Decoration.widget({ widget: new RemoteCursorWidget(), side: 1 }).range(from)])
      }
      return Decoration.set([Decoration.mark({ class: 'cm-remoteSelection' }).range(Math.min(from, to), Math.max(from, to))])
    }
    return markers
  },
  provide: field => EditorView.decorations.from(field),
})

// Teacher-authored markup highlights: unlike remoteSelection, this holds
// any number of ranges at once and each carries an emoji "badge" the
// student clicks to dismiss.
const setTeacherHighlights = StateEffect.define()

class TeacherHighlightWidget extends WidgetType {
  constructor(id, emoji, note) {
    super()
    this.id = id
    this.emoji = emoji
    this.note = note
  }
  eq(other) {
    return other.id === this.id && other.emoji === this.emoji && other.note === this.note
  }
  toDOM() {
    const badge = document.createElement('button')
    badge.type = 'button'
    badge.className = 'cm-teacherHighlightBadge'
    badge.title = this.note ? this.note : 'Dismiss this highlight'
    badge.dataset.highlightId = this.id

    const emojiSpan = document.createElement('span')
    emojiSpan.textContent = this.emoji || '★'
    badge.appendChild(emojiSpan)

    const labelSpan = document.createElement('span')
    labelSpan.className = 'cm-teacherHighlightBadgeLabel'
    labelSpan.textContent = 'Dismiss ✕'
    badge.appendChild(labelSpan)

    return badge
  }
  ignoreEvent() {
    return false
  }
}

const teacherHighlightsField = StateField.define({
  create() {
    return Decoration.none
  },
  update(marks, transaction) {
    marks = marks.map(transaction.changes)
    for (const effect of transaction.effects) {
      if (!effect.is(setTeacherHighlights)) continue
      const max = transaction.state.doc.length
      const ranges = []
      for (const h of effect.value ?? []) {
        const from = Math.min(Math.max(h.from ?? 0, 0), max)
        const to = Math.min(Math.max(h.to ?? from, 0), max)
        if (from >= to) continue
        ranges.push(Decoration.mark({ class: 'cm-teacherHighlight' }).range(from, to))
        ranges.push(Decoration.widget({ widget: new TeacherHighlightWidget(h.id, h.emoji, h.note), side: 1 }).range(to))
      }
      marks = Decoration.set(ranges, true)
    }
    return marks
  },
  provide: field => EditorView.decorations.from(field),
})

export function CodeEditor({
  value = '',
  language = 'python',
  readOnly = false,
  onChange,
  onSelectionChange,
  onActivity,
  remoteSelection = null,
  teacherHighlights = [],
  onHighlightDismiss,
  style,
}) {
  const containerRef = useRef(null)
  const viewRef      = useRef(null)
  const onChangeRef  = useRef(onChange)
  const onSelectionChangeRef = useRef(onSelectionChange)
  const onActivityRef = useRef(onActivity)
  const onHighlightDismissRef = useRef(onHighlightDismiss)
  onChangeRef.current = onChange
  onSelectionChangeRef.current = onSelectionChange
  onActivityRef.current = onActivity
  onHighlightDismissRef.current = onHighlightDismiss

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
          EditorView.updateListener.of(update => {
            if (update.docChanged) {
              onChangeRef.current?.(update.state.doc.toString())
            }
            if (update.docChanged || update.selectionSet) {
              const selection = update.state.selection.main
              onSelectionChangeRef.current?.({ from: selection.from, to: selection.to })
            }
          }),
          EditorView.domEventHandlers({
            copy: () => { onActivityRef.current?.({ type: 'copy', at: Date.now() }); return false },
            paste: () => { onActivityRef.current?.({ type: 'paste', at: Date.now() }); return false },
            mousedown: event => {
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
}
