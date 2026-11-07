import { describe, expect, it } from 'vitest'
import { copyAnchorRows, inlineLineChange, pairInlineRows } from '../stageChange.js'

// Platform request 135: when a changed line only gains text, or has a small swap, the change view
// shows the line once with only the changed part marked.

describe('inlineLineChange', () => {
  it('a pure insertion is one line: the old part kept, the inserted text added', () => {
    expect(inlineLineChange('circle(100, "gold")', 'circle(100, "gold", x=100, y=100)')).toEqual({
      kind: 'insert',
      pieces: [
        { type: 'same', text: 'circle(100, "gold"' },
        { type: 'add', text: ', x=100, y=100' },
        { type: 'same', text: ')' },
      ],
    })
  })

  it('a small swap marks only the changed piece: removed then added', () => {
    expect(inlineLineChange('for i in range(5):', 'for i in range(3):')).toEqual({
      kind: 'change',
      pieces: [
        { type: 'same', text: 'for i in range(' },
        { type: 'remove', text: '5' },
        { type: 'add', text: '3' },
        { type: 'same', text: '):' },
      ],
    })
  })

  it('a string swaps as a whole, never letter by letter', () => {
    expect(inlineLineChange('color("red")', 'color("gold")').pieces).toEqual([
      { type: 'same', text: 'color(' },
      { type: 'remove', text: '"red"' },
      { type: 'add', text: '"gold"' },
      { type: 'same', text: ')' },
    ])
  })

  it('falls back (null) when more than about half the characters differ', () => {
    expect(inlineLineChange('print("Hello " + name)', 'for i in range(10): forward(i * 5)')).toBe(
      null
    )
    expect(inlineLineChange('step = 5', 'jump = size * 2')).toBeNull()
  })

  it('falls back (null) with 3 or more separate changes in the line', () => {
    expect(inlineLineChange('total = width + height + depth', 'total = w + h + d')).toBeNull()
    expect(inlineLineChange('move(a, b, c, d)', 'move(x, b, y, d)')).not.toBeNull()
    expect(
      inlineLineChange('go(alpha, beta, gamma, delta)', 'go(one, beta, two, delta, three)')
    ).toBe(null)
  })

  it('keeps the red and green rows (null) when the indent width differs', () => {
    expect(inlineLineChange('  circle(10)', '        circle(10, x=5)')).toBeNull()
    expect(inlineLineChange('circle(10)', '\tcircle(10, x=5)')).toBeNull()
  })

  it('keeps the shared indent in the first piece when the indent matches', () => {
    expect(inlineLineChange('    circle(10)', '\tcircle(10, x=5)')).toEqual({
      kind: 'insert',
      pieces: [
        { type: 'same', text: '\tcircle(10' },
        { type: 'add', text: ', x=5' },
        { type: 'same', text: ')' },
      ],
    })
  })

  it('a whitespace-only edit is null (keeps the red and green rows)', () => {
    expect(inlineLineChange('x=1', 'x = 1')).toBeNull()
    expect(inlineLineChange('circle(10,x=5)', 'circle(10, x=5)')).toBeNull()
  })

  it('a whitespace piece next to a real change is shown as unchanged text', () => {
    expect(inlineLineChange('f(a,b)', 'f(a, b, c)')).toEqual({
      kind: 'insert',
      pieces: [
        { type: 'same', text: 'f(a, b' },
        { type: 'add', text: ', c' },
        { type: 'same', text: ')' },
      ],
    })
  })

  it('words added inside a string show inside it', () => {
    expect(inlineLineChange('print("Hi")', 'print("Hi there")')).toEqual({
      kind: 'insert',
      pieces: [
        { type: 'same', text: 'print("Hi' },
        { type: 'add', text: ' there' },
        { type: 'same', text: '")' },
      ],
    })
    expect(inlineLineChange('print("Hi Sam")', 'print("Hi Ava")').pieces).toEqual([
      { type: 'same', text: 'print("Hi ' },
      { type: 'remove', text: 'Sam' },
      { type: 'add', text: 'Ava' },
      { type: 'same', text: '")' },
    ])
  })

  it('a string never splits inside a word', () => {
    expect(inlineLineChange('color("Hello")', 'color("Help")').pieces).toEqual([
      { type: 'same', text: 'color(' },
      { type: 'remove', text: '"Hello"' },
      { type: 'add', text: '"Help"' },
      { type: 'same', text: ')' },
    ])
  })

  it('is null when the lines match (apart from indent)', () => {
    expect(inlineLineChange('x = 1', 'x = 1')).toBeNull()
    expect(inlineLineChange('x = 1', '    x = 1')).toBeNull()
  })
})

describe('pairInlineRows', () => {
  it('a removed line and its extended line become one add row', () => {
    const rows = pairInlineRows([
      { type: 'remove', text: 'circle(100, "gold")' },
      { type: 'add', text: 'circle(100, "gold", x=100, y=100)', hint: 'Move it' },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].type).toBe('add')
    expect(rows[0].text).toBe('circle(100, "gold", x=100, y=100)')
    expect(rows[0].hint).toBe('Move it')
    expect(rows[0].inline.kind).toBe('insert')
  })

  it('a small swap becomes one change row', () => {
    const rows = pairInlineRows([
      { type: 'remove', text: 'for i in range(5):' },
      { type: 'add', text: 'for i in range(3):' },
    ])
    expect(rows.map((row) => row.type)).toEqual(['change'])
  })

  it('a big change keeps the red row and the green row', () => {
    const rows = [
      { type: 'remove', text: 'print("Hello " + name)' },
      { type: 'add', text: 'for i in range(10): forward(i * 5)' },
    ]
    expect(pairInlineRows(rows)).toEqual(rows)
  })

  it('pairs only inside a run of changes, and leaves new lines green', () => {
    const rows = pairInlineRows([
      { type: 'same', text: 'x = 1' },
      { type: 'remove', text: 'forward(50)' },
      { type: 'add', text: 'forward(50, 2)' },
      { type: 'add', text: 'right(90)' },
      { type: 'same', text: 'done()' },
    ])
    expect(rows.map((row) => [row.type, !!row.inline])).toEqual([
      ['same', false],
      ['add', true],
      ['add', false],
      ['same', false],
    ])
  })
})

