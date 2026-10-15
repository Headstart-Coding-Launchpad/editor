// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  cardVisuals,
  chooseVisual,
  describeItem,
  describePicture,
  nodeColour,
  nodeNumber,
  sizeText,
  targetToNode,
} from '../visuals.js'

const str = (v) => ({ t: 'str', v })
const int = (v) => ({ t: 'int', v })
const float = (v) => ({ t: 'float', v, r: String(v) })
const list = (items, extra = {}) => ({ t: 'list', items, len: items.length, ...extra })
const dict = (entries) => ({
  t: 'dict',
  len: entries.length,
  items: entries.map(([k, v]) => ({ k: str(k), v })),
})

describe('nodeColour / nodeNumber', () => {
  it('reads CSS names, PICO-8 names and hex codes as colours, and nothing else', () => {
    expect(nodeColour(str('red'))).toBe('#ff0000')
    expect(nodeColour(str('dark_blue'))).toBe('#1d2b53')
    expect(nodeColour(str('#0F0'))).toBe('#00ff00')
    expect(nodeColour(str('apple'))).toBeNull()
    expect(nodeColour(str('none'))).toBeNull()
    expect(nodeColour(int(3))).toBeNull()
  })

  it('reads ints and floats as numbers, but not True/False or huge ints', () => {
    expect(nodeNumber(int(3))).toBe(3)
    expect(nodeNumber(float(2.5))).toBe(2.5)
    expect(nodeNumber({ t: 'bool', v: true })).toBeNull()
    expect(nodeNumber({ t: 'int', r: '1' + '0'.repeat(30) })).toBeNull()
  })
})

describe('chooseVisual: lists', () => {
  it('shows a list of colours as swatches with index and colour words', () => {
    const visual = chooseVisual(list([str('red'), str('orange'), str('#00ff00')]))
    expect(visual.kind).toBe('swatches')
    expect(visual.items.map((item) => [item.index, item.hex, item.words])).toEqual([
      [0, '#ff0000', 'red'],
      [1, '#ffa500', 'orange'],
      [2, '#00ff00', 'lime'],
    ])
    expect(describeItem('palette', visual, visual.items[0])).toBe('palette, item 0: red')
  })

  it('falls back to tiles when not every item is a colour', () => {
    expect(chooseVisual(list([str('apple'), str('orange')])).kind).toBe('tiles')
    expect(chooseVisual(list([str('red'), int(1)])).kind).toBe('tiles')
  })

  it('shows a list of numbers as bars scaled to the biggest size', () => {
    const visual = chooseVisual(list([int(4), int(-2), float(1)]))
    expect(visual.kind).toBe('bars')
    expect(visual.items.map((item) => item.fraction)).toEqual([1, 0.5, 0.25])
    expect(describeItem('scores', visual, visual.items[1])).toBe('scores, item 1: -2')
  })

  it('treats text that looks like a number as text, so "5" stays a tile', () => {
    expect(chooseVisual(list([str('5'), str('6')])).kind).toBe('tiles')
  })

  it('keeps the visual for the items read when a long list was cut', () => {
    const visual = chooseVisual({ t: 'list', len: 80, items: [str('red'), str('blue')] })
    expect(visual.kind).toBe('swatches')
    expect(visual.notRead).toBe(78)
  })

  it('is plain for an empty list, a set, a scalar, or with visuals off', () => {
    expect(chooseVisual(list([])).kind).toBe('plain')
    expect(chooseVisual({ t: 'set', len: 1, items: [str('red')] }).kind).toBe('plain')
    expect(chooseVisual(int(1)).kind).toBe('plain')
    expect(chooseVisual(list([str('red')]), { visuals: false }).kind).toBe('plain')
    expect(chooseVisual(null).kind).toBe('plain')
  })
})

describe('chooseVisual: 2D lists', () => {
  const art = list([list([str('red'), str('none')]), list([str('white'), str('red')])])

  it('shows equal rows of colours as a picture, with see-through cells', () => {
    const visual = chooseVisual(art)
    expect(visual.kind).toBe('picture')
    expect(visual.rows).toBe(2)
    expect(visual.cols).toBe(2)
    expect(visual.cells[0][1]).toEqual({ hex: null, words: 'see-through' })
    expect(describePicture('art', visual)).toBe(
      'art: 2 by 2 picture, 2 colours: red 2, see-through 1, white 1'
    )
  })

  it('shows other 2D lists (numbers never drawn, text) as a table', () => {
    const numbers = chooseVisual(list([list([int(1), int(2)]), list([int(3), int(4)])]))
    expect(numbers.kind).toBe('table')
    expect(numbers.cols).toBe(2)
    expect(chooseVisual(list([list([str('a')]), list([str('b')])])).kind).toBe('table')
  })

  it('falls back to tiles for ragged rows or rows that were not read', () => {
    expect(chooseVisual(list([list([str('red')]), list([str('red'), str('red')])])).kind).toBe(
      'tiles'
    )
    expect(
      chooseVisual(list([list([str('red')]), { t: 'list', len: 1, items: [], cut: true }])).kind
    ).toBe('tiles')
  })
})

