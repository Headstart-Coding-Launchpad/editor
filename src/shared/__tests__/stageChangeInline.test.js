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

  it('ignores a leading-indent difference and keeps the new indent', () => {
    expect(inlineLineChange('  circle(10)', '        circle(10, x=5)')).toEqual({
      kind: 'insert',
      pieces: [
        { type: 'same', text: '        circle(10' },
        { type: 'add', text: ', x=5' },
        { type: 'same', text: ')' },
      ],
    })
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
})
