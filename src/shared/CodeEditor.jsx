/**
 * Shared CodeMirror React wrapper — used by both the classroom app and lesson builder.
 * Accepts the language type, current value, an onChange callback, and a readOnly flag.
 * Creates a single EditorView and updates it imperatively to avoid full re-mounts.
 */
import React, { useContext, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { Compartment, EditorState, StateEffect, StateField } from '@codemirror/state'
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
  lineHintsExtension,
  setLineHints,
} from './codemirror'
import { chooseLineHints } from './lineHints'
import { blockGuidesExtension } from './blockGuides'
import { BadgeSignalsContext } from './badgeSignalsContext'

// The CodeMirror user-event types that are the student's own editing (typing, pasting,
// deleting, dragging text, undo/redo). A value replaced from outside (task switch, carry-through,
// a sandbox push, a teacher edit) is dispatched without a user event, so it never matches.
const USER_EDIT_EVENTS = ['input', 'delete', 'move', 'undo', 'redo']

/** Whether a CodeMirror view update contains a document change the user made. */
export function isUserEditUpdate(update) {
  return (
    !!update?.docChanged &&
    update.transactions.some(
      (tr) => tr.docChanged && USER_EDIT_EVENTS.some((type) => tr.isUserEvent(type))
    )
  )
}

// The user accepted an autocomplete suggestion (CodeMirror tags the insert 'input.complete').
export function isAutocompletePick(update) {
  return !!update?.transactions?.some((tr) => tr.isUserEvent('input.complete'))
}

// Typing measures for the session report (src/shared/typingStats.js): the characters a view
// update inserted by keystrokes. Only plain input counts ('input', 'input.type', composition):
// a paste ('input.paste', reported separately), a drop ('input.drop'), an accepted autocomplete
// ('input.complete'), undo/redo and every outside value sync are never typing. Enter's
// auto-indent is one keystroke, so whitespace right after an inserted newline isn't counted.
const NOT_TYPED_INPUT_EVENTS = ['input.paste', 'input.drop', 'input.complete']

export function typedCharsInUpdate(update) {
  let chars = 0
  for (const tr of update?.transactions ?? []) {
    if (!tr.docChanged || !tr.isUserEvent('input')) continue
    if (NOT_TYPED_INPUT_EVENTS.some((type) => tr.isUserEvent(type))) continue
    tr.changes.iterChanges((_fromA, _toA, _fromB, _toB, inserted) => {
      const text = inserted.toString().replace(/\n[ \t]+/g, '\n')
      chars += Array.from(text).length
    })
  }
  return chars
}

// A Backspace or Delete press in an editable editor (a correction, for the typing measures).
// Holding the key down counts once.
export function isCorrectionKey(event) {
  return (event?.key === 'Backspace' || event?.key === 'Delete') && !event.repeat
}

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

// Whether a change (the span fromA..toA of the old document was inserted at, deleted or
// replaced) touches the highlighted text itself. Typing right at either edge, or deleting
// text that only borders the range, does not: the highlight just moves with its code.
function changeTouchesHighlight(fromA, toA, h) {
  return fromA < h.to && toA > h.from
}

