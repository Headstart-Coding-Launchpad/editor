import { describe, expect, it } from 'vitest'
import { computeBoxBands, computeBoxes, formatPx, formatSides, readBoxSizes } from '../boxModel'
import { computeFlexGuides, computeGridLines, layoutKind, parseTrackList } from '../layout'

const sides = (top, right = top, bottom = top, left = right) => ({ top, right, bottom, left })
const SIZES = { margin: sides(10), border: sides(2), padding: sides(5, 8) }
const BORDER_RECT = { x: 100, y: 50, width: 200, height: 80 }

describe('computeBoxes', () => {
  it('grows the margin box out and shrinks padding and content in', () => {
    const boxes = computeBoxes(BORDER_RECT, SIZES)
    expect(boxes.margin).toEqual({ x: 90, y: 40, width: 220, height: 100 })
    expect(boxes.border).toEqual({ x: 100, y: 50, width: 200, height: 80 })
    expect(boxes.padding).toEqual({ x: 102, y: 52, width: 196, height: 76 })
    expect(boxes.content).toEqual({ x: 110, y: 57, width: 180, height: 66 })
  })

  it('never makes a box narrower than zero', () => {
    const boxes = computeBoxes(
      { x: 0, y: 0, width: 4, height: 4 },
      { ...SIZES, padding: sides(10) }
    )
    expect(boxes.content.width).toBe(0)
    expect(boxes.content.height).toBe(0)
  })
})

describe('computeBoxBands', () => {
  it('returns the four rings, each with its own sides, and the content box', () => {
    const bands = computeBoxBands(BORDER_RECT, SIZES)
    expect(bands.map((band) => band.layer)).toEqual(['margin', 'border', 'padding', 'content'])
    const margin = bands[0]
    expect(margin.rects).toHaveLength(4)
    // Top strip of the margin: full margin-box width, margin-top tall.
    expect(margin.rects[0]).toEqual({ x: 90, y: 40, width: 220, height: 10 })
    // Left strip of the padding: padding-left wide, the content height.
    const padding = bands[2]
    expect(padding.rects[3]).toEqual({ x: 102, y: 57, width: 8, height: 66 })
    expect(bands[3].rects).toEqual([{ x: 110, y: 57, width: 180, height: 66 }])
  })

  it('drops zero-size strips', () => {
    const bands = computeBoxBands(BORDER_RECT, { ...SIZES, margin: sides(0) })
    expect(bands[0].rects).toEqual([])
  })

  it('reads sizes from a computed style and formats them', () => {
    const style = {
      getPropertyValue: (name) =>
        ({ 'margin-top': '16px', 'padding-left': '7.3px', 'border-top-width': '1px' })[name] ??
        '0px',
    }
    const sizes = readBoxSizes(style)
    expect(sizes.margin).toEqual({ top: 16, right: 0, bottom: 0, left: 0 })
    expect(sizes.border.top).toBe(1)
    expect(formatPx(sizes.padding.left)).toBe('7.5')
    expect(formatSides(sides(8))).toBe('8')
    expect(formatSides(sides(8, 4))).toBe('8 4 8 4')
  })
})

describe('layout guides', () => {
  it('spots flex and grid containers', () => {
    expect(layoutKind('flex')).toBe('flex')
    expect(layoutKind('inline-flex')).toBe('flex')
    expect(layoutKind('grid')).toBe('grid')
    expect(layoutKind('block')).toBe(null)
  })

  it('reads px track lists and ignores line names', () => {
    expect(parseTrackList('[a] 100px 50.5px [b]')).toEqual([100, 50.5])
    expect(parseTrackList('none')).toEqual([])
    expect(parseTrackList('1fr 2fr')).toEqual([])
  })

  it('numbers grid lines and finds the gaps', () => {
    const content = { x: 0, y: 0, width: 230, height: 100 }
    const grid = computeGridLines(content, [100, 100], [40, 50], 30, 10)
    expect(grid.columns).toEqual([
      { x: 0, number: 1 },
      { x: 130, number: 2 },
      { x: 230, number: 3 },
    ])
    expect(grid.rows.map((row) => row.y)).toEqual([0, 50, 100])
    expect(grid.gaps).toEqual([
      { x: 100, y: 0, width: 30, height: 100, axis: 'column', size: 30 },
      { x: 0, y: 40, width: 230, height: 10, axis: 'row', size: 10 },
    ])
  })

  it('points the main axis along flex-direction and finds flex gaps', () => {
    const content = { x: 0, y: 0, width: 300, height: 100 }
    const children = [
      { x: 0, y: 0, width: 50, height: 100 },
      { x: 60, y: 0, width: 50, height: 100 },
    ]
    const row = computeFlexGuides(content, { direction: 'row' }, children, 10)
    expect(row.main).toMatchObject({ x1: 0, y1: 50, x2: 300, y2: 50 })
    expect(row.cross).toMatchObject({ x1: 150, y1: 0, x2: 150, y2: 100 })
    expect(row.gaps).toEqual([{ x: 50, y: 0, width: 10, height: 100, size: 10 }])

    const reversed = computeFlexGuides(content, { direction: 'column-reverse' }, [], 0)
    expect(reversed.main).toMatchObject({ x1: 150, y1: 100, x2: 150, y2: 0 })
    expect(reversed.gaps).toEqual([])
  })
})
