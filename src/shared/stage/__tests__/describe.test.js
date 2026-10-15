import { describe, expect, it } from 'vitest'
import {
  describeCommand,
  describeComparison,
  describeStage,
  MAX_DESCRIBED_ITEMS,
} from '../describe.js'
import { compareStages } from '../raster.js'

describe('describeStage', () => {
  it('says when nothing is drawn', () => {
    expect(describeStage([])).toBe('Stage, 400 by 400. Background: white. Nothing else is drawn.')
  })

  it('lists the shapes, text and grid size with colours in words', () => {
    const text = describeStage([
      { type: 'background', colour: '#000080' },
      { type: 'circle', x: 200, y: 200, r: 50, colour: '#ffa500' },
      { type: 'rect', x: 10, y: 20, w: 30, h: 40, colour: '#ff1010' },
      { type: 'text', x: 5, y: 6, text: 'Score: 3', colour: '#ffffff', size: 16 },
      { type: 'stamp', emoji: '⭐', x: 100, y: 100, size: 32 },
      {
        type: 'grid',
        x: 0,
        y: 0,
        cell: 80,
        colours: ['#ffffff', '#ff0000'],
        cells: [
          [0, 1, 0],
          [1, 1, 1],
        ],
      },
    ])
    expect(text).toBe(
      'Stage, 400 by 400. Background: navy. 5 things drawn: ' +
        'an orange circle, radius 50, in the middle; ' +
        'a rectangle in a colour close to red (#ff1010), 30 wide and 40 tall, at x 10, y 20; ' +
        'the text "Score: 3" in white centred at x 5, y 6; ' +
        'the emoji ⭐ at x 100, y 100; ' +
        'a pixel grid of 2 rows by 3 columns in white and red.'
    )
  })

  it('says how many squares a flat grid has, and how many to a row', () => {
    expect(
      describeCommand({
        type: 'grid',
        x: 0,
        y: 0,
        cell: 50,
        colours: ['#ff0000', '#ffffff'],
        cells: [Array(8).fill(0), Array(8).fill(1), Array(8).fill(0)],
        wrap: 8,
      })
    ).toBe('a pixel grid of 24 squares, 8 to a row, in red and white')
  })

  it('says how a shape is turned, faded and outlined', () => {
    expect(
      describeCommand({ type: 'square', x: 200, y: 200, size: 80, colour: '#ff0000', angle: 45 })
    ).toBe('a red square, size 80, turned 45°, in the middle')
    expect(
      describeCommand({
        type: 'polygon',
        x: 100,
        y: 80,
        sides: 6,
        size: 60,
        colour: '#008080',
        opacity: 0.5,
        outline: '#000000',
        width: 2,
      })
    ).toBe(
      'a teal hexagon with a black outline, 6 sides, size 60, see-through (opacity 0.5), at x 100, y 80'
    )
    expect(
      describeCommand({
        type: 'circle',
        x: 200,
        y: 200,
        r: 50,
        colour: null,
        outline: '#ff0000',
        width: 2,
      })
    ).toBe('a red circle outline, radius 50, in the middle')
    expect(
      describeCommand({ type: 'polygon', x: 200, y: 200, sides: 12, size: 40, colour: '#4169e1' })
    ).toBe('a royal blue 12-sided shape, 12 sides, size 40, in the middle')
    expect(
      describeCommand({ type: 'stamp', emoji: '⭐', x: 200, y: 200, size: 32, angle: 90 })
    ).toBe('the emoji ⭐, turned 90° in the middle')
  })

  it('describes only what is left after clear() and caps the list', () => {
    const many = Array.from({ length: MAX_DESCRIBED_ITEMS + 3 }, (_, i) => ({
      type: 'line',
      x1: i,
      y1: 0,
      x2: i,
      y2: 10,
      colour: '#000000',
      width: 2,
    }))
    const text = describeStage([
      { type: 'rect', x: 0, y: 0, w: 1, h: 1, colour: '#ff0000' },
      { type: 'clear' },
      ...many,
    ])
    expect(text).not.toContain('rectangle')
    expect(text).toContain(`${MAX_DESCRIBED_ITEMS + 3} things drawn`)
    expect(text.endsWith('; and 3 more.')).toBe(true)
  })
})

describe('describeComparison', () => {
  const target = [{ type: 'rect', x: 100, y: 100, w: 200, h: 200, colour: '#ff0000' }]

  it('celebrates a match', () => {
    expect(describeComparison(compareStages(target, target), { matches: true })).toBe(
      'Your drawing matches the target.'
    )
  })

  it('says how much differs, where, and in which colours', () => {
    const comparison = compareStages([], target)
    expect(describeComparison(comparison)).toBe(
      'About 25% of the stage is different from the target. For example, near x 2, y 2 the target is red but yours is white.'
    )
  })

  it('lists missing and extra text', () => {
    const withText = [{ type: 'text', x: 10, y: 10, text: 'Hi', colour: '#000000', size: 16 }]
    expect(describeComparison(compareStages([], withText))).toBe(
      'Still to draw: the text "Hi" near x 10, y 10.'
    )
  })
})