describe('pairInlineRows choices', () => {
  it('pairs each new line with the old line it changes least, keeping order', () => {
    const rows = pairInlineRows([
      { type: 'remove', text: 'move(1, 2, 3)' },
      { type: 'remove', text: 'move(1, 2, 4)' },
      { type: 'add', text: 'move(1, 2, 4, 5)' },
    ])
    expect(rows.map((row) => [row.type, row.text, row.inline?.kind ?? null])).toEqual([
      ['remove', 'move(1, 2, 3)', null],
      ['add', 'move(1, 2, 4, 5)', 'insert'],
    ])
  })

  it('a whitespace-only edit keeps the red row and the green row', () => {
    const rows = [
      { type: 'remove', text: 'x=1' },
      { type: 'add', text: 'x = 1' },
    ]
    expect(pairInlineRows(rows)).toEqual(rows)
  })

  it('a run of more than 12 lines on a side is left as red and green rows', () => {
    const removes = Array.from({ length: 13 }, (_, i) => ({ type: 'remove', text: `dot(${i})` }))
    const adds = Array.from({ length: 13 }, (_, i) => ({ type: 'add', text: `dot(${i}, 2)` }))
    expect(pairInlineRows([...removes, ...adds])).toEqual([...removes, ...adds])
    const small = pairInlineRows([...removes.slice(0, 12), ...adds.slice(0, 12)])
    expect(small.every((row) => row.inline)).toBe(true)
  })
})

describe('copyAnchorRows with the starter', () => {
  const starter = 'size = 100\nstep = 5\nsize -= step\ncircle(100, "gold")'

  it('a typed line that extends a starter line shows only the extension', () => {
    const anchored = copyAnchorRows({
      code: 'circle(100, "gold", x=100, y=100)',
      after: 'size -= step',
      starter,
    })
    expect(anchored.rows).toHaveLength(1)
    expect(anchored.rows[0].type).toBe('add')
    expect(anchored.rows[0].inline.pieces).toEqual([
      { type: 'same', text: 'circle(100, "gold"' },
      { type: 'add', text: ', x=100, y=100' },
      { type: 'same', text: ')' },
    ])
  })

  it('a wholly new line, or a swap, stays all green', () => {
    const anchored = copyAnchorRows({
      code: 'turn += 10\nstep = 3',
      after: 'size -= step',
      starter,
    })
    expect(anchored.rows).toEqual([
      { type: 'add', text: 'turn += 10' },
      { type: 'add', text: 'step = 3' },
    ])
  })

  it('extends only the anchor line or the line on the typed side of it', () => {
    const starterLines = 'a = 1\ncircle(10)\nb = 2\nsquare(5)\nc = 3'
    // copyAfter: the anchor itself, or the line right after it.
    expect(
      copyAnchorRows({ code: 'circle(10, x=5)', after: 'a = 1', starter: starterLines }).rows[0]
        .inline?.kind
    ).toBe('insert')
    expect(
      copyAnchorRows({ code: 'square(5, x=5)', after: 'square(5)', starter: starterLines }).rows[0]
        .inline?.kind
    ).toBe('insert')
    // A starter line far from the anchor: all green.
    expect(
      copyAnchorRows({ code: 'square(5, x=5)', after: 'a = 1', starter: starterLines }).rows
    ).toEqual([{ type: 'add', text: 'square(5, x=5)' }])
    // copyBefore: the anchor itself, or the line right before it.
    expect(
      copyAnchorRows({ code: 'circle(10, x=5)', before: 'b = 2', starter: starterLines }).rows[0]
        .inline?.kind
    ).toBe('insert')
    expect(
      copyAnchorRows({ code: 'square(5, x=5)', before: 'b = 2', starter: starterLines }).rows
    ).toEqual([{ type: 'add', text: 'square(5, x=5)' }])
  })

  it('Level A L1 tasks 36 and 38: a new line under the anchor stays all green', () => {
    // From the Level A L1 lesson (hlrv9r2gtg): copyAfter, the starter and the typed line.
    const task36 = copyAnchorRows({
      code: 'circle(90, "orange", x=100, y=250)\n',
      after: 'background("black")',
      starter: 'from stage import *\nbackground("black")\n',
    })
    expect(task36).toEqual({
      anchor: { lines: ['background("black")'], position: 'after' },
      rows: [{ type: 'add', text: 'circle(90, "orange", x=100, y=250)' }],
    })
    const task38 = copyAnchorRows({
      code: 'text("Ava", "gold", x=200, y=100, size=64)\n',
      after: 'circle(25, "red", x=100, y=200)',
      starter:
        'from stage import *\nbackground("black")\ncircle(90, "orange", x=100, y=250)\ncircle(25, "red", x=100, y=200)\n',
    })
    expect(task38).toEqual({
      anchor: { lines: ['circle(25, "red", x=100, y=200)'], position: 'after' },
      rows: [{ type: 'add', text: 'text("Ava", "gold", x=200, y=100, size=64)' }],
    })
  })
})
