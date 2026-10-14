// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  getTaskPeekLine,
  isPeekMarkerLine,
  parseLineHints,
  stripTaskLineHints,
} from '../lineHints.js'

describe('#@peek marker', () => {
  it('is a Python-only marker line', () => {
    expect(isPeekMarkerLine('#@peek', 'python')).toBe(true)
    expect(isPeekMarkerLine('    #@peek  ', 'python')).toBe(true)
    expect(isPeekMarkerLine('#@peek here please', 'python')).toBe(true)
    expect(isPeekMarkerLine('#@peeking', 'python')).toBe(false)
    expect(isPeekMarkerLine('x = 1  #@peek', 'python')).toBe(false)
    expect(isPeekMarkerLine('#@peek', 'html')).toBe(false)
  })

  it('is stripped and stops at the next line of code, skipping blanks and comments', () => {
    const code = 'name = input()\n#@peek\n\n# make it loud\nshout = name.upper()\nprint(shout)\n'
    const result = parseLineHints(code, 'python')
    expect(result.code).toBe(
      'name = input()\n\n# make it loud\nshout = name.upper()\nprint(shout)\n'
    )
    expect(result.peek).toEqual({ line: 4, target: 'shout = name.upper()' })
    expect(result.hints).toEqual([])
  })

  it('keeps hint line numbers right when both markers are present', () => {
    const code = '#@peek\nx = 1\n#> Change this\ny = 2'
    const result = parseLineHints(code, 'python')
    expect(result.code).toBe('x = 1\ny = 2')
    expect(result.peek).toEqual({ line: 1, target: 'x = 1' })
    expect(result.hints).toEqual([{ line: 2, text: 'Change this', target: 'y = 2' }])
  })

  it('only counts the first peek, and a peek with no code after it stops nowhere', () => {
    expect(parseLineHints('#@peek\na = 1\n#@peek\nb = 2', 'python').peek).toEqual({
      line: 1,
      target: 'a = 1',
    })
    const trailing = parseLineHints('a = 1\n#@peek\n', 'python')
    expect(trailing.code).toBe('a = 1\n')
    expect(trailing.peek).toBeNull()
  })

  it('records peekSets on a stripped task and re-anchors on edited code', () => {
    const task = {
      id: 3,
      codeStages: [{ role: 'starter', code: 'a = 5\n#@peek\nb = a + 1\nprint(b)' }],
    }
    const stripped = stripTaskLineHints(task, 'python')
    expect(stripped.codeStages[0].code).toBe('a = 5\nb = a + 1\nprint(b)')
    expect(stripped.peekSets).toEqual([
      { source: 'starter', stageIndex: 0, file: null, peek: { line: 2, target: 'b = a + 1' } },
    ])
    expect(getTaskPeekLine(stripped, 'a = 5\nb = a + 1\nprint(b)')).toBe(2)
    // The student added lines above: the peek follows its line.
    expect(getTaskPeekLine(stripped, '# mine\na = 5\nc = 2\n  b = a + 1\nprint(b)')).toBe(4)
    // Deleted or duplicated: no peek.
    expect(getTaskPeekLine(stripped, 'a = 5\nprint(a)')).toBeNull()
    expect(getTaskPeekLine(stripped, 'b = a + 1\nx = 1\nb = a + 1')).toBeNull()
    expect(getTaskPeekLine({ id: 1 }, 'x = 1')).toBeNull()
  })

  it('leaves a task without markers untouched', () => {
    const task = { id: 1, starterCode: 'x = 1' }
    expect(stripTaskLineHints(task, 'python')).toBe(task)
  })
})
