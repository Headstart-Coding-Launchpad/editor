import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { errorLineField, setErrorLine } from '../CodeEditor'

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