describe('chooseVisual: lists the Stage drew (stageLists)', () => {
  const pixels = list([list([int(0), int(7)]), list([int(8), int(1)])], { g: 1 })

  it('shows just the size by default', () => {
    const visual = chooseVisual(pixels)
    expect(visual).toEqual({ kind: 'size', rows: 2, cols: 2 })
    expect(sizeText(pixels, visual)).toBe('list, 2 × 2, drawn on the Stage')
  })

  it('shows rows of tiles with stageLists: tiles', () => {
    const visual = chooseVisual(pixels, { stageLists: 'tiles' })
    expect(visual.kind).toBe('rows')
    expect(visual.rows).toHaveLength(2)
  })

  it('draws palette numbers with stageLists: picture (Arcade colours without a palette)', () => {
    const visual = chooseVisual(pixels, { stageLists: 'picture' })
    expect(visual.kind).toBe('picture')
    expect(visual.cells[0].map((cell) => cell.hex)).toEqual(['#000000', '#fff1e8'])
  })

  it("uses the grid() call's own palette when it gave one", () => {
    const visual = chooseVisual(
      list([list([int(0), int(1), int(2)])], { g: 1, gp: ['white', 'red', 'none'] }),
      {
        stageLists: 'picture',
      }
    )
    expect(visual.cells[0]).toEqual([
      { hex: '#ffffff', words: 'white' },
      { hex: '#ff0000', words: 'red' },
      { hex: null, words: 'see-through' },
    ])
  })

  it('ignores stageLists when visuals are off', () => {
    expect(chooseVisual(pixels, { visuals: false, stageLists: 'picture' }).kind).toBe('plain')
  })
})

describe('chooseVisual: dicts', () => {
  it('shows a dict as cards, with a swatch for colour values', () => {
    const visual = chooseVisual(
      dict([
        ['sky', str('blue')],
        ['lives', int(3)],
      ])
    )
    expect(visual.kind).toBe('cards')
    expect(visual.entries.map((entry) => entry.hex)).toEqual(['#0000ff', null])
    expect(describeItem('theme', visual, visual.entries[0])).toBe('theme, "sky": "blue" (blue)')
  })

  it('shows a dict of numbers as labelled bars', () => {
    const visual = chooseVisual(
      dict([
        ['Sam', int(2)],
        ['Ali', int(8)],
      ])
    )
    expect(visual.kind).toBe('dictBars')
    expect(visual.entries.map((entry) => entry.fraction)).toEqual([0.25, 1])
  })
})

describe('targetToNode', () => {
  it('turns lesson target values into value nodes', () => {
    expect(targetToNode(10)).toEqual({ t: 'int', v: 10 })
    expect(targetToNode(2.5)).toEqual({ t: 'float', v: 2.5, r: '2.5' })
    expect(targetToNode('red')).toEqual({ t: 'str', v: 'red' })
    expect(targetToNode(null)).toEqual({ t: 'none' })
    expect(targetToNode(true)).toEqual({ t: 'bool', v: true })
    expect(chooseVisual(targetToNode(['red', 'blue'])).kind).toBe('swatches')
    expect(targetToNode({ a: 1 })).toEqual({
      t: 'dict',
      len: 1,
      items: [{ k: { t: 'str', v: 'a' }, v: { t: 'int', v: 1 } }],
    })
  })
})

describe('cardVisuals', () => {
  it('picks up to two swatch, picture or bar variables for the tutor card', () => {
    const vars = [
      { n: 'name', v: str('Sam') },
      { n: 'palette', v: list([str('red')]) },
      { n: 'fruit', v: list([str('apple')]) },
      { n: 'scores', v: list([int(1)]) },
      { n: 'more', v: list([int(2)]) },
    ]
    expect(cardVisuals(vars, { visuals: true }).map((entry) => entry.name)).toEqual([
      'palette',
      'scores',
    ])
    expect(cardVisuals(vars, { visuals: false })).toEqual([])
  })
})
