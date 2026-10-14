import { describe, expect, it } from 'vitest'
import { describeComparison, describeStage, MAX_DESCRIBED_ITEMS } from '../describe.js'
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
        'an orange circle centred at x 200, y 200, radius 50; ' +
        'a rectangle in a colour close to red (#ff1010) at x 10, y 20, 30 wide and 40 tall; ' +
        'the text "Score: 3" in white at x 5, y 6; ' +
        'the emoji ⭐ at x 100, y 100; ' +
        'a pixel grid of 2 rows by 3 columns in white and red.'
    )
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
  const target = [{ type: 'rect', x: 0, y: 0, w: 200, h: 200, colour: '#ff0000' }]

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
