import { describe, expect, it } from 'vitest'
import {
  compareStages,
  comparisonMatches,
  rasterColourAt,
  rasteriseStage,
  stageColourAt,
} from '../raster.js'

const RED = '#ff0000'
const BLUE = '#0000ff'

describe('rasteriseStage', () => {
  it('starts white and paints shapes in order', () => {
    const raster = rasteriseStage([
      { type: 'rect', x: 100, y: 200, w: 200, h: 400, colour: RED },
      { type: 'circle', x: 300, y: 200, r: 50, colour: BLUE },
    ])
    expect(raster.resolution).toBe(100)
    expect(rasterColourAt(raster, 10, 10)).toBe(RED)
    expect(rasterColourAt(raster, 300, 200)).toBe(BLUE)
    expect(rasterColourAt(raster, 390, 10)).toBe('#ffffff')
  })

  it('wipes on clear and fills on background', () => {
    const raster = rasteriseStage([
      { type: 'rect', x: 200, y: 200, w: 400, h: 400, colour: RED },
      { type: 'clear' },
      { type: 'background', colour: BLUE },
    ])
    expect(rasterColourAt(raster, 200, 200)).toBe(BLUE)
  })

  it('never loses a tiny shape or a thin line', () => {
    const raster = rasteriseStage([
      { type: 'circle', x: 101, y: 101, r: 1, colour: RED },
      { type: 'line', x1: 0, y1: 300, x2: 400, y2: 300, colour: BLUE, width: 1 },
    ])
    expect(rasterColourAt(raster, 101, 101)).toBe(RED)
    expect(rasterColourAt(raster, 200, 300)).toBe(BLUE)
  })

  it('paints grid cells and skips the empty ones', () => {
    const raster = rasteriseStage([
      { type: 'background', colour: BLUE },
      {
        type: 'grid',
        x: 0,
        y: 0,
        cell: 200,
        colours: [RED],
        cells: [
          [0, -1],
          [-1, 0],
        ],
      },
    ])
    expect(rasterColourAt(raster, 100, 100)).toBe(RED)
    expect(rasterColourAt(raster, 300, 100)).toBe(BLUE)
    expect(rasterColourAt(raster, 300, 300)).toBe(RED)
  })

  it('ignores shapes far off the stage', () => {
    const raster = rasteriseStage([{ type: 'rect', x: -1e9, y: 5000, w: 10, h: 10, colour: RED }])
    expect(Array.from(raster.cells).every((cell) => cell === 0xffffff)).toBe(true)
  })
})

describe('rasteriseStage: turned, polygon, see-through and outlined shapes', () => {
  it('paints a square turned 45° as a diamond', () => {
    const raster = rasteriseStage([
      { type: 'square', x: 200, y: 200, size: 200, colour: RED, angle: 45 },
    ])
    // The diamond's tips reach about 141 from the centre along the axes…
    expect(rasterColourAt(raster, 200, 70)).toBe(RED)
    expect(rasterColourAt(raster, 330, 200)).toBe(RED)
    // …and its old corners are now outside it.
    expect(rasterColourAt(raster, 110, 110)).toBe('#ffffff')
    expect(rasterColourAt(raster, 290, 290)).toBe('#ffffff')
  })

  it('turns a rectangle clockwise around its centre', () => {
    const raster = rasteriseStage([
      { type: 'rect', x: 200, y: 200, w: 300, h: 40, colour: RED, angle: 90 },
    ])
    expect(rasterColourAt(raster, 200, 70)).toBe(RED)
    expect(rasterColourAt(raster, 70, 200)).toBe('#ffffff')
  })

  it('paints a polygon with one corner straight up', () => {
    const raster = rasteriseStage([
      { type: 'polygon', x: 200, y: 200, sides: 3, size: 150, colour: BLUE },
    ])
    expect(rasterColourAt(raster, 200, 70)).toBe(BLUE)
    expect(rasterColourAt(raster, 200, 260)).toBe(BLUE)
    // A triangle pointing up leaves the top corners of its box empty.
    expect(rasterColourAt(raster, 90, 80)).toBe('#ffffff')
    expect(rasterColourAt(raster, 310, 80)).toBe('#ffffff')
  })

  it('blends a see-through shape with what is under it', () => {
    const raster = rasteriseStage([
      { type: 'background', colour: BLUE },
      { type: 'circle', x: 200, y: 200, r: 100, colour: RED, opacity: 0.5 },
    ])
    expect(rasterColourAt(raster, 200, 200)).toBe('#800080')
    expect(rasterColourAt(raster, 10, 10)).toBe(BLUE)
  })

  it('draws an outline on top of the fill, and an outline-only shape as just its edge', () => {
    const raster = rasteriseStage([
      { type: 'square', x: 100, y: 200, size: 120, colour: RED, outline: BLUE, width: 8 },
      { type: 'circle', x: 300, y: 200, r: 60, colour: null, outline: BLUE, width: 4 },
    ])
    expect(rasterColourAt(raster, 100, 200)).toBe(RED)
    expect(rasterColourAt(raster, 42, 200)).toBe(BLUE)
    expect(rasterColourAt(raster, 300, 200)).toBe('#ffffff')
    expect(rasterColourAt(raster, 358, 200)).toBe(BLUE)
  })

  it('rasterises a 40-shape see-through tunnel quickly enough to scrub', () => {
    const tunnel = Array.from({ length: 40 }, (_, i) => ({
      type: 'square',
      x: 200,
      y: 200,
      size: i * 8,
      colour: RED,
      angle: (i * 9) % 360,
      opacity: 0.5,
    }))
    const started = performance.now()
    rasteriseStage(tunnel)
    expect(performance.now() - started).toBeLessThan(200)
  })
})

