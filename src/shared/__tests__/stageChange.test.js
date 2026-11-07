import { describe, expect, it } from 'vitest'
import {
  CHANGE_LIMITS,
  chooseChangeBase,
  cleanCodeLines,
  computeStageChange,
  copyAnchorRows,
  stageShowsChange,
} from '../stageChange.js'

// Platform request 134 (Plans/Stage diff view - plan.md, section 6): the change view a Complete
// stage can show instead of the whole program.
const lines = (...rows) => rows.join('\n')

describe('cleanCodeLines', () => {
  it('drops #@lock, #@slot and #> marker lines and trims trailing whitespace', () => {
    const code = lines(
      '#@lock',
      'x = 1   ',
      '#@slot 2',
      '#> Change me',
      'print(x)\t',
      '#@lock-values'
    )
    expect(cleanCodeLines(code)).toEqual(['x = 1', 'print(x)'])
  })

  it('reads Windows line endings', () => {
    expect(cleanCodeLines('a = 1\r\nb = 2\r\n')).toEqual(['a = 1', 'b = 2', ''])
  })
})

describe('computeStageChange', () => {
  it('1. pure add: one anchor line and the green line', () => {
    const base = lines('size = 100', 'step = 5', 'size -= step')
    const target = lines('size = 100', 'step = 5', 'size -= step', 'turn += 10')
    const change = computeStageChange(base, target)
    expect(change.kind).toBe('changes')
    expect(change.hunks).toEqual([
      {
        anchor: { lines: ['size -= step'], position: 'after' },
        rows: [{ type: 'add', text: 'turn += 10' }],
        indent: null,
      },
    ])
  })

  it('2. one-line swap: one red and one green line, anchored by the line before', () => {
    const base = lines('from turtle import *', 'for i in range(5):', '    forward(50)')
    const target = lines('from turtle import *', 'for i in range(3):', '    forward(50)')
    const change = computeStageChange(base, target)
    expect(change.kind).toBe('changes')
    expect(change.hunks).toHaveLength(1)
    expect(change.hunks[0].anchor).toEqual({ lines: ['from turtle import *'], position: 'after' })
    expect(change.hunks[0].rows).toEqual([
      { type: 'remove', text: 'for i in range(5):' },
      { type: 'add', text: 'for i in range(3):' },
    ])
  })

  it('2b. a swap on line 1 has no anchor and does not fall back', () => {
    const change = computeStageChange(lines('x = 5', 'print(x)'), lines('x = 3', 'print(x)'))
    expect(change.kind).toBe('changes')
    expect(change.hunks[0].anchor).toBeNull()
    expect(change.hunks[0].rows.map((row) => row.type)).toEqual(['remove', 'add'])
  })

  it('3. insert in the middle: an anchor above, the green lines, nothing else', () => {
    const base = lines('a = 1', 'b = 2', 'c = 3', 'd = 4')
    const target = lines('a = 1', 'b = 2', 'x = 9', 'y = 8', 'c = 3', 'd = 4')
    const change = computeStageChange(base, target)
    expect(change.hunks).toEqual([
      {
        anchor: { lines: ['b = 2'], position: 'after' },
        rows: [
          { type: 'add', text: 'x = 9' },
          { type: 'add', text: 'y = 8' },
        ],
        indent: null,
      },
    ])
  })

  it('an add at the very top is anchored by the line after it ("before this line")', () => {
    const change = computeStageChange(
      lines('forward(50)', 'done()'),
      lines('speed(0)', 'forward(50)', 'done()')
    )
    expect(change.hunks[0].anchor).toEqual({ lines: ['forward(50)'], position: 'before' })
  })

  it('new lines keep their indentation', () => {
    const change = computeStageChange(
      lines('for i in range(3):', '    forward(50)', 'done()'),
      lines('for i in range(3):', '    forward(50)', '    right(120)', 'done()')
    )
    expect(change.hunks[0].rows).toEqual([{ type: 'add', text: '    right(120)' }])
  })

  it('4. indent-only: one note with the count and no red or green', () => {
    const base = lines('x = 1', 'forward(100)', 'right(90)', 'print(x)', 'y = 2', 'z = 3')
    const target = lines(
      'x = 1',
      '    forward(100)',
      '    right(90)',
      '    print(x)',
      'y = 2',
      'z = 3'
    )
    const change = computeStageChange(base, target)
    expect(change.kind).toBe('changes')
    expect(change.hunks).toEqual([
      {
        anchor: null,
        rows: [],
        indent: {
          lines: ['    forward(100)', '    right(90)', '    print(x)'],
          direction: 'in',
          spaces: 4,
        },
      },
    ])
  })

  it('4b. mixed indent and add: the anchor, the new line in green and the indent note', () => {
    const base = lines(
      'from turtle import *',
      'forward(100)',
      'right(90)',
      'print(1)',
      'done()',
      'a = 1',
      'b = 2',
      'c = 3'
    )
    const target = lines(
      'from turtle import *',
      'for i in range(4):',
      '    forward(100)',
      '    right(90)',
      '    print(1)',
      'done()',
      'a = 1',
      'b = 2',
      'c = 3'
    )
    const change = computeStageChange(base, target)
    expect(change.kind).toBe('changes')
    expect(change.hunks).toHaveLength(1)
    expect(change.hunks[0].anchor).toEqual({ lines: ['from turtle import *'], position: 'after' })
    expect(change.hunks[0].rows).toEqual([{ type: 'add', text: 'for i in range(4):' }])
    expect(change.hunks[0].indent).toEqual({
      lines: ['    forward(100)', '    right(90)', '    print(1)'],
      direction: 'in',
      spaces: 4,
    })
  })

  it('5. #@lock, #@slot and #> lines never show as changes', () => {
    const base = lines('#@lock', 'x = 1', '#> Add a line under this one', 'y = 2')
    const target = lines('x = 1', '#@slot', 'z = 3', 'y = 2')
    const change = computeStageChange(base, target)
    expect(change.hunks).toEqual([
      {
        anchor: { lines: ['x = 1'], position: 'after' },
        rows: [{ type: 'add', text: 'z = 3' }],
        indent: null,
      },
    ])
    const allText = JSON.stringify(change)
    expect(allText).not.toMatch(/#@|#>/)
  })

  it('5b. the anchor is always text, never a line number', () => {
    const change = computeStageChange(lines('a = 1', 'b = 2'), lines('a = 1', 'c = 3', 'b = 2'))
    expect(change.hunks[0].anchor.lines.every((line) => typeof line === 'string')).toBe(true)
    expect(change.hunks[0]).not.toHaveProperty('line')
  })

  it('6a. falls back when the change is more than half of the Complete', () => {
    const change = computeStageChange(lines('a = 1'), lines('a = 1', 'b = 2', 'c = 3'))
    expect(change.kind).toBe('fallback')
    expect(change.reason).toBe('most')
  })

  it('6b. falls back on more than 3 separate changes', () => {
    const base = lines('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l')
    const target = lines(
      'a',
      'A1',
      'b',
      'c',
      'd',
      'B1',
      'e',
      'f',
      'g',
      'C1',
      'h',
      'i',
      'D1',
      'j',
      'k',
      'l'
    )
    const change = computeStageChange(base, target)
    expect(change.kind).toBe('fallback')
    expect(change.reason).toBe('many')
  })

  it('6c. falls back on an added block over 8 lines', () => {
    const before = Array.from({ length: 20 }, (_, i) => `keep${i} = ${i}`)
    const added = Array.from(
      { length: CHANGE_LIMITS.maxAddedBlock + 1 },
      (_, i) => `new${i} = ${i}`
    )
    const change = computeStageChange(
      lines(...before),
      lines(...before.slice(0, 10), ...added, ...before.slice(10))
    )
    expect(change.kind).toBe('fallback')
    expect(change.reason).toBe('big-add')
  })

  it('6d. the fall-back keeps every line, marked', () => {
    const change = computeStageChange(
      lines('from turtle import *', 'right(90)', 'done()'),
      lines(
        'from turtle import *',
        'speed(0)',
        'for i in range(36):',
        '    forward(100)',
        '    right(10)',
        'done()'
      )
    )
    expect(change.kind).toBe('fallback')
    expect(change.fullRows).toEqual([
      { type: 'same', text: 'from turtle import *' },
      { type: 'remove', text: 'right(90)' },
      { type: 'add', text: 'speed(0)' },
      { type: 'add', text: 'for i in range(36):' },
      { type: 'add', text: '    forward(100)' },
      { type: 'add', text: '    right(10)' },
      { type: 'same', text: 'done()' },
    ])
  })

  it('7a. two identical lines: the anchor names the right one', () => {
    const base = lines('print("hi")', 'x = 1', 'print("hi")')
    const target = lines('print("hi")', 'x = 1', 'print("hi")', 'y = 2')
    const change = computeStageChange(base, target)
    // "after print("hi")" alone would be ambiguous: the line above it makes it the second one.
    expect(change.hunks[0].anchor).toEqual({ lines: ['x = 1', 'print("hi")'], position: 'after' })
    expect(change.hunks[0].rows).toEqual([{ type: 'add', text: 'y = 2' }])
  })

  it('7a. a repeated line uses the unique line after it when that is clearer', () => {
    const base = lines('print("hi")', 'print("hi")', 'done()')
    const target = lines('print("hi")', 'print("hi")', 'x = 1', 'done()')
    // Before-line repeated (and its pair is repeated in a 2-line run? no: unique pair), but the
    // line after is unique, so the single line wins over a two-line anchor.
    expect(computeStageChange(base, target).hunks[0].anchor).toEqual({
      lines: ['done()'],
      position: 'before',
    })
  })

  it('7b. a moved line shows as red and green', () => {
    const base = lines('speed(0)', 'a = 1', 'b = 2', 'c = 3', 'd = 4', 'e = 5')
    const target = lines('a = 1', 'b = 2', 'c = 3', 'd = 4', 'e = 5', 'speed(0)')
    const change = computeStageChange(base, target)
    expect(change.kind).toBe('changes')
    const rows = change.hunks.flatMap((hunk) => hunk.rows)
    expect(rows).toEqual([
      { type: 'remove', text: 'speed(0)' },
      { type: 'add', text: 'speed(0)' },
    ])
    expect(change.hunks[1].anchor).toEqual({ lines: ['e = 5'], position: 'after' })
  })

  it('8a. an empty base falls back to the full code, all new', () => {
    const change = computeStageChange('', lines('print("hi")'))
    expect(change.kind).toBe('fallback')
    expect(change.fullRows).toEqual([{ type: 'add', text: 'print("hi")' }])
  })

  it('8b. a comment-only base anchors on the comment', () => {
    const change = computeStageChange(
      lines('# Draw a circle under this line', 'x = 0', 'y = 0'),
      lines('# Draw a circle under this line', 'circle(x, y, 50)', 'x = 0', 'y = 0')
    )
    expect(change.hunks[0].anchor).toEqual({
      lines: ['# Draw a circle under this line'],
      position: 'after',
    })
  })

  it('8c. blank-line-only differences are ignored', () => {
    const change = computeStageChange(
      lines('a = 1', '', '', 'b = 2  '),
      lines('a = 1', 'b = 2', '')
    )
    expect(change.kind).toBe('same')
    expect(change.hunks).toEqual([])
  })

  it('8d. tabs and spaces of the same width are the same indent', () => {
    const change = computeStageChange(
      lines('for i in range(3):', '\tprint(i)'),
      lines('for i in range(3):', '    print(i)')
    )
    expect(change.kind).toBe('same')
  })

  it('8e. a base equal to the Complete says it already matches', () => {
    const code = lines('x = 1', 'print(x)')
    expect(computeStageChange(code, code).kind).toBe('same')
  })

  it('the full rows keep the Complete blank lines in place', () => {
    const change = computeStageChange(lines('a = 1', 'c = 3'), lines('a = 1', '', 'b = 2', 'c = 3'))
    expect(change.fullRows).toEqual([
      { type: 'same', text: 'a = 1' },
      { type: 'same', text: '' },
      { type: 'add', text: 'b = 2' },
      { type: 'same', text: 'c = 3' },
    ])
  })

  it('falls back when an add has no usable anchor', () => {
    // Every line around the add repeats, alone and in pairs.
    const base = lines('x', 'x', 'x', 'x', 'x', 'x')
    const target = lines('x', 'x', 'x', 'y', 'x', 'x', 'x')
    const change = computeStageChange(base, target)
    expect(change.kind).toBe('fallback')
    expect(change.reason).toBe('no-anchor')
  })
})

describe('chooseChangeBase', () => {
  it("uses the student's editor code when it has code", () => {
    expect(chooseChangeBase('x = 1', 'starter')).toBe('x = 1')
  })

  it('uses the starter when the editor is empty or only markers', () => {
    expect(chooseChangeBase('   \n', 'starter')).toBe('starter')
    expect(chooseChangeBase('#> hint only', 'starter')).toBe('starter')
    expect(chooseChangeBase(null, null)).toBe('')
  })
})

describe('stageShowsChange', () => {
  it('is true only for a Complete code stage with show: change', () => {
    expect(stageShowsChange({ role: 'complete', show: 'change', code: 'x' })).toBe(true)
    expect(stageShowsChange({ role: 'complete', code: 'x' })).toBe(false)
    expect(stageShowsChange({ role: 'complete', show: 'full', code: 'x' })).toBe(false)
    expect(stageShowsChange({ role: 'support', show: 'change', code: 'x' })).toBe(false)
    expect(stageShowsChange({ role: 'complete', show: 'change', files: [] })).toBe(false)
    expect(stageShowsChange(null)).toBe(false)
  })
})

describe('copyAnchorRows', () => {
  it('copyAfter: the line before, dimmed, then the typed lines', () => {
    expect(copyAnchorRows({ code: 'turn += 10\nprint(turn)\n', after: '  size -= step' })).toEqual({
      anchor: { lines: ['  size -= step'], position: 'after' },
      rows: [
        { type: 'add', text: 'turn += 10' },
        { type: 'add', text: 'print(turn)' },
      ],
    })
  })

  it('copyBefore: the typed lines go above the named line', () => {
    expect(copyAnchorRows({ code: 'speed(0)', before: 'forward(50)' })).toEqual({
      anchor: { lines: ['forward(50)'], position: 'before' },
      rows: [{ type: 'add', text: 'speed(0)' }],
    })
  })

  it('is null with neither field (the panel looks as today)', () => {
    expect(copyAnchorRows({ code: 'x = 1' })).toBeNull()
    expect(copyAnchorRows({ code: 'x = 1', after: '   ' })).toBeNull()
  })
})
