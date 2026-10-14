import { describe, expect, it } from 'vitest'
import {
  createStageRecorder,
  MAX_STAGE_COMMANDS,
  STAGE_FUNCTIONS,
  stageHasDrawing,
  validateStageCall,
  visibleCommands,
} from '../commands.js'
import { STAGE_INSTALL_PY, STAGE_MODULE_PY } from '../stagePy.js'

describe('validateStageCall', () => {
  it('builds each command with colours as hex', () => {
    expect(validateStageCall('background', ['navy'])).toEqual({
      command: { type: 'background', colour: '#000080' },
    })
    expect(validateStageCall('rect', [10, 20, 30, 40, 'red'])).toEqual({
      command: { type: 'rect', x: 10, y: 20, w: 30, h: 40, colour: '#ff0000' },
    })
    expect(validateStageCall('circle', [200, 200, 50, '#00f'])).toEqual({
      command: { type: 'circle', x: 200, y: 200, r: 50, colour: '#0000ff' },
    })
    expect(validateStageCall('line', [0, 0, 400, 400, 'black'])).toEqual({
      command: { type: 'line', x1: 0, y1: 0, x2: 400, y2: 400, colour: '#000000', width: 2 },
    })
    expect(validateStageCall('text', [5, 6, 'Hi', 'black', 20])).toEqual({
      command: { type: 'text', x: 5, y: 6, text: 'Hi', colour: '#000000', size: 20 },
    })
    expect(validateStageCall('stamp', ['⭐', 100, 120])).toEqual({
      command: { type: 'stamp', emoji: '⭐', x: 100, y: 120, size: 32 },
    })
    expect(validateStageCall('clear', [])).toEqual({ command: { type: 'clear' } })
  })

  it('names the argument and what was given, in plain words', () => {
    expect(validateStageCall('rect', [10, '20', 30, 40, 'red']).error).toEqual({
      kind: 'TypeError',
      message: "rect(): y should be a number, like 50, not the text '20'",
    })
    expect(validateStageCall('circle', [1, 2, 3, 'redd']).error).toEqual({
      kind: 'ValueError',
      message:
        "circle(): 'redd' isn't a colour I know. Try a name like 'red' or a hex code like '#ff0000'",
    })
    expect(validateStageCall('circle', [1, 2, -3, 'red']).error.message).toBe(
      "circle(): r (the radius) can't be negative, not -3"
    )
    expect(validateStageCall('background', [7]).error.message).toBe(
      "background(): colour should be a colour in quotes, a name like 'red' or a hex code like '#ff0000', not 7"
    )
    expect(validateStageCall('rect', [true, 0, 1, 1, 'red']).error.message).toBe(
      'rect(): x should be a number, like 50, not True'
    )
    expect(validateStageCall('rect', [{ __hs_type__: 'set' }, 0, 1, 1, 'red']).error.message).toBe(
      'rect(): x should be a number, like 50, not a set'
    )
    expect(validateStageCall('stamp', ['', 1, 1]).error.kind).toBe('TypeError')
    expect(validateStageCall('spiral', []).error.kind).toBe('TypeError')
  })

  describe('grid', () => {
    it('indexes the palette, sizes cells to fit and keeps None as nothing drawn', () => {
      const { command } = validateStageCall('grid', [
        [
          [0, 1],
          [1, null],
        ],
        ['white', 'red'],
        null,
        0,
        0,
      ])
      expect(command).toEqual({
        type: 'grid',
        x: 0,
        y: 0,
        cell: 200,
        colours: ['#ffffff', '#ff0000'],
        cells: [
          [0, 1],
          [1, -1],
        ],
      })
    })

    it('reads numbers as the PICO-8 colours without a palette, and colour names as colours', () => {
      const { command } = validateStageCall('grid', [[[8, 'blue', 'none']], null, 10, 5, 5])
      expect(command.colours).toEqual(['#ff004d', '#0000ff'])
      expect(command.cells).toEqual([[0, 1, -1]])
      expect(command.cell).toBe(10)
    })

    it('explains a number the palette has no colour for', () => {
      expect(validateStageCall('grid', [[[0, 2]], ['white', 'red']]).error.message).toBe(
        'grid(): rows[0][1] is 2, but the palette only has 2 colours (numbers 0 to 1)'
      )
      expect(validateStageCall('grid', [[[16]]]).error.message).toBe(
        'grid(): rows[0][0] is 16, but without a palette the numbers are the 16 Arcade colours, 0 to 15'
      )
    })

    it('rejects shapes that are not a list of lists, and huge grids', () => {
      expect(validateStageCall('grid', ['0101']).error.kind).toBe('TypeError')
      expect(validateStageCall('grid', [['0101']]).error.message).toBe(
        "grid(): rows[0] should be a list, like [0, 1, 0], not the text '0101'"
      )
      const tall = Array.from({ length: 101 }, () => [0])
      expect(validateStageCall('grid', [tall]).error.message).toBe(
        'grid(): the grid has 101 rows — the most is 100'
      )
    })
  })
})

describe('createStageRecorder', () => {
  it('records drawn commands and returns errors for Python to raise', () => {
    const recorder = createStageRecorder()
    expect(recorder.call('rect', [0, 0, 10, 10, 'red'])).toBe('')
    expect(recorder.call('rect', [0, 0, 10, 10, 'nope'])).toMatch(/^ValueError\|rect\(\): 'nope'/)
    expect(recorder.commands).toHaveLength(1)
  })

  it('stops an endless drawing loop with a plain message', () => {
    const recorder = createStageRecorder()
    for (let i = 0; i < MAX_STAGE_COMMANDS; i++) recorder.call('clear', [])
    expect(recorder.call('clear', [])).toBe(
      'RuntimeError|The stage stopped after 20,000 drawing commands — is a loop drawing forever?'
    )
    expect(recorder.commands).toHaveLength(MAX_STAGE_COMMANDS)
  })
})

describe('visibleCommands / stageHasDrawing', () => {
  it('keeps what comes after the last clear', () => {
    const commands = [{ type: 'rect' }, { type: 'clear' }, { type: 'circle' }]
    expect(visibleCommands(commands)).toEqual([{ type: 'circle' }])
    expect(stageHasDrawing({ commands })).toBe(true)
    expect(stageHasDrawing({ commands: [] })).toBe(false)
    expect(stageHasDrawing(null)).toBe(false)
  })
})

describe('the stage Python module source', () => {
  it('defines every stage function and exports them for import *', () => {
    for (const name of STAGE_FUNCTIONS) {
      expect(STAGE_MODULE_PY).toContain(`def ${name}(`)
      expect(STAGE_MODULE_PY).toContain(`'${name}'`)
    }
    expect(STAGE_INSTALL_PY).toContain("_hs_sys.modules['stage']")
    expect(STAGE_INSTALL_PY).toContain("'<stage>'")
  })
})