describe('stageColourAt', () => {
  it('follows turns, opacity and outlines exactly', () => {
    const commands = [
      { type: 'background', colour: BLUE },
      { type: 'square', x: 200, y: 200, size: 100, colour: RED, angle: 45, opacity: 0.5 },
      { type: 'polygon', x: 50, y: 50, sides: 6, size: 30, colour: null, outline: RED, width: 4 },
    ]
    expect(stageColourAt(commands, 200, 200)).toBe('#800080')
    expect(stageColourAt(commands, 200, 140)).toBe('#800080')
    expect(stageColourAt(commands, 155, 155)).toBe(BLUE)
    expect(stageColourAt(commands, 50, 50)).toBe(BLUE)
    expect(stageColourAt(commands, 50, 20)).toBe(RED)
  })

  it('is the last shape covering the point', () => {
    const commands = [
      { type: 'rect', x: 50, y: 50, w: 100, h: 100, colour: RED },
      { type: 'circle', x: 50, y: 50, r: 10, colour: BLUE },
      { type: 'text', x: 50, y: 50, text: 'hi', colour: '#000000', size: 16 },
    ]
    expect(stageColourAt(commands, 50, 50)).toBe(BLUE)
    expect(stageColourAt(commands, 5, 5)).toBe(RED)
    expect(stageColourAt(commands, 200, 200)).toBe('#ffffff')
  })

  it('reads grid cells', () => {
    const grid = { type: 'grid', x: 0, y: 0, cell: 10, colours: [RED], cells: [[-1, 0]] }
    expect(stageColourAt([grid], 15, 5)).toBe(RED)
    expect(stageColourAt([grid], 5, 5)).toBe('#ffffff')
  })
})

describe('compareStages', () => {
  const target = [{ type: 'rect', x: 100, y: 100, w: 200, h: 200, colour: RED }]

  it('matches an identical drawing however it was made', () => {
    const same = [
      { type: 'rect', x: 50, y: 100, w: 100, h: 200, colour: RED },
      { type: 'rect', x: 150, y: 100, w: 100, h: 200, colour: '#fd0101' },
    ]
    const comparison = compareStages(same, target)
    expect(comparison.differing).toBe(0)
    expect(comparisonMatches(comparison)).toBe(true)
  })

  it('counts the differing fraction and names the first difference', () => {
    const half = [{ type: 'rect', x: 50, y: 100, w: 100, h: 200, colour: RED }]
    const comparison = compareStages(half, target)
    expect(comparison.fraction).toBeCloseTo(0.125, 5)
    expect(comparison.firstDifference).toEqual({
      row: 0,
      col: 25,
      mine: '#ffffff',
      target: RED,
    })
    expect(comparisonMatches(comparison, 0.2)).toBe(true)
    expect(comparisonMatches(comparison, 0.1)).toBe(false)
  })

  it('compares text and emoji by command, near the same place', () => {
    const withText = [...target, { type: 'text', x: 10, y: 10, text: 'Hi', colour: RED, size: 16 }]
    const moved = [...target, { type: 'text', x: 18, y: 4, text: 'Hi', colour: BLUE, size: 30 }]
    expect(comparisonMatches(compareStages(moved, withText))).toBe(true)
    const far = [...target, { type: 'text', x: 100, y: 10, text: 'Hi', colour: RED, size: 16 }]
    const result = compareStages(far, withText)
    expect(result.missing).toHaveLength(1)
    expect(result.extra).toHaveLength(1)
    expect(comparisonMatches(result, 1)).toBe(false)
    const stamped = [...target, { type: 'stamp', emoji: '⭐', x: 50, y: 50, size: 32 }]
    expect(compareStages(target, stamped).missing).toEqual([
      { kind: 'stamp', value: '⭐', x: 50, y: 50 },
    ])
  })
})
