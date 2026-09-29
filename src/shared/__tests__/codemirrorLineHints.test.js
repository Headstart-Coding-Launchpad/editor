import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { history, undo, undoDepth } from '@codemirror/commands'
import { getLineHints, lineHintsExtension, setLineHints } from '../codemirror.js'
import { chooseLineHints, parseLineHints } from '../lineHints.js'

// Per docs/TESTING.md the EditorView/DOM is not unit-tested: these drive the line-hint
// StateField through an EditorState. The gutter icon and ghost text rendering need a real
// browser check.

function stateWithHints(doc, hints) {
  const state = EditorState.create({ doc, extensions: [history(), lineHintsExtension()] })
  return state.update({ effects: setLineHints.of(hints) }).state
}

function insertAt(state, from, insert) {
  return state.update({ changes: { from, insert }, userEvent: 'input' }).state
}

function deleteRange(state, from, to) {
  return state.update({ changes: { from, to }, userEvent: 'delete' }).state
}

const DOC = 'x = 1\ncolour = "red"\nprint(colour)'

describe('line hints StateField', () => {
  it('shows the hints it is given', () => {
    const state = stateWithHints(DOC, [{ line: 2, text: 'Change the colour' }])
    expect(getLineHints(state)).toEqual([{ line: 2, text: 'Change the colour' }])
  })

  it('joins several hints on one line', () => {
    const state = stateWithHints(DOC, [
      { line: 2, text: 'First' },
      { line: 2, text: 'Second' },
    ])
    expect(getLineHints(state)).toEqual([{ line: 2, text: 'First · Second' }])
  })

  it('ignores hints for lines that do not exist', () => {
    const state = stateWithHints(DOC, [
      { line: 9, text: 'Nowhere' },
      { line: 0, text: 'Nowhere' },
    ])
    expect(getLineHints(state)).toEqual([])
  })

  it('never puts the hint into the document or the undo history', () => {
    const state = stateWithHints(DOC, [{ line: 2, text: 'Change the colour' }])
    expect(state.doc.toString()).toBe(DOC)
    expect(undoDepth(state)).toBe(0)
  })

  it('follows its line when lines are added above it', () => {
    let state = stateWithHints(DOC, [{ line: 2, text: 'Change the colour' }])
    state = insertAt(state, 0, 'import random\n\n')
    expect(getLineHints(state)).toEqual([{ line: 4, text: 'Change the colour' }])
  })

  it('stays on its line while the student edits that line', () => {
    let state = stateWithHints(DOC, [{ line: 2, text: 'Change the colour' }])
    const line = state.doc.line(2)
    state = deleteRange(state, line.from, line.from + 1)
    state = insertAt(state, line.from, 'C')
    state = insertAt(state, state.doc.line(2).to, '  # mine')
    expect(getLineHints(state)).toEqual([{ line: 2, text: 'Change the colour' }])
  })

  it('moves with the line content when Enter is pressed at its start', () => {
    let state = stateWithHints(DOC, [{ line: 2, text: 'Change the colour' }])
    state = insertAt(state, state.doc.line(2).from, '\n')
    expect(getLineHints(state)).toEqual([{ line: 3, text: 'Change the colour' }])
  })

  it('stays put when Enter is pressed at the end of the hinted line', () => {
    let state = stateWithHints(DOC, [{ line: 2, text: 'Change the colour' }])
    state = insertAt(state, state.doc.line(2).to, '\n')
    expect(getLineHints(state)).toEqual([{ line: 2, text: 'Change the colour' }])
  })

  it('stays on an empty hinted line while the student types on it', () => {
    let state = stateWithHints('a\n\nb', [{ line: 2, text: 'Write here' }])
    state = insertAt(state, state.doc.line(2).from, 'print("hi")')
    state = insertAt(state, state.doc.line(2).to, '\n')
    expect(getLineHints(state)).toEqual([{ line: 2, text: 'Write here' }])
  })

  it('disappears when the student deletes the whole line', () => {
    let state = stateWithHints(DOC, [
      { line: 2, text: 'Change the colour' },
      { line: 3, text: 'Print it' },
    ])
    const line = state.doc.line(2)
    state = deleteRange(state, line.from, line.to + 1)
    expect(state.doc.toString()).toBe('x = 1\nprint(colour)')
    expect(getLineHints(state)).toEqual([{ line: 2, text: 'Print it' }])
  })

  it('disappears when the last line is deleted with the line break before it', () => {
    let state = stateWithHints(DOC, [{ line: 3, text: 'Print it' }])
    const line = state.doc.line(3)
    state = deleteRange(state, line.from - 1, line.to)
    expect(getLineHints(state)).toEqual([])
  })

  it('disappears when an empty hinted line is backspaced away', () => {
    let state = stateWithHints('a\n\nb', [{ line: 2, text: 'Write here' }])
    const line = state.doc.line(2)
    state = deleteRange(state, line.from - 1, line.from)
    expect(getLineHints(state)).toEqual([])
  })

  it('stays when the line text is cleared but the line itself is kept', () => {
    let state = stateWithHints(DOC, [{ line: 2, text: 'Change the colour' }])
    const line = state.doc.line(2)
    state = deleteRange(state, line.from, line.to)
    expect(getLineHints(state)).toEqual([{ line: 2, text: 'Change the colour' }])
  })

  it('comes back with the line on undo only through its re-anchoring, not the history', () => {
    let state = stateWithHints(DOC, [{ line: 2, text: 'Change the colour' }])
    const line = state.doc.line(2)
    state = deleteRange(state, line.from, line.to + 1)
    let undone = state
    undo({ state, dispatch: (tr) => (undone = tr.state) })
    expect(undone.doc.toString()).toBe(DOC)
    expect(getLineHints(undone)).toEqual([])
  })

  it('is cleared by setLineHints with [] or null', () => {
    let state = stateWithHints(DOC, [{ line: 2, text: 'Change the colour' }])
    state = state.update({ effects: setLineHints.of([]) }).state
    expect(getLineHints(state)).toEqual([])
    state = stateWithHints(DOC, [{ line: 2, text: 'Change the colour' }])
    state = state.update({ effects: setLineHints.of(null) }).state
    expect(getLineHints(state)).toEqual([])
  })

  it('replaces the hints when the content is swapped out in the same transaction', () => {
    const { code, hints } = parseLineHints('#> Say hello\nprint("hi")', 'python')
    let state = stateWithHints(DOC, [{ line: 2, text: 'Old hint' }])
    state = state.update({
      changes: { from: 0, to: state.doc.length, insert: code },
      effects: setLineHints.of(chooseLineHints(code, [hints])),
    }).state
    expect(getLineHints(state)).toEqual([{ line: 1, text: 'Say hello' }])
  })

  it('re-anchors onto saved code whose lines have moved', () => {
    const { hints } = parseLineHints('x = 1\n#> Change the colour\ncolour = "red"', 'python')
    const saved = 'import random\nx = 1\nprint("hi")\ncolour = "red"'
    const state = stateWithHints(saved, chooseLineHints(saved, [hints]))
    expect(getLineHints(state)).toEqual([{ line: 4, text: 'Change the colour' }])
  })
})
