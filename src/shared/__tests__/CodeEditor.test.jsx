import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import {
  CodeEditor,
  errorLineField,
  isAutocompletePick,
  isUserEditUpdate,
  minimalReplace,
  setErrorLine,
  setTeacherHighlights,
  teacherHighlightsField,
} from '../CodeEditor'

// Per docs/TESTING.md, CodeMirror editor internals (EditorView/DOM) are not
// unit-tested — instead we exercise the errorLineField StateField directly
// against an EditorState, the same way createBaseExtensions is tested as a
// config factory rather than a rendered editor.

function decorationRanges(state) {
  const ranges = []
  state.field(errorLineField).between(0, state.doc.length, (from, to, deco) => {
    ranges.push({ from, to, class: deco.spec.class })
  })
  return ranges
}

describe('errorLineField', () => {
  it('starts with no decorations', () => {
    const state = EditorState.create({ doc: 'a\nb\nc', extensions: [errorLineField] })
    expect(decorationRanges(state)).toEqual([])
  })

  it('highlights the requested line when setErrorLine is dispatched', () => {
    let state = EditorState.create({ doc: 'line1\nline2\nline3', extensions: [errorLineField] })
    state = state.update({ effects: setErrorLine.of(2) }).state

    const ranges = decorationRanges(state)
    expect(ranges).toHaveLength(1)
    expect(ranges[0].class).toBe('cm-errorLine')
    expect(ranges[0].from).toBe(state.doc.line(2).from)
  })

  it('clears the highlight when setErrorLine is dispatched with null', () => {
    let state = EditorState.create({ doc: 'line1\nline2', extensions: [errorLineField] })
    state = state.update({ effects: setErrorLine.of(1) }).state
    expect(decorationRanges(state)).toHaveLength(1)

    state = state.update({ effects: setErrorLine.of(null) }).state
    expect(decorationRanges(state)).toEqual([])
  })

  it('clears the highlight as soon as the document changes (first keystroke)', () => {
    let state = EditorState.create({ doc: 'line1\nline2', extensions: [errorLineField] })
    state = state.update({ effects: setErrorLine.of(1) }).state
    expect(decorationRanges(state)).toHaveLength(1)

    state = state.update({ changes: { from: 0, insert: 'x' } }).state
    expect(decorationRanges(state)).toEqual([])
  })

  it('leaves the highlight untouched across an unrelated selection-only transaction', () => {
    let state = EditorState.create({ doc: 'line1\nline2', extensions: [errorLineField] })
    state = state.update({ effects: setErrorLine.of(2) }).state
    state = state.update({ selection: { anchor: 0 } }).state
    expect(decorationRanges(state)).toHaveLength(1)
  })

  it('clamps an out-of-range line number to the last valid line', () => {
    let state = EditorState.create({ doc: 'only one line', extensions: [errorLineField] })
    state = state.update({ effects: setErrorLine.of(50) }).state

    const ranges = decorationRanges(state)
    expect(ranges).toHaveLength(1)
    expect(ranges[0].from).toBe(0)
  })
})

