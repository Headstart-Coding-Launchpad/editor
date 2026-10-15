import { describe, expect, it } from 'vitest'
import { describeStageCheck, evaluateStageCheck, validateStageCheck } from '../checks.js'
import { evaluateSingleCheck, checkNeedsRunResult } from '../../../modules/checks.js'
import { getModuleDefinition } from '../../../modules/definitions.js'

const RED = '#ff0000'
const HEART = {
  type: 'grid',
  x: 0,
  y: 0,
  cell: 80,
  colours: ['#ffffff', RED],
  cells: [
    [0, 1, 0, 1, 0],
    [1, 1, 1, 1, 1],
    [0, 1, 1, 1, 0],
    [0, 0, 1, 0, 0],
  ],
}

const drawing = [
  { type: 'rect', x: 25, y: 25, w: 50, h: 50, colour: '#0000ff' },
  { type: 'circle', x: 200, y: 200, r: 20, colour: RED },
  { type: 'text', x: 10, y: 300, text: 'Rows: 4', colour: '#000000', size: 16 },
  HEART,
]

const ctx = (commands, target = null) => ({ stage: { commands, target } })

describe('stage_matches_target', () => {
  it('passes within the tolerance and fails without a target', () => {
    const check = { type: 'stage_matches_target', tolerance: 0.02 }
    expect(evaluateStageCheck(check, ctx([HEART], [HEART]))).toBe(true)
    expect(evaluateStageCheck(check, ctx([], [HEART]))).toBe(false)
    expect(evaluateStageCheck(check, ctx([HEART], null))).toBe(false)
  })
})

describe('stage_shape_count', () => {
  it('counts a kind, or every shape, between min and max', () => {
    expect(
      evaluateStageCheck({ type: 'stage_shape_count', kind: 'circle', min: 1 }, ctx(drawing))
    ).toBe(true)
    expect(
      evaluateStageCheck({ type: 'stage_shape_count', kind: 'rect', min: 2 }, ctx(drawing))
    ).toBe(false)
    expect(evaluateStageCheck({ type: 'stage_shape_count', min: 4, max: 4 }, ctx(drawing))).toBe(
      true
    )
    expect(evaluateStageCheck({ type: 'stage_shape_count', kind: 'grid' }, ctx(drawing))).toBe(true)
    expect(
      evaluateStageCheck(
        { type: 'stage_shape_count', kind: 'rect', max: 0 },
        ctx([...drawing, { type: 'clear' }])
      )
    ).toBe(true)
  })
})

describe('stage_shape_count: squares and polygons', () => {
  const shapes = [
    { type: 'square', x: 200, y: 200, size: 80, colour: RED, angle: 45 },
    { type: 'square', x: 100, y: 100, size: 40, colour: RED },
    { type: 'polygon', x: 200, y: 200, sides: 6, size: 60, colour: RED },
    { type: 'polygon', x: 200, y: 200, sides: 3, size: 60, colour: RED },
  ]

  it('counts squares and polygons as their own kinds', () => {
    expect(
      evaluateStageCheck({ type: 'stage_shape_count', kind: 'square', min: 2, max: 2 }, ctx(shapes))
    ).toBe(true)
    expect(
      evaluateStageCheck({ type: 'stage_shape_count', kind: 'rect', min: 1 }, ctx(shapes))
    ).toBe(false)
    expect(
      evaluateStageCheck({ type: 'stage_shape_count', kind: 'polygon', min: 2 }, ctx(shapes))
    ).toBe(true)
  })

  it('filters polygons by sides', () => {
    expect(
      evaluateStageCheck(
        { type: 'stage_shape_count', kind: 'polygon', sides: 6, min: 1, max: 1 },
        ctx(shapes)
      )
    ).toBe(true)
    expect(
      evaluateStageCheck({ type: 'stage_shape_count', kind: 'polygon', sides: 5 }, ctx(shapes))
    ).toBe(false)
    expect(
      describeStageCheck({ type: 'stage_shape_count', kind: 'polygon', sides: 6, min: 1 })
    ).toBe('At least 1 polygon commands with 6 sides on the stage')
  })

  it('compares a turned, see-through drawing with its target as drawn', () => {
    const tunnel = (step) =>
      Array.from({ length: 10 }, (_, i) => ({
        type: 'square',
        x: 200,
        y: 200,
        size: 40 + i * 30,
        colour: RED,
        angle: i * step,
        opacity: 0.4,
      })).reverse()
    const check = { type: 'stage_matches_target' }
    expect(evaluateStageCheck(check, ctx(tunnel(9), tunnel(9)))).toBe(true)
    expect(evaluateStageCheck(check, ctx(tunnel(20), tunnel(9)))).toBe(false)
  })
})