export const teacherHighlightsField = StateField.define({
  create() {
    return { decorations: Decoration.none, highlights: [] }
  },
  update(value, transaction) {
    let highlights = value.highlights
    let changed = false
    if (transaction.docChanged && highlights.length > 0) {
      // The user's own edit (typing, deleting, pasting, undo) inside a highlighted range
      // clears that highlight for good: the code it marked has changed. Every other
      // highlight, and every highlight under an outside change (task switch, a live mirror
      // update), is mapped so it stays on the code it marks.
      const touched = new Set()
      if (USER_EDIT_EVENTS.some((type) => transaction.isUserEvent(type))) {
        transaction.changes.iterChangedRanges((fromA, toA) => {
          for (const h of highlights) {
            if (changeTouchesHighlight(fromA, toA, h)) touched.add(h.id)
          }
        })
      }
      highlights = highlights
        .filter((h) => !touched.has(h.id))
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
      // The incoming list says which highlights exist. One the editor already shows keeps
      // the position it has been mapped to (the stored one predates the latest edits); a new
      // one is placed at its stored position; the rest are removed.
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

/**
 * The ids of the teacher highlights a view update cleared because the user edited inside
 * them (see teacherHighlightsField); the editor reports each through onHighlightDismiss.
 */
export function highlightsClearedByUserEdit(update) {
  if (!isUserEditUpdate(update)) return []
  const before = update.startState.field(teacherHighlightsField, false)?.highlights ?? []
  if (before.length === 0) return []
  const after = new Set(
    (update.state.field(teacherHighlightsField, false)?.highlights ?? []).map((h) => h.id)
  )
  return before.filter((h) => !after.has(h.id)).map((h) => h.id)
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

// Python block brackets (./blockGuides.js), on only while the `blockGuides` prop is set.
const blockGuidesCompartment = new Compartment()

function blockGuidesFor(on) {
  return on ? blockGuidesExtension() : []
}

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
    // Author line hints for this content: an array of hint sets (getTaskLineHintSets). The set
    // that fits the loaded text best is shown, re-anchored whenever the value is replaced from
    // outside (task switch, reset, saved code) — see chooseLineHints in ./lineHints.js.
    lineHints = null,
    onRunShortcut,
    // Fires on a document change the user made (see USER_EDIT_EVENTS), never on the external
    // value sync. Without it, the classroom's BadgeSignalsContext (if any) is told instead.
    onUserEdit,
    // Draw coloured Python block brackets beside indented code (only PythonEditor sets it).
    blockGuides = false,
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
  const badgeSignals = useContext(BadgeSignalsContext)
  const onUserEditRef = useRef(null)
  onUserEditRef.current = onUserEdit ?? badgeSignals?.reportUserEdit ?? null
  const onAutocompleteRef = useRef(null)
  onAutocompleteRef.current = badgeSignals?.reportAutocomplete ?? null
  // Typing measures for the session report (useStudentTypingStats); no-op outside the classroom.
  const onTypingRef = useRef(null)
  onTypingRef.current = badgeSignals?.reportTyping ?? null
  const lineHintSetsRef = useRef(lineHints)
  lineHintSetsRef.current = lineHints
  // Callers build the sets inline, so compare by content: a new array with the same hints must
  // not re-anchor (and so resurrect) hints the student has deleted.
  const lineHintsKey = useMemo(() => JSON.stringify(lineHints ?? []), [lineHints])
  // The teacher highlights are rebuilt from every session snapshot (even one the student's own
  // selection write caused), so they too are compared by content: only a real change to the
  // set may reach the editor, or the positions it has mapped through edits would be reset.
  const teacherHighlightsRef = useRef(teacherHighlights)
  teacherHighlightsRef.current = teacherHighlights
  // Highlights this editor cleared because the user edited inside them. They stay cleared even
  // while the session still lists them (the dismissal write is in flight, or there is none).
  const clearedHighlightIdsRef = useRef(new Set())
  const teacherHighlightsKey = useMemo(
    () => JSON.stringify(teacherHighlights ?? []),
    [teacherHighlights]
  )

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
          lineHintsExtension(),
          blockGuidesCompartment.of(blockGuidesFor(blockGuides)),
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
              if (isUserEditUpdate(update)) onUserEditRef.current?.('editor')
              if (isAutocompletePick(update)) {
                onAutocompleteRef.current?.()
                onTypingRef.current?.({ kind: 'autocomplete' })
              }
              const typedChars = typedCharsInUpdate(update)
              if (typedChars > 0) {
                onTypingRef.current?.({ kind: 'insert', chars: typedChars, at: Date.now() })
              }
              for (const id of highlightsClearedByUserEdit(update)) {
                clearedHighlightIdsRef.current.add(id)
                onHighlightDismissRef.current?.(id)
              }
            }
            if (update.docChanged || update.selectionSet) {
              const selection = update.state.selection.main
              onSelectionChangeRef.current?.({ from: selection.from, to: selection.to })
            }
          }),
          EditorView.domEventHandlers({
            keydown: (event, view) => {
              if (isCorrectionKey(event) && !view.state.readOnly) {
                onTypingRef.current?.({ kind: 'correction', at: Date.now() })
              }
              return false
            },
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

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: blockGuidesCompartment.reconfigure(blockGuidesFor(blockGuides)),
    })
  }, [blockGuides])

  // Sync external value changes (e.g. task switch, sandbox push)
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== value) {
      view.dispatch({
        // Only the changed span, so highlights on unchanged code survive (see minimalReplace).
        changes: minimalReplace(current, value ?? ''),
        effects: setLineHints.of(chooseLineHints(value ?? '', lineHintSetsRef.current)),
      })
    }
  }, [value])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: setLineHints.of(chooseLineHints(view.state.doc.toString(), lineHintSetsRef.current)),
    })
  }, [lineHintsKey])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({ effects: setRemoteSelection.of(remoteSelection) })
  }, [remoteSelection])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const cleared = clearedHighlightIdsRef.current
    const highlights = (teacherHighlightsRef.current ?? []).filter((h) => !cleared.has(h.id))
    view.dispatch({ effects: setTeacherHighlights.of(highlights) })
  }, [teacherHighlightsKey])

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
          // Typed through an on-screen button, so it is the user's own input.
          userEvent: 'input.type',
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
