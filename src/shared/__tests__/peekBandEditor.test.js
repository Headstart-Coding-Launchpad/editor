import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { history, undoDepth } from '@codemirror/commands'
import {
  getPeekBandState,
  PEEK_BAND_MISSED_TEXT,
  peekBandExtension,
  peekBandLabel,
  setPeekBand,
} from '../peekBandEditor.js'

// Per docs/TESTING.md the EditorView/DOM is not unit-tested: these drive the peek band's
// StateField through an EditorState. The dashed band's look needs a real browser check.

const DOC = 'coins = 10\ncoins = coins + 5\ncoins = coins * 2\nprint(coins)'

function stateWithBand(doc, band) {
  const state = EditorState.create({ doc, extensions: [history(), peekBandExtension()] })
  return state.update({ effects: setPeekBand.of(band) }).state
}

function insertAt(state, from, insert) {
  return state.update({ changes: { from, insert }, userEvent: 'input' }).state
}

describe('#@peek band StateField', () => {
  it('shows the band it is given, and clears on null', () => {
    const state = stateWithBand(DOC, { line: 3, missed: false })
    expect(getPeekBandState(state)).toEqual({ line: 3, missed: false })
    const cleared = state.update({ effects: setPeekBand.of(null) }).state
    expect(getPeekBandState(cleared)).toBeNull()
  })

  it('keeps the missed state', () => {
    const state = stateWithBand(DOC, { line: 3, missed: true })
    expect(getPeekBandState(state)).toEqual({ line: 3, missed: true })
  })

  it('ignores lines that do not exist', () => {
    expect(getPeekBandState(stateWithBand(DOC, { line: 9, missed: false }))).toBeNull()
    expect(getPeekBandState(stateWithBand(DOC, { line: 0, missed: false }))).toBeNull()
    expect(getPeekBandState(stateWithBand(DOC, { line: 1.5, missed: false }))).toBeNull()
  })

  it('never puts the band into the document or the undo history', () => {
    const state = stateWithBand(DOC, { line: 3, missed: false })
    expect(state.doc.toString()).toBe(DOC)
    expect(undoDepth(state)).toBe(0)
  })

  it('follows its line as the student edits', () => {
    let state = stateWithBand(DOC, { line: 3, missed: false })
    state = insertAt(state, 0, '# my notes\n')
    expect(getPeekBandState(state)).toEqual({ line: 4, missed: false })
    // Enter at the start of the marked line moves the line (and the band) down.
    state = insertAt(state, state.doc.line(4).from, '\n')
    expect(getPeekBandState(state)?.line).toBe(5)
    // Typing on the marked line keeps the band above it.
    state = insertAt(state, state.doc.line(5).to, '  # double')
    expect(getPeekBandState(state)?.line).toBe(5)
  })

  it('goes when its line is deleted', () => {
    let state = stateWithBand(DOC, { line: 3, missed: false })
    const line = state.doc.line(3)
    state = state.update({
      changes: { from: line.from, to: line.to + 1 },
      userEvent: 'delete',
    }).state
    expect(getPeekBandState(state)).toBeNull()
  })

  it('is not installed in an editor without the extension', () => {
    expect(getPeekBandState(EditorState.create({ doc: DOC }))).toBeNull()
  })
})

describe('peekBandLabel', () => {
  it('tells screen readers which line the values are shown before', () => {
    expect(peekBandLabel(6)).toBe('Values shown just before line 6')
    expect(peekBandLabel(6, true)).toBe(`Values shown just before line 6. ${PEEK_BAND_MISSED_TEXT}`)
  })
})