describe('stage_colour_used', () => {
  it('finds an outline colour and a hue() colour', () => {
    const outlined = [
      { type: 'circle', x: 200, y: 200, r: 50, colour: null, outline: '#00ff00', width: 2 },
      { type: 'square', x: 200, y: 200, size: 50, colour: '#ff8000' },
    ]
    expect(evaluateStageCheck({ type: 'stage_colour_used', colour: 'lime' }, ctx(outlined))).toBe(
      true
    )
    expect(
      evaluateStageCheck({ type: 'stage_colour_used', colour: '#ff8000' }, ctx(outlined))
    ).toBe(true)
  })

  it('finds a colour in shapes and in the grid cells actually used', () => {
    expect(evaluateStageCheck({ type: 'stage_colour_used', colour: 'blue' }, ctx(drawing))).toBe(
      true
    )
    expect(evaluateStageCheck({ type: 'stage_colour_used', colour: 'green' }, ctx(drawing))).toBe(
      false
    )
    const unused = { ...HEART, colours: ['#ffffff', RED, '#00ff00'] }
    expect(evaluateStageCheck({ type: 'stage_colour_used', colour: 'lime' }, ctx([unused]))).toBe(
      false
    )
    expect(evaluateStageCheck({ type: 'stage_colour_used', colour: 'nope' }, ctx(drawing))).toBe(
      false
    )
  })
})

describe('stage_pixel', () => {
  it('reads a point or a grid cell of the last grid', () => {
    expect(
      evaluateStageCheck({ type: 'stage_pixel', x: 10, y: 10, colour: 'blue' }, ctx(drawing))
    ).toBe(false)
    expect(
      evaluateStageCheck({ type: 'stage_pixel', x: 120, y: 40, colour: 'red' }, ctx(drawing))
    ).toBe(true)
    expect(
      evaluateStageCheck({ type: 'stage_pixel', row: 3, col: 2, colour: 'red' }, ctx(drawing))
    ).toBe(true)
    expect(
      evaluateStageCheck({ type: 'stage_pixel', row: 3, col: 0, colour: 'white' }, ctx(drawing))
    ).toBe(true)
    expect(
      evaluateStageCheck({ type: 'stage_pixel', row: 0, col: 0, colour: 'white' }, ctx([]))
    ).toBe(false)
  })

  it('reads a cell by its index in the flat list of the last grid', () => {
    // A flat list drawn with width=3: 7 cells, the last row one cell long.
    const flat = [
      {
        type: 'grid',
        x: 0,
        y: 0,
        cell: 40,
        colours: ['#ff0000', '#0000ff'],
        cells: [[0, 0, 0], [0, 1, 0], [1]],
        wrap: 3,
      },
    ]
    const at = (index, colour) =>
      evaluateStageCheck({ type: 'stage_pixel', index, colour }, ctx(flat))
    expect(at(0, 'red')).toBe(true)
    expect(at(4, 'blue')).toBe(true)
    expect(at(4, 'red')).toBe(false)
    expect(at(6, 'blue')).toBe(true)
    // Past the end, or not a whole number of 0 or more: no cell, so it fails.
    expect(at(7, 'white')).toBe(false)
    expect(at(-1, 'red')).toBe(false)
    expect(at(1.5, 'red')).toBe(false)
    expect(evaluateStageCheck({ type: 'stage_pixel', index: 0, colour: 'white' }, ctx([]))).toBe(
      false
    )
  })
})

describe('stage_text_shown', () => {
  it('matches drawn text with contains by default', () => {
    expect(evaluateStageCheck({ type: 'stage_text_shown', text: 'rows' }, ctx(drawing))).toBe(true)
    expect(
      evaluateStageCheck(
        { type: 'stage_text_shown', text: 'Rows: 5', operator: 'equals' },
        ctx(drawing)
      )
    ).toBe(false)
    expect(
      evaluateStageCheck(
        { type: 'stage_text_shown', text: '^Rows: \\d$', operator: 'matches_regex' },
        ctx(drawing)
      )
    ).toBe(true)
    expect(evaluateStageCheck({ type: 'stage_text_shown', text: '' }, ctx(drawing))).toBe(false)
  })
})