describe('teacherHighlightsField', () => {
  const doc = 'name = input()\nprint("Hello")\n'
  const highlight = { id: 'h1', emoji: '👀', note: 'Look here', from: 7, to: 12 }

  function decorations(state) {
    const out = []
    state
      .field(teacherHighlightsField)
      .decorations.between(0, state.doc.length, (from, to, deco) => {
        out.push(
          deco.spec.widget
            ? { at: from, badges: deco.spec.widget.badges.map((b) => b.id) }
            : { from, to, class: deco.spec.class }
        )
      })
    return out
  }

  it('marks the range and anchors the badge at the end of the line, not inside the code', () => {
    let state = EditorState.create({ doc, extensions: [teacherHighlightsField] })
    state = state.update({ effects: setTeacherHighlights.of([highlight]) }).state
    expect(decorations(state)).toEqual([
      { from: 7, to: 12, class: 'cm-teacherHighlight' },
      { at: 14, badges: ['h1'] },
    ])
  })

  it('groups badges for highlights on the same line into one anchor', () => {
    let state = EditorState.create({ doc, extensions: [teacherHighlightsField] })
    state = state.update({
      effects: setTeacherHighlights.of([
        highlight,
        { id: 'h2', from: 0, to: 4 },
        { id: 'h3', from: 15, to: 29 },
      ]),
    }).state
    const anchors = decorations(state).filter((d) => d.badges)
    expect(anchors).toEqual([
      { at: 14, badges: ['h1', 'h2'] },
      { at: 29, badges: ['h3'] },
    ])
  })

  it('puts a whole-line selection (ending after the newline) on the selected line', () => {
    let state = EditorState.create({ doc, extensions: [teacherHighlightsField] })
    state = state.update({
      effects: setTeacherHighlights.of([{ id: 'line', from: 0, to: 15 }]),
    }).state
    expect(decorations(state).filter((d) => d.badges)).toEqual([{ at: 14, badges: ['line'] }])
  })

  it('drops empty ranges and keeps badges anchored as the student edits', () => {
    let state = EditorState.create({ doc, extensions: [teacherHighlightsField] })
    state = state.update({
      effects: setTeacherHighlights.of([highlight, { id: 'empty', from: 3, to: 3 }]),
    }).state
    state = state.update({ changes: { from: 0, insert: '# hi\n' } }).state
    expect(decorations(state)).toEqual([
      { from: 12, to: 17, class: 'cm-teacherHighlight' },
      { at: 19, badges: ['h1'] },
    ])
  })

  function positions(state) {
    return state.field(teacherHighlightsField).highlights.map((h) => [h.id, h.from, h.to])
  }

  function withHighlight() {
    const state = EditorState.create({ doc, extensions: [teacherHighlightsField] })
    return state.update({ effects: setTeacherHighlights.of([highlight]) }).state
  }

  it('keeps the mapped position when the same highlight is set again with its stored one', () => {
    let state = withHighlight()
    state = state.update({ changes: { from: 0, insert: 'xx' }, userEvent: 'input.type' }).state
    expect(positions(state)).toEqual([['h1', 9, 14]])
    state = state.update({
      effects: setTeacherHighlights.of([{ ...highlight, note: 'Changed' }]),
    }).state
    expect(positions(state)).toEqual([['h1', 9, 14]])
    expect(state.field(teacherHighlightsField).highlights[0].note).toBe('Changed')
  })

  it('adds new highlights at their stored position and removes ones no longer listed', () => {
    let state = withHighlight()
    state = state.update({ effects: setTeacherHighlights.of([{ id: 'h2', from: 0, to: 4 }]) }).state
    expect(positions(state)).toEqual([['h2', 0, 4]])
  })

  it('keeps a highlight when the user types right at either edge of it', () => {
    const start = withHighlight().update({
      changes: { from: 7, insert: 'Z' },
      userEvent: 'input.type',
    }).state
    expect(positions(start)).toEqual([['h1', 8, 13]])
    const end = withHighlight().update({
      changes: { from: 12, insert: 'Z' },
      userEvent: 'input.type',
    }).state
    expect(positions(end)).toEqual([['h1', 7, 12]])
    const bordering = withHighlight().update({
      changes: { from: 6, to: 7 },
      userEvent: 'delete.backward',
    }).state
    expect(positions(bordering)).toEqual([['h1', 6, 11]])
  })

  it('clears a highlight when the user types inside it or deletes part of it', () => {
    const typed = withHighlight().update({
      changes: { from: 9, insert: 'Z' },
      userEvent: 'input.type',
    }).state
    expect(positions(typed)).toEqual([])
    const deleted = withHighlight().update({
      changes: { from: 11, to: 13 },
      userEvent: 'delete.backward',
    }).state
    expect(positions(deleted)).toEqual([])
  })

  it('maps rather than clears a highlight under a change from outside (a live mirror update)', () => {
    const state = withHighlight().update({ changes: { from: 9, insert: 'Z' } }).state
    expect(positions(state)).toEqual([['h1', 7, 13]])
  })
})

describe('minimalReplace', () => {
  it('changes only the span between the shared prefix and suffix', () => {
    expect(minimalReplace('abcXdef', 'abcYYdef')).toEqual({ from: 3, to: 4, insert: 'YY' })
    expect(minimalReplace('aaa', 'aaaa')).toEqual({ from: 3, to: 3, insert: 'a' })
    expect(minimalReplace('', 'x')).toEqual({ from: 0, to: 0, insert: 'x' })
    expect(minimalReplace('same', 'same')).toEqual({ from: 4, to: 4, insert: '' })
  })
})

