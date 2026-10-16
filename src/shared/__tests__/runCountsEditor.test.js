import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { history, undoDepth } from '@codemirror/commands'
import {
  getRunCountsState,
  runCountResultText,
  runCountWidgetKind,
  runCountsExtension,
  setRunCountWidgets,
} from '../runCountsEditor.js'

// Per docs/TESTING.md the EditorView/DOM is not unit-tested: these drive the run-count widgets'
// StateField through an EditorState. The boxes' look, focus while typing and the 44 px touch
// size need a real browser check.

const DOC = 'for i in range(3):\n    print("Hip")\nprint("Hooray")'

const mark = (line, extra = {}) => ({
  key: `L${line}`,
  line,
  value: '',
  count: null,
  correct: null,
  editable: true,
  ...extra,
})

function stateWith(doc, widgets) {
  const state = EditorState.create({ doc, extensions: [history(), runCountsExtension()] })
  return state.update({ effects: setRunCountWidgets.of(widgets) }).state
}

describe('run-count widgets StateField (P6-26)', () => {
  it('holds the widgets it is given, and clears on null', () => {
    const state = stateWith(DOC, { mode: 'predict', readOnly: false, marks: [mark(2), mark(3)] })
    expect(getRunCountsState(state)).toEqual({
      mode: 'predict',
      readOnly: false,
      marks: [mark(2), mark(3)],
    })
    expect(
      getRunCountsState(state.update({ effects: setRunCountWidgets.of(null) }).state)
    ).toBeNull()
  })

  it('ignores lines that do not exist', () => {
    const state = stateWith(DOC, { mode: 'show', marks: [mark(9), mark(0), mark(1.5), mark(2)] })
    expect(getRunCountsState(state).marks.map((m) => m.line)).toEqual([2])
  })

  it('never puts the boxes into the document or the undo history', () => {
    const state = stateWith(DOC, { mode: 'predict', marks: [mark(2)] })
    expect(state.doc.toString()).toBe(DOC)
    expect(undoDepth(state)).toBe(0)
  })

  it('follows its line as the student edits, and goes when the line is deleted', () => {
    let state = stateWith(DOC, { mode: 'predict', marks: [mark(2), mark(3)] })
    state = state.update({ changes: { from: 0, insert: '# notes\n' }, userEvent: 'input' }).state
    expect(getRunCountsState(state).marks.map((m) => m.line)).toEqual([3, 4])
    const line = state.doc.line(4)
    state = state.update({
      changes: { from: line.from - 1, to: line.to },
      userEvent: 'delete',
    }).state
    expect(getRunCountsState(state).marks.map((m) => m.key)).toEqual(['L2'])
  })

  it('is not installed in an editor without the extension', () => {
    expect(getRunCountsState(EditorState.create({ doc: DOC }))).toBeNull()
  })
})

describe('what a marked line shows', () => {
  it('a box before the first Run, the count after, in words and a symbol', () => {
    expect(runCountWidgetKind(mark(2), 'predict', false)).toBe('input')
    expect(runCountWidgetKind(mark(2, { count: 3 }), 'predict', false)).toBe('result')
    // A tutor's or Go Live view: the prediction, or "no prediction yet".
    expect(runCountWidgetKind(mark(2, { value: '3', editable: false }), 'predict', true)).toBe(
      'said'
    )
    expect(runCountWidgetKind(mark(2, { editable: false }), 'predict', true)).toBe('said')
    // After the first Run, between runs: nothing until the next count.
    expect(runCountWidgetKind(mark(2, { editable: false }), 'predict', false)).toBeNull()
    // Show mode: nothing before a Run.
    expect(runCountWidgetKind(mark(2, { editable: false }), 'show', false)).toBeNull()
    expect(runCountWidgetKind(mark(2, { count: 0 }), 'show', false)).toBe('result')
  })

  it('reads "ran 3 times ✓", "ran 1 time ✗ · you said 3" and "ran 0 times"', () => {
    expect(runCountResultText(mark(2, { count: 3, value: '3', correct: true }), 'predict')).toBe(
      'ran 3 times ✓'
    )
    expect(runCountResultText(mark(3, { count: 1, value: '3', correct: false }), 'predict')).toBe(
      'ran 1 time ✗ · you said 3'
    )
    expect(runCountResultText(mark(3, { count: 0 }), 'show')).toBe('ran 0 times')
    expect(runCountResultText(mark(3, { count: 2, value: '' }), 'predict')).toBe('ran 2 times')
  })
})
