// #@lock-values (P6-22): a locked line whose values (string contents, numbers) stay editable.
import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import {
  anchorLocks,
  chooseLockedLines,
  isLockMarkerLine,
  isLockValuesMarkerLine,
  lineValueSpans,
  scanLineValues,
  valueSkeleton,
} from '../lockedLines.js'
import { parseLineHints } from '../lineHints.js'
import { validateLockedLines } from '../puzzle/puzzle.js'
import {
  getLockedLineNumbers,
  isFullyLockedPos,
  isLockedPos,
  lockedLinesExtension,
  lockedValueSpansAt,
  setLockedLineSets,
  valuesChangeAllowed,
} from '../lockedLinesEditor.js'

describe('scanLineValues', () => {
  it('finds plain string contents and numbers, and blanks them in the skeleton', () => {
    expect(lineValueSpans('hero = "Zara"')).toEqual([{ from: 8, to: 12, kind: 'string' }])
    expect(lineValueSpans('name = ""')).toEqual([{ from: 8, to: 8, kind: 'string' }])
    expect(lineValueSpans('size = 24.5')).toEqual([{ from: 7, to: 11, kind: 'number' }])
    expect(valueSkeleton('  hero = "Zara"  ')).toBe(valueSkeleton('hero = "Bob"'))
    expect(valueSkeleton('x = 10')).toBe(valueSkeleton('x = 2000'))
    expect(valueSkeleton('x = 10')).not.toBe(valueSkeleton('y = 10'))
  })

  it('leaves names, f-strings, attributes and comments alone', () => {
    const { spans } = scanLineValues('x2 = f"{a}" + y.z  # 5 "c"')
    expect(spans).toEqual([])
    expect(lineValueSpans('s = "a\\"b"')).toEqual([{ from: 5, to: 9, kind: 'string' }])
  })
})

describe('#@lock-values markers', () => {
  it('is its own marker, not #@lock', () => {
    expect(isLockValuesMarkerLine('#@lock-values', 'python')).toBe(true)
    expect(isLockMarkerLine('#@lock-values', 'python')).toBe(false)
    expect(isLockValuesMarkerLine('#@lock-values', 'html')).toBe(false)
  })

  it('parses into a values lock whose target is the skeleton', () => {
    const parsed = parseLineHints('#@lock-values\nhero = "Zara"\n#@lock\nx = 1', 'python')
    expect(parsed.code).toBe('hero = "Zara"\nx = 1')
    expect(parsed.locks).toEqual([
      { line: 1, target: valueSkeleton('hero = "Zara"'), values: true },
      { line: 2, target: 'x = 1' },
    ])
  })

  it('anchors on the line whatever its values hold now', () => {
    const lock = { line: 1, target: valueSkeleton('hero = "Zara"'), values: true }
    expect(anchorLocks('hero = "Ada Lovelace"', [lock])).toEqual([{ line: 1, values: true }])
    expect(chooseLockedLines('hiro = "Ada"', [[lock]])).toEqual([])
  })

  it('warns when a values line has nothing to change', () => {
    const warnings = []
    validateLockedLines({ starterCode: '#@lock-values\nprint(hero)' }, 3, warnings)
    expect(warnings).toContain(
      'Task 3 has a #@lock-values line 1 with no string or number to change — it is fully locked'
    )
  })
})

describe('values-locked lines in the editor', () => {
  const DOC = 'a = 1\nhero = "Zara"\nc = 3'
  // Line 2: 6..19; "Zara" is 14..18.
  const SETS = [[{ line: 2, target: valueSkeleton('hero = "Zara"'), values: true }]]

  function state(doc = DOC) {
    const created = EditorState.create({ doc, extensions: [lockedLinesExtension()] })
    return created.update({ effects: setLockedLineSets.of(SETS) }).state
  }
  const edit = (s, changes) => s.update({ changes, userEvent: 'input.type' }).state

  it('is locked, but not fully, and knows its values', () => {
    const s = state()
    expect(getLockedLineNumbers(s)).toEqual([2])
    expect(isLockedPos(s, 8)).toBe(true)
    expect(isFullyLockedPos(s, 8)).toBe(false)
    expect(lockedValueSpansAt(s, 8)).toEqual([{ from: 14, to: 18, kind: 'string' }])
  })

  it('lets the student change the value, and nothing else', () => {
    const typed = edit(state(), { from: 14, to: 18, insert: 'Ada' })
    expect(typed.doc.line(2).text).toBe('hero = "Ada"')
    expect(getLockedLineNumbers(typed)).toEqual([2])
    // The name, the quote marks and the rest are blocked.
    expect(edit(state(), { from: 6, to: 10, insert: 'hiro' }).doc.toString()).toBe(DOC)
    expect(edit(state(), { from: 18, to: 19, insert: '' }).doc.toString()).toBe(DOC)
    expect(edit(state(), { from: 16, insert: '"' }).doc.toString()).toBe(DOC)
  })

  it('keeps an emptied string editable', () => {
    const emptied = edit(state(), { from: 14, to: 18, insert: '' })
    expect(emptied.doc.line(2).text).toBe('hero = ""')
    const refilled = edit(emptied, { from: 14, insert: 'Mo' })
    expect(refilled.doc.line(2).text).toBe('hero = "Mo"')
  })

  it('checks a change against the value skeleton', () => {
    const doc = state().doc
    const range = { from: 6, to: 19 }
    expect(valuesChangeAllowed(doc, range, { from: 18, to: 18, insert: 'h' })).toBe(true)
    expect(valuesChangeAllowed(doc, range, { from: 18, to: 18, insert: '\n' })).toBe(false)
    expect(valuesChangeAllowed(doc, range, { from: 5, to: 6, insert: '' })).toBe(false)
  })

  it('lets a whole True or False flip, but not be typed over or renamed', () => {
    const doc = EditorState.create({ doc: 'tall = True\nb = False' }).doc
    const line1 = { from: 0, to: 11 }
    expect(valuesChangeAllowed(doc, line1, { from: 7, to: 11, insert: 'False' })).toBe(true)
    expect(valuesChangeAllowed(doc, line1, { from: 7, to: 11, insert: 'Fals' })).toBe(false)
    expect(valuesChangeAllowed(doc, line1, { from: 7, to: 8, insert: 'F' })).toBe(false)
    expect(valuesChangeAllowed(doc, line1, { from: 7, to: 11, insert: 'Yes' })).toBe(false)
    const line2 = { from: 12, to: 21 }
    expect(valuesChangeAllowed(doc, line2, { from: 16, to: 21, insert: 'True' })).toBe(true)
  })
})