describe('CodeEditor teacher highlights', () => {
  const code = 'name = input()\nprint("Hello")\n'
  const stored = () => [{ id: 'h1', emoji: '👀', note: null, from: 7, to: 12 }]

  async function renderEditor(props) {
    const { render } = await import('@testing-library/react')
    const utils = render(<CodeEditor value={code} {...props} />)
    const view = EditorView.findFromDOM(utils.container.querySelector('.cm-editor'))
    const positions = () =>
      view.state.field(teacherHighlightsField).highlights.map((h) => [h.id, h.from, h.to])
    return { ...utils, view, positions }
  }

  it('does not reset mapped positions when handed a new array with the same highlights', async () => {
    const { view, rerender, positions } = await renderEditor({ teacherHighlights: stored() })
    view.dispatch({ changes: { from: 0, insert: '# hi\n' }, userEvent: 'input.type' })
    expect(positions()).toEqual([['h1', 12, 17]])
    rerender(<CodeEditor value={view.state.doc.toString()} teacherHighlights={stored()} />)
    expect(positions()).toEqual([['h1', 12, 17]])
  })

  it('clears an edited highlight, reports it dismissed and does not bring it back', async () => {
    const onHighlightDismiss = vi.fn()
    const { view, rerender, positions } = await renderEditor({
      teacherHighlights: stored(),
      onHighlightDismiss,
    })
    view.dispatch({ changes: { from: 9, insert: 'Z' }, userEvent: 'input.type' })
    expect(positions()).toEqual([])
    expect(onHighlightDismiss).toHaveBeenCalledWith('h1')
    // The session still lists h1 until the dismissal lands; a new highlight arriving meanwhile
    // must not resurrect it.
    rerender(
      <CodeEditor
        value={view.state.doc.toString()}
        teacherHighlights={[...stored(), { id: 'h2', from: 0, to: 4 }]}
        onHighlightDismiss={onHighlightDismiss}
      />
    )
    expect(positions()).toEqual([['h2', 0, 4]])
  })

  it('keeps a highlight, without dismissing it, when the student types next to it', async () => {
    const onHighlightDismiss = vi.fn()
    const { view, positions } = await renderEditor({
      teacherHighlights: stored(),
      onHighlightDismiss,
    })
    view.dispatch({ changes: { from: 12, insert: '!' }, userEvent: 'input.type' })
    expect(positions()).toEqual([['h1', 7, 12]])
    expect(onHighlightDismiss).not.toHaveBeenCalled()
  })

  it('keeps highlights on unchanged code when the value is replaced from outside', async () => {
    const onHighlightDismiss = vi.fn()
    const { view, rerender, positions } = await renderEditor({
      teacherHighlights: stored(),
      onHighlightDismiss,
    })
    rerender(
      <CodeEditor
        value={`# hi\n${code}`}
        teacherHighlights={stored()}
        onHighlightDismiss={onHighlightDismiss}
      />
    )
    expect(view.state.doc.toString()).toBe(`# hi\n${code}`)
    expect(positions()).toEqual([['h1', 12, 17]])
    expect(onHighlightDismiss).not.toHaveBeenCalled()
  })
})

describe('isAutocompletePick (✨ Autocomplete Ace)', () => {
  function updateFor(spec) {
    const state = EditorState.create({ doc: 'pri' })
    return { docChanged: true, transactions: [state.update(spec)] }
  }

  it('fires only for an accepted completion', () => {
    const insert = { changes: { from: 0, to: 3, insert: 'print' } }
    expect(isAutocompletePick(updateFor({ ...insert, userEvent: 'input.complete' }))).toBe(true)
    expect(isAutocompletePick(updateFor({ ...insert, userEvent: 'input.type' }))).toBe(false)
    expect(isAutocompletePick(updateFor(insert))).toBe(false)
  })
})

describe('isUserEditUpdate (onUserEdit)', () => {
  // A view update as CodeMirror hands it to an update listener.
  function updateFor(spec) {
    const state = EditorState.create({ doc: 'print(1)' })
    const tr = state.update(spec)
    return { docChanged: tr.docChanged, transactions: [tr] }
  }

  it('fires for typing, deleting, moving text, undo and redo', () => {
    for (const userEvent of [
      'input.type',
      'input.paste',
      'delete.backward',
      'move.drop',
      'undo',
      'redo',
    ]) {
      expect(isUserEditUpdate(updateFor({ changes: { from: 0, insert: 'x' }, userEvent }))).toBe(
        true
      )
    }
  })

  it('does not fire for the external value sync (task switch, carry, sandbox push)', () => {
    expect(isUserEditUpdate(updateFor({ changes: { from: 0, to: 8, insert: 'print(2)' } }))).toBe(
      false
    )
  })

  it('does not fire for a selection change without an edit', () => {
    expect(isUserEditUpdate(updateFor({ selection: { anchor: 2 }, userEvent: 'select' }))).toBe(
      false
    )
  })
})

describe('CodeEditor onUserEdit', () => {
  it('does not fire when the value is replaced from outside', async () => {
    const { render } = await import('@testing-library/react')
    const onUserEdit = vi.fn()
    const onChange = vi.fn()
    const { rerender } = render(
      <CodeEditor value="print(1)" onChange={onChange} onUserEdit={onUserEdit} />
    )
    rerender(<CodeEditor value="print(2)" onChange={onChange} onUserEdit={onUserEdit} />)
    expect(onChange).toHaveBeenCalledWith('print(2)')
    expect(onUserEdit).not.toHaveBeenCalled()
  })
})
