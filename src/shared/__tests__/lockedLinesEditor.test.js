import { describe, expect, it } from 'vitest'
import { EditorState, Text } from '@codemirror/state'
import {
  changeBreaksLock,
  filterLockedChange,
  getLockedLineNumbers,
  isLockedPos,
  lockedLinesExtension,
  setLockedLineSets,
} from '../lockedLinesEditor.js'

// Per docs/TESTING.md the EditorView/DOM is not unit-tested: these drive the locked-lines
// StateField and transaction filters through an EditorState. The 🔒 tag, the note tooltip,
// Enter on a locked line (a keymap command) and the touch keyboard need a real browser check.

const DOC = 'a = 1\nb = 2\nc = 3'
// Line 1: 0..5, line 2: 6..11, line 3: 12..17.
const LOCK_B = [[{ line: 2, target: 'b = 2' }]]

function lockedState(doc = DOC, sets = LOCK_B) {
  const state = EditorState.create({ doc, extensions: [lockedLinesExtension()] })
  return state.update({ effects: setLockedLineSets.of(sets) }).state
}

const edit = (state, changes, userEvent = 'input.type') =>
  state.update({ changes, userEvent }).state

describe('locked lines StateField', () => {
  it('locks the lines its set anchors on', () => {
    const state = lockedState()
    expect(getLockedLineNumbers(state)).toEqual([2])
    expect(isLockedPos(state, 8)).toBe(true)
    expect(isLockedPos(state, 2)).toBe(false)
  })

  it('picks the set that anchors best', () => {
    const state = lockedState(DOC, [
      [{ line: 1, target: 'nope' }],
      [
        { line: 1, target: 'a = 1' },
        { line: 3, target: 'c = 3' },
      ],
    ])
    expect(getLockedLineNumbers(state)).toEqual([1, 3])
  })

  it('clears the locks with an empty set list', () => {
    const state = lockedState().update({ effects: setLockedLineSets.of([]) }).state
    expect(getLockedLineNumbers(state)).toEqual([])
  })

  it('re-anchors by text after a change from outside (a value sync, Reset)', () => {
    const state = lockedState().update({ changes: { from: 0, insert: '# hi\n' } }).state
    expect(state.doc.toString()).toBe('# hi\na = 1\nb = 2\nc = 3')
    expect(getLockedLineNumbers(state)).toEqual([3])
  })

  it('drops a lock whose line an outside change removed', () => {
    const state = lockedState().update({ changes: { from: 0, to: DOC.length, insert: 'x' } }).state
    expect(getLockedLineNumbers(state)).toEqual([])
  })

  it('moves a lock with its line when the student adds lines above it', () => {
    const state = edit(lockedState(), { from: 5, insert: '\nnew = 0' }, 'input')
    expect(state.doc.toString()).toBe('a = 1\nnew = 0\nb = 2\nc = 3')
    expect(getLockedLineNumbers(state)).toEqual([3])
  })

  it('keeps the lock on its own line when the student types an identical line above', () => {
    const state = edit(lockedState(), { from: 5, insert: '\nb = 2' }, 'input')
    expect(getLockedLineNumbers(state)).toEqual([3])
  })
})

