import { describe, expect, it } from 'vitest'
import {
  createStageRecorder,
  DEFAULT_SHAPE_COLOUR,
  MAX_STAGE_COMMANDS,
  readStageCallPayload,
  stageHue,
  STAGE_FUNCTIONS,
  stageHasDrawing,
  validateStageCall,
  visibleCommands,
} from '../commands.js'
import { STAGE_INSTALL_PY, STAGE_MODULE_PY } from '../stagePy.js'

describe('validateStageCall', () => {
  it('builds each command with colours as hex, size first and centred', () => {
    expect(validateStageCall('background', ['navy'])).toEqual({
      command: { type: 'background', colour: '#000080' },
    })
    expect(validateStageCall('rect', [30, 40, 'red'], { x: 10, y: 20 })).toEqual({
      command: { type: 'rect', x: 10, y: 20, w: 30, h: 40, colour: '#ff0000' },
    })
    expect(validateStageCall('circle', [50, '#00f'])).toEqual({
      command: { type: 'circle', x: 200, y: 200, r: 50, colour: '#0000ff' },
    })
    expect(validateStageCall('square', [80, 'gold', 100, 80])).toEqual({
      command: { type: 'square', x: 100, y: 80, size: 80, colour: '#ffd700' },
    })
    expect(validateStageCall('polygon', [6, 60], { colour: 'teal' })).toEqual({
      command: { type: 'polygon', x: 200, y: 200, sides: 6, size: 60, colour: '#008080' },
    })
    expect(validateStageCall('line', [0, 0, 400, 400, 'black'])).toEqual({
      command: { type: 'line', x1: 0, y1: 0, x2: 400, y2: 400, colour: '#000000', width: 2 },
    })
    expect(validateStageCall('text', ['Hi', 'black', 5, 6, 20])).toEqual({
      command: { type: 'text', x: 5, y: 6, text: 'Hi', colour: '#000000', size: 20 },
    })
    expect(validateStageCall('stamp', ['⭐', 100, 120])).toEqual({
      command: { type: 'stamp', emoji: '⭐', x: 100, y: 120, size: 32 },
    })
    expect(validateStageCall('clear', [])).toEqual({ command: { type: 'clear' } })
  })

  it('uses the documented default colours and the middle of the stage', () => {
    expect(DEFAULT_SHAPE_COLOUR).toBe('#4169e1')
    expect(validateStageCall('circle', [50]).command).toEqual({
      type: 'circle',
      x: 200,
      y: 200,
      r: 50,
      colour: DEFAULT_SHAPE_COLOUR,
    })
    expect(validateStageCall('text', ['Hello']).command).toEqual({
      type: 'text',
      x: 200,
      y: 200,
      text: 'Hello',
      colour: '#000000',
      size: 16,
    })
    expect(validateStageCall('line', [0, 0, 10, 10]).command.colour).toBe('#000000')
  })

  it('reads angle, opacity, outline, width, color= and colour=None', () => {
    expect(
      validateStageCall('square', [80], {
        angle: 405,
        opacity: 0.5,
        outline: 'black',
        color: 'red',
      }).command
    ).toEqual({
      type: 'square',
      x: 200,
      y: 200,
      size: 80,
      colour: '#ff0000',
      angle: 45,
      opacity: 0.5,
      outline: '#000000',
      width: 2,
    })
    expect(
      validateStageCall('polygon', [5, 40], { colour: null, outline: 'red', width: 6 }).command
    ).toEqual({
      type: 'polygon',
      x: 200,
      y: 200,
      sides: 5,
      size: 40,
      colour: null,
      outline: '#ff0000',
      width: 6,
    })
    // Defaults are left out: angle 0 (or a whole turn) and opacity 1.
    expect(validateStageCall('circle', [10], { angle: -360, opacity: 1 }).command).toEqual({
      type: 'circle',
      x: 200,
      y: 200,
      r: 10,
      colour: DEFAULT_SHAPE_COLOUR,
    })
    expect(validateStageCall('stamp', ['⭐'], { angle: -90, opacity: 0.2 }).command).toEqual({
      type: 'stamp',
      emoji: '⭐',
      x: 200,
      y: 200,
      size: 32,
      angle: 270,
      opacity: 0.2,
    })
    expect(validateStageCall('line', [0, 0, 1, 1], { opacity: 0.5 }).command.opacity).toBe(0.5)
  })

  it('explains the old position-first order in plain English', () => {
    expect(validateStageCall('circle', [200, 200, 50]).error).toEqual({
      kind: 'TypeError',
      message:
        "circle(): the second value is the colour, like 'red'. To place it, write x=200, y=200, like circle(50, x=200, y=200)",
    })
    expect(validateStageCall('circle', [200, 200, 50, 'red']).error.message).toBe(
      "circle(): the second value is the colour, like 'red'. To place it, write x=200, y=200, like circle(50, 'red', x=200, y=200)"
    )
    // An old rect gave its top-left corner; the new x, y are its middle.
    expect(validateStageCall('rect', [10, 20, 30, 40, 'red']).error.message).toBe(
      "rect(): the third value is the colour, like 'red'. To place it, write x=25, y=40, like rect(30, 40, 'red', x=25, y=40)"
    )
    // text() turns its words into a string in Python, so an old x arrives as '10'.
    expect(validateStageCall('text', ['10', 20, 'Hi', 'red']).error.message).toBe(
      "text(): the second value is the colour, like 'red'. To place it, write x=10, y=20, like text('Hi', 'red', x=10, y=20)"
    )
    expect(validateStageCall('square', [80, 100]).error.message).toBe(
      "square(): the second value is the colour, like 'red'. To place it, write x= and y=, like square(80, 'red', x=100, y=80)"
    )
    expect(validateStageCall('polygon', [6, 'red']).error.message).toBe(
      "polygon(): the second value is the size, like polygon(6, 60). Put the colour after it, like polygon(6, 60, 'red')"
    )
  })

  it('names the argument and what was given, in plain words', () => {
    expect(validateStageCall('rect', [30, 40], { x: 10, y: '20' }).error).toEqual({
      kind: 'TypeError',
      message: "rect(): y should be a number, like 200, not the text '20'",
    })
    expect(validateStageCall('circle', [3, 'redd']).error).toEqual({
      kind: 'ValueError',
      message:
        "circle(): 'redd' isn't a colour I know. Try a name like 'red' or a hex code like '#ff0000'",
    })
    expect(validateStageCall('circle', [-3, 'red']).error.message).toBe(
      "circle(): r (the radius) can't be negative, not -3"
    )
    expect(validateStageCall('background', [7]).error.message).toBe(
      "background(): colour should be a colour in quotes, a name like 'red' or a hex code like '#ff0000', not 7"
    )
    expect(validateStageCall('circle', [true]).error.message).toBe(
      'circle(): r (the radius) should be a number, like 50, not True'
    )
    expect(validateStageCall('square', [{ __hs_type__: 'set' }]).error.message).toBe(
      'square(): size should be a number, like 80, not a set'
    )
    expect(validateStageCall('stamp', ['', 1, 1]).error.kind).toBe('TypeError')
    expect(validateStageCall('spiral', []).error.kind).toBe('TypeError')
  })

  it('explains missing values, extra values and unknown keywords', () => {
    expect(validateStageCall('circle', []).error.message).toBe(
      'circle() needs a radius, like circle(50)'
    )
    expect(validateStageCall('rect', [120]).error.message).toBe(
      'rect() needs a height, like rect(120, 60)'
    )
    expect(validateStageCall('polygon', []).error.message).toBe(
      'polygon() needs a number of sides and a size, like polygon(6, 60)'
    )
    expect(validateStageCall('circle', [1, 'red', 2, 3, 4]).error.message).toBe(
      'circle() takes at most 4 values in order (r, colour, x, y) — you gave 5. Give the others by name, like x=100'
    )
    expect(validateStageCall('square', [80], { rotation: 45 }).error.message).toBe(
      'square() has no rotation= — did you mean angle=?'
    )
    expect(validateStageCall('grid', [[[0]]], { angle: 45 }).error.message).toBe(
      'grid() has no angle= — it understands rows=, palette=, cell=, x=, y='
    )
    expect(validateStageCall('circle', [50, 'red'], { colour: 'blue' }).error.message).toBe(
      'circle() got colour twice: once as the second value and once as colour='
    )
  })

  it('checks the new keywords', () => {
    expect(validateStageCall('square', [80], { opacity: 2 }).error.message).toBe(
      'square(): opacity goes from 0 (invisible) to 1 (solid), like opacity=0.5, not 2'
    )
    expect(validateStageCall('square', [80], { angle: 'left' }).error.message).toBe(
      "square(): angle should be a number, like 45, not the text 'left'"
    )
    expect(validateStageCall('square', [80], { width: 4 }).error.message).toBe(
      "square(): width= is how thick the outline is, so it needs an outline too, like outline='black', width=4"
    )
    expect(validateStageCall('circle', [50], { colour: null }).error.message).toBe(
      "circle(): with colour=None and no outline nothing would show — give it a colour, or an outline like outline='black'"
    )
    expect(validateStageCall('polygon', [2, 50]).error.message).toBe(
      'polygon(): sides should be a whole number from 3 to 100, like 6 for a hexagon, not 2'
    )
    expect(validateStageCall('text', ['Hi'], { outline: 'red' }).error.kind).toBe('TypeError')
  })

  describe('grid', () => {
    it('indexes the palette, sizes cells to fit and keeps None as nothing drawn', () => {
      const { command } = validateStageCall('grid', [
        [
          [0, 1],
          [1, null],
        ],
        ['white', 'red'],
      ])
      // Centred on the middle by default: x, y in the command are its top-left corner.
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
      const { command } = validateStageCall('grid', [[[8, 'blue', 'none']], null, 10, 50, 60])
      expect(command.colours).toEqual(['#ff004d', '#0000ff'])
      expect(command.cells).toEqual([[0, 1, -1]])
      expect(command.cell).toBe(10)
      // 3 columns × 1 row of 10-pixel cells centred on (50, 60).
      expect(command.x).toBe(35)
      expect(command.y).toBe(55)
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

describe('stageHue', () => {
  it('goes round the colour wheel and wraps every 360', () => {
    expect(stageHue([0]).value).toBe('#ff0000')
    expect(stageHue([120]).value).toBe('#00ff00')
    expect(stageHue([240]).value).toBe('#0000ff')
    expect(stageHue([360]).value).toBe('#ff0000')
    expect(stageHue([-120]).value).toBe('#0000ff')
    expect(stageHue([60]).value).toBe('#ffff00')
  })

  it('makes paler and darker shades with light', () => {
    expect(stageHue([0], { light: 75 }).value).toBe('#ff8080')
    expect(stageHue([0, 25]).value).toBe('#800000')
    expect(stageHue([0], { light: 100 }).value).toBe('#ffffff')
    expect(stageHue([0], { light: 0 }).value).toBe('#000000')
  })

  it('explains a bad value', () => {
    expect(stageHue([]).error.message).toBe('hue() needs n, like hue(120)')
    expect(stageHue(['red']).error.message).toBe(
      "hue(): n should be a number, like 120, not the text 'red'"
    )
    expect(stageHue([0], { light: 150 }).error.message).toBe(
      'hue(): light goes from 0 (black) to 100 (white), with 50 the full colour, not 150'
    )
  })
})

describe('readStageCallPayload', () => {
  it('reads { args, kwargs } and a bare list', () => {
    expect(readStageCallPayload({ args: [50], kwargs: { angle: 45 } })).toEqual({
      args: [50],
      kwargs: { angle: 45 },
    })
    expect(readStageCallPayload([1, 2])).toEqual({ args: [1, 2], kwargs: {} })
    expect(readStageCallPayload(null)).toEqual({ args: [], kwargs: {} })
  })
})

describe('createStageRecorder', () => {
  it('records drawn commands and returns errors for Python to raise', () => {
    const recorder = createStageRecorder()
    expect(recorder.call('rect', [10, 10, 'red'])).toBe('')
    expect(recorder.call('rect', [10, 10, 'nope'])).toMatch(/^ValueError\|rect\(\): 'nope'/)
    expect(recorder.call('square', [10], { angle: 30 })).toBe('')
    expect(recorder.commands).toHaveLength(2)
    expect(recorder.commands[1].angle).toBe(30)
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
    for (const name of [...STAGE_FUNCTIONS, 'hue']) {
      expect(STAGE_MODULE_PY).toContain(`def ${name}(*args, **kwargs):`)
      expect(STAGE_MODULE_PY).toContain(`'${name}'`)
    }
    expect(STAGE_MODULE_PY).toContain('__hsStageHue')
    expect(STAGE_INSTALL_PY).toContain("_hs_sys.modules['stage']")
    expect(STAGE_INSTALL_PY).toContain("'<stage>'")
  })
})