describe('registry wiring', () => {
  it('evaluates through the check registry and needs a run', () => {
    expect(
      evaluateSingleCheck({ type: 'stage_colour_used', colour: 'red' }, '', ctx(drawing))
    ).toBe(true)
    expect(evaluateSingleCheck({ type: 'stage_colour_used', colour: 'red' }, '', {})).toBe(false)
    expect(checkNeedsRunResult({ type: 'stage_pixel', x: 1, y: 1, colour: 'red' })).toBe(true)
  })
})

describe('describeStageCheck', () => {
  it('names colours in words', () => {
    expect(describeStageCheck({ type: 'stage_colour_used', colour: 'dark_blue' })).toBe(
      'Something dark blue is on the stage'
    )
    expect(describeStageCheck({ type: 'stage_pixel', row: 1, col: 2, colour: '#ff0000' })).toBe(
      'Grid row 1, column 2 is red'
    )
    expect(describeStageCheck({ type: 'stage_pixel', index: 9, colour: 'blue' })).toBe(
      'Grid square 9 is blue'
    )
    expect(describeStageCheck({ type: 'stage_shape_count', kind: 'circle', min: 3 })).toBe(
      'At least 3 circle commands on the stage'
    )
  })
})

describe('validateStageCheck', () => {
  const python = getModuleDefinition('python')
  const task = { stageTarget: { code: 'from stage import *' } }
  const v = (check, extra = {}) =>
    validateStageCheck(check, {
      n: 3,
      kind: 'completion',
      task,
      moduleDefinition: python,
      ...extra,
    })

  it('accepts well-formed checks', () => {
    expect(v({ type: 'stage_matches_target', tolerance: 0.02 })).toEqual([])
    expect(v({ type: 'stage_shape_count', kind: 'rect', min: 1, max: 3 })).toEqual([])
    expect(v({ type: 'stage_shape_count', kind: 'square', min: 40 })).toEqual([])
    expect(v({ type: 'stage_shape_count', kind: 'polygon', sides: 6, min: 1 })).toEqual([])
    expect(v({ type: 'stage_colour_used', colour: 'peach' })).toEqual([])
    expect(v({ type: 'stage_pixel', row: 0, col: 1, colour: 'red' })).toEqual([])
    expect(v({ type: 'stage_pixel', index: 0, colour: 'red' })).toEqual([])
    expect(v({ type: 'stage_text_shown', text: 'Hi', operator: 'equals' })).toEqual([])
  })

  it('names each mistake', () => {
    expect(v({ type: 'stage_matches_target' }, { task: {} })).toEqual([
      'Task 3 has a stage_matches_target check but no stageTarget code to compare with',
    ])
    expect(v({ type: 'stage_matches_target', tolerance: 5 })[0]).toMatch(/tolerance "5"/)
    expect(v({ type: 'stage_shape_count', kind: 'hexagon' })[0]).toMatch(/kind "hexagon"/)
    expect(v({ type: 'stage_shape_count', kind: 'polygon', sides: 2 })).toEqual([
      'Task 3 has a stage_shape_count check whose sides is not a whole number from 3 to 100',
    ])
    expect(v({ type: 'stage_shape_count', kind: 'square', sides: 4 })).toEqual([
      'Task 3 has a stage_shape_count check with sides but its kind is not polygon — add kind: polygon',
    ])
    expect(v({ type: 'stage_shape_count', min: 3, max: 1 })).toEqual([
      'Task 3 has a stage_shape_count check whose min is more than its max',
    ])
    expect(v({ type: 'stage_colour_used', colour: 'redd' })[0]).toMatch(/colour "redd"/)
    expect(v({ type: 'stage_pixel', colour: 'red' })).toEqual([
      'Task 3 has a stage_pixel check that needs one of: x and y, row and col, or index',
    ])
    expect(v({ type: 'stage_pixel', row: 0, col: 0, index: 0, colour: 'red' })).toEqual([
      'Task 3 has a stage_pixel check that needs one of: x and y, row and col, or index',
    ])
    expect(v({ type: 'stage_pixel', index: -1, colour: 'red' })).toEqual([
      'Task 3 has a stage_pixel check whose index is not a whole number of 0 or more',
    ])
    expect(v({ type: 'stage_pixel', index: 'two', colour: 'red' })).toHaveLength(1)
    expect(v({ type: 'stage_pixel', x: 500, y: 1, colour: 'red' })[0]).toMatch(/0 to 399/)
    expect(v({ type: 'stage_text_shown', operator: 'starts_with' })).toHaveLength(2)
    expect(
      v(
        { type: 'stage_colour_used', colour: 'red' },
        { moduleDefinition: getModuleDefinition('turtle') }
      )
    ).toEqual(['Task 3 has a stage_colour_used check, but stage checks only work in Python tasks'])
  })
})