describe('locked lines edit guard', () => {
  it('blocks typing inside a locked line', () => {
    const state = edit(lockedState(), { from: 8, insert: 'x' })
    expect(state.doc.toString()).toBe(DOC)
  })

  it('blocks typing at the start or end of a locked line', () => {
    expect(edit(lockedState(), { from: 6, insert: 'x' }).doc.toString()).toBe(DOC)
    expect(edit(lockedState(), { from: 11, insert: 'x' }).doc.toString()).toBe(DOC)
  })

  it('blocks deleting or cutting part of a locked line', () => {
    expect(edit(lockedState(), { from: 7, to: 9 }, 'delete.selection').doc.toString()).toBe(DOC)
    expect(edit(lockedState(), { from: 6, to: 11 }, 'delete.cut').doc.toString()).toBe(DOC)
  })

  it('blocks re-indenting a locked line', () => {
    const state = edit(lockedState(), { from: 6, insert: '    ' }, 'input.indent')
    expect(state.doc.toString()).toBe(DOC)
  })

  it('lets Enter at the end of a locked line add a new unlocked line below it', () => {
    const state = edit(lockedState(), { from: 11, insert: '\n' }, 'input')
    expect(state.doc.toString()).toBe('a = 1\nb = 2\n\nc = 3')
    expect(getLockedLineNumbers(state)).toEqual([2])
  })

  it('lets a new line be added above a locked line', () => {
    const state = edit(lockedState(), { from: 6, insert: '\n' }, 'input')
    expect(state.doc.toString()).toBe('a = 1\n\nb = 2\nc = 3')
    expect(getLockedLineNumbers(state)).toEqual([3])
  })

  it('stops Backspace at the start of the next line merging it into a locked line', () => {
    const state = edit(lockedState(), { from: 11, to: 12 }, 'delete.backward')
    expect(state.doc.toString()).toBe(DOC)
  })

  it('stops Backspace at the start of a locked line merging it into the line above', () => {
    const state = edit(lockedState(), { from: 5, to: 6 }, 'delete.backward')
    expect(state.doc.toString()).toBe(DOC)
  })

  it('lets an empty line next to a locked line be deleted', () => {
    const start = edit(lockedState(), { from: 11, insert: '\n' }, 'input')
    const state = edit(start, { from: 11, to: 12 }, 'delete.backward')
    expect(state.doc.toString()).toBe(DOC)
    expect(getLockedLineNumbers(state)).toEqual([2])
  })

  it('keeps locked lines through select-all + delete', () => {
    const state = edit(lockedState(), { from: 0, to: DOC.length }, 'delete.selection')
    expect(state.doc.toString()).toBe('\nb = 2')
    expect(getLockedLineNumbers(state)).toEqual([2])
  })

  it('keeps a locked first line through select-all + delete', () => {
    const state = edit(
      lockedState('x = 1\ny = 2', [[{ line: 1, target: 'x = 1' }]]),
      { from: 0, to: 11 },
      'delete.selection'
    )
    expect(state.doc.toString()).toBe('x = 1')
  })

  it('cuts a paste over a selection spanning a locked line around it', () => {
    const state = edit(lockedState(), { from: 4, to: 14, insert: 'X' }, 'input.paste')
    expect(state.doc.toString()).toBe('a = X\nb = 2\nc = 3')
    expect(getLockedLineNumbers(state)).toEqual([2])
  })

  it('guards a locked first line', () => {
    const start = lockedState('x = 1\ny', [[{ line: 1, target: 'x = 1' }]])
    expect(edit(start, { from: 0, insert: 'z' }).doc.toString()).toBe('x = 1\ny')
    expect(edit(start, { from: 0, insert: '\n' }, 'input').doc.toString()).toBe('\nx = 1\ny')
  })

  it('lets edits elsewhere through untouched', () => {
    const state = edit(lockedState(), { from: 16, to: 17, insert: '4' })
    expect(state.doc.toString()).toBe('a = 1\nb = 2\nc = 4')
  })

  it('never guards a change from outside (task switch, Reset, a teacher edit)', () => {
    const state = lockedState().update({ changes: { from: 8, insert: 'x' } }).state
    expect(state.doc.toString()).toBe('a = 1\nbx = 2\nc = 3')
  })

  it('does nothing without locks', () => {
    const state = EditorState.create({ doc: DOC, extensions: [lockedLinesExtension()] })
    expect(edit(state, { from: 8, insert: 'x' }).doc.toString()).toBe('a = 1\nbx = 2\nc = 3')
  })
})

describe('locked lines cursor', () => {
  const move = (state, anchor, userEvent = 'select') =>
    state.update({ selection: { anchor }, userEvent }).state.selection.main.head

  it('skips a locked line going down, keeping the column', () => {
    const start = lockedState().update({ selection: { anchor: 2 } }).state
    expect(move(start, 8)).toBe(14)
  })

  it('skips a locked line going up, keeping the column', () => {
    const start = lockedState().update({ selection: { anchor: 14 } }).state
    expect(move(start, 8)).toBe(2)
  })

  it('stops at the end of a locked last line when there is nothing below', () => {
    const start = lockedState('a = 1\nb = 2', LOCK_B).update({ selection: { anchor: 2 } }).state
    expect(move(start, 8)).toBe(11)
  })

  it('moves along a locked line to its end going right, its start going left', () => {
    const atStart = lockedState().update({ selection: { anchor: 6 } }).state
    expect(move(atStart, 7)).toBe(11)
    const atEnd = lockedState().update({ selection: { anchor: 11 } }).state
    expect(move(atEnd, 10)).toBe(6)
  })

  it('leaves a click or tap on a locked line where it lands', () => {
    const start = lockedState().update({ selection: { anchor: 2 } }).state
    expect(move(start, 8, 'select.pointer')).toBe(8)
  })
})

describe('changeBreaksLock / filterLockedChange', () => {
  const doc = Text.of(['a = 1', 'b = 2', 'c = 3'])
  const range = { from: 6, to: 11 }

  it('allows changes that leave the line whole', () => {
    expect(changeBreaksLock(doc, range, { from: 0, to: 5, insert: 'z' })).toBe(false)
    expect(changeBreaksLock(doc, range, { from: 11, to: 11, insert: '\nx' })).toBe(false)
    expect(changeBreaksLock(doc, range, { from: 6, to: 6, insert: 'x\n' })).toBe(false)
    expect(changeBreaksLock(doc, range, { from: 0, to: 6, insert: '' })).toBe(false)
  })

  it('flags changes that alter the line or join another onto it', () => {
    expect(changeBreaksLock(doc, range, { from: 8, to: 8, insert: 'x' })).toBe(true)
    expect(changeBreaksLock(doc, range, { from: 7, to: 9, insert: '' })).toBe(true)
    expect(changeBreaksLock(doc, range, { from: 11, to: 13, insert: '' })).toBe(true)
    expect(changeBreaksLock(doc, range, { from: 3, to: 6, insert: '' })).toBe(true)
  })

  it('cuts a deletion around the locked line and the break before it', () => {
    expect(filterLockedChange(doc, [range], { from: 0, to: 17, insert: '' })).toEqual({
      kept: [
        { from: 0, to: 5, insert: '' },
        { from: 11, to: 17, insert: '' },
      ],
      blocked: true,
      at: 6,
    })
  })

  it('keeps a harmless change as it is', () => {
    expect(filterLockedChange(doc, [range], { from: 12, to: 13, insert: 'C' })).toEqual({
      kept: [{ from: 12, to: 13, insert: 'C' }],
      blocked: false,
      at: null,
    })
  })
})
