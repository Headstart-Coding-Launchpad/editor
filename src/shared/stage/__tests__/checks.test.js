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
  { type: 'rect', x: 0, y: 0, w: 50, h: 50, colour: '#0000ff' },
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

describe('stage_colour_used', () => {
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
    expect(v({ type: 'stage_colour_used', colour: 'peach' })).toEqual([])
    expect(v({ type: 'stage_pixel', row: 0, col: 1, colour: 'red' })).toEqual([])
    expect(v({ type: 'stage_text_shown', text: 'Hi', operator: 'equals' })).toEqual([])
  })

  it('names each mistake', () => {
    expect(v({ type: 'stage_matches_target' }, { task: {} })).toEqual([
      'Task 3 has a stage_matches_target check but no stageTarget code to compare with',
    ])
    expect(v({ type: 'stage_matches_target', tolerance: 5 })[0]).toMatch(/tolerance "5"/)
    expect(v({ type: 'stage_shape_count', kind: 'square' })[0]).toMatch(/kind "square"/)
    expect(v({ type: 'stage_shape_count', min: 3, max: 1 })).toEqual([
      'Task 3 has a stage_shape_count check whose min is more than its max',
    ])
    expect(v({ type: 'stage_colour_used', colour: 'redd' })[0]).toMatch(/colour "redd"/)
    expect(v({ type: 'stage_pixel', colour: 'red' })).toEqual([
      'Task 3 has a stage_pixel check that needs either x and y, or row and col',
    ])
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
