// The Python Stage's command model (src/shared/stage/). Pure and Node-safe.
//
// The `stage` Python module (stagePy.js) hands every call to the worker's JS bridge as
// (name, JSON args); validateStageCall turns it into one plain, serialisable command or a
// friendly error the Python side raises. A run's drawing is the ordered command list:
//
//   { type: 'background', colour }                       fills the whole stage
//   { type: 'rect', x, y, w, h, colour }                 top-left corner, width, height
//   { type: 'circle', x, y, r, colour }                  centre and radius
//   { type: 'line', x1, y1, x2, y2, colour, width }
//   { type: 'text', x, y, text, colour, size }           top-left of the text
//   { type: 'stamp', emoji, x, y, size }                 centre of the emoji
//   { type: 'grid', x, y, cell, colours, cells }         cells[row][col] indexes colours
//                                                        (-1 = nothing drawn there)
//   { type: 'clear' }                                    wipes the stage back to white
//
// Colours are '#rrggbb'. Coordinates: top-left origin, x to the right, y DOWN, on a fixed
// 400 × 400 stage. Commands are never pruned (clear() is a command too), so a step-by-step
// player (slow-mo) can replay a prefix: the picture after N steps is commands.slice(0, N).
import { PICO8_PALETTE, isTransparentColour, parseColour } from './colours.js'

export const STAGE_SIZE = 400
export const STAGE_BACKGROUND = '#ffffff'
// A run that draws more than this stops with a plain message (an endless drawing loop).
export const MAX_STAGE_COMMANDS = 20000
export const MAX_GRID_SIDE = 100
// Every grid's cells added up, per run.
export const MAX_GRID_CELLS = 200000
export const MAX_TEXT_CHARS = 200
export const MAX_EMOJI_CHARS = 16

export const STAGE_FUNCTIONS = Object.freeze([
  'background',
  'rect',
  'circle',
  'line',
  'text',
  'stamp',
  'grid',
  'clear',
])

// Shape kinds a stage_shape_count check can count ('any' = every drawn command).
export const STAGE_SHAPE_KINDS = Object.freeze(['rect', 'circle', 'line', 'text', 'stamp', 'grid'])

const COLOUR_EXAMPLE = "a name like 'red' or a hex code like '#ff0000'"

function given(value) {
  if (value === null || value === undefined) return 'None'
  if (value === true) return 'True'
  if (value === false) return 'False'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') {
    const clipped = value.length > 30 ? `${value.slice(0, 30)}…` : value
    return `the text '${clipped}'`
  }
  if (Array.isArray(value)) return 'a list'
  if (typeof value === 'object' && typeof value.__hs_type__ === 'string') {
    return `a ${value.__hs_type__}`
  }
  return 'something else'
}

class StageArgError extends Error {
  constructor(kind, message) {
    super(message)
    this.kind = kind
  }
}

function typeError(message) {
  return new StageArgError('TypeError', message)
}

function valueError(message) {
  return new StageArgError('ValueError', message)
}

function number(fn, name, value, { example = '50' } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw typeError(`${fn}(): ${name} should be a number, like ${example}, not ${given(value)}`)
  }
  return value
}

function atLeast(fn, name, value, min, what) {
  if (value < min) throw valueError(`${fn}(): ${name} ${what}, not ${value}`)
  return value
}

function colour(fn, name, value) {
  if (typeof value !== 'string') {
    throw typeError(
      `${fn}(): ${name} should be a colour in quotes, ${COLOUR_EXAMPLE}, not ${given(value)}`
    )
  }
  const hex = parseColour(value)
  if (!hex) {
    throw valueError(
      `${fn}(): '${value.length > 30 ? `${value.slice(0, 30)}…` : value}' isn't a colour I know. Try ${COLOUR_EXAMPLE}`
    )
  }
  return hex
}

function argCount(fn, args, min, max, names) {
  if (args.length < min || args.length > max) {
    const wanted = names.slice(0, max).join(', ')
    throw typeError(
      `${fn}() takes ${wanted} — you gave ${args.length} value${args.length === 1 ? '' : 's'}`
    )
  }
}

// A grid cell's value → an index into `colours` (adding colours as they turn up), or -1.
function gridCell(fn, value, where, palette, colours, colourIndex) {
  if (value === null || value === undefined) return -1
  if (typeof value === 'string') {
    if (isTransparentColour(value) || !value.trim()) return -1
    const hex = parseColour(value)
    if (!hex) {
      throw valueError(
        `${fn}(): ${where} is '${value}', which isn't a colour I know. Try ${COLOUR_EXAMPLE}`
      )
    }
    return colourIndex(hex)
  }
  let index = value
  if (typeof value === 'boolean') index = value ? 1 : 0
  if (typeof index !== 'number' || !Number.isInteger(index)) {
    throw typeError(`${fn}(): ${where} should be a whole number or a colour, not ${given(value)}`)
  }
  const list = palette ?? PICO8_PALETTE
  if (index < 0 || index >= list.length) {
    throw valueError(
      palette
        ? `${fn}(): ${where} is ${index}, but the palette only has ${list.length} colour${list.length === 1 ? '' : 's'} (numbers 0 to ${list.length - 1})`
        : `${fn}(): ${where} is ${index}, but without a palette the numbers are the 16 Arcade colours, 0 to 15`
    )
  }
  const hex = list[index]
  return hex == null ? -1 : colourIndex(hex)
}

function buildGrid(fn, args) {
  const [rows, palette = null, cell = null, x = 0, y = 0] = args
  if (!Array.isArray(rows) || rows.length === 0) {
    throw typeError(
      `${fn}(): rows should be a list of rows, like [[0, 1], [1, 0]], not ${given(rows)}`
    )
  }
  if (rows.length > MAX_GRID_SIDE) {
    throw valueError(`${fn}(): the grid has ${rows.length} rows — the most is ${MAX_GRID_SIDE}`)
  }
  let cols = 0
  rows.forEach((row, r) => {
    if (!Array.isArray(row)) {
      throw typeError(`${fn}(): rows[${r}] should be a list, like [0, 1, 0], not ${given(row)}`)
    }
    cols = Math.max(cols, row.length)
  })
  if (cols === 0) throw valueError(`${fn}(): every row is empty — put some values in the rows`)
  if (cols > MAX_GRID_SIDE) {
    throw valueError(`${fn}(): the grid has ${cols} columns — the most is ${MAX_GRID_SIDE}`)
  }
  let paletteHex = null
  if (palette !== null && palette !== undefined) {
    if (!Array.isArray(palette) || palette.length === 0) {
      throw typeError(
        `${fn}(): palette should be a list of colours, like ["white", "red"], not ${given(palette)}`
      )
    }
    paletteHex = palette.map((entry, i) => {
      if (entry === null || entry === undefined || isTransparentColour(entry)) return null
      return colour(fn, `palette[${i}]`, entry)
    })
  }
  const cellSize =
    cell === null || cell === undefined
      ? STAGE_SIZE / Math.max(rows.length, cols)
      : atLeast(
          fn,
          'cell',
          number(fn, 'cell', cell, { example: '20' }),
          0.01,
          'should be more than 0'
        )
  const colours = []
  const lookup = new Map()
  const colourIndex = (hex) => {
    if (!lookup.has(hex)) {
      lookup.set(hex, colours.length)
      colours.push(hex)
    }
    return lookup.get(hex)
  }
  const cells = rows.map((row, r) =>
    row.map((value, c) => gridCell(fn, value, `rows[${r}][${c}]`, paletteHex, colours, colourIndex))
  )
  return {
    type: 'grid',
    x: number(fn, 'x', x),
    y: number(fn, 'y', y),
    cell: cellSize,
    colours,
    cells,
  }
}

function buildCommand(name, args) {
  switch (name) {
    case 'background':
      argCount(name, args, 1, 1, ['colour'])
      return { type: 'background', colour: colour(name, 'colour', args[0]) }
    case 'rect': {
      argCount(name, args, 5, 5, ['x', 'y', 'w', 'h', 'colour'])
      const [x, y, w, h, c] = args
      return {
        type: 'rect',
        x: number(name, 'x', x),
        y: number(name, 'y', y),
        w: atLeast(name, 'w (the width)', number(name, 'w (the width)', w), 0, "can't be negative"),
        h: atLeast(
          name,
          'h (the height)',
          number(name, 'h (the height)', h),
          0,
          "can't be negative"
        ),
        colour: colour(name, 'colour', c),
      }
    }
    case 'circle': {
      argCount(name, args, 4, 4, ['x', 'y', 'r', 'colour'])
      const [x, y, r, c] = args
      return {
        type: 'circle',
        x: number(name, 'x', x),
        y: number(name, 'y', y),
        r: atLeast(
          name,
          'r (the radius)',
          number(name, 'r (the radius)', r),
          0,
          "can't be negative"
        ),
        colour: colour(name, 'colour', c),
      }
    }
    case 'line': {
      argCount(name, args, 5, 6, ['x1', 'y1', 'x2', 'y2', 'colour', 'width'])
      const [x1, y1, x2, y2, c, width = 2] = args
      return {
        type: 'line',
        x1: number(name, 'x1', x1),
        y1: number(name, 'y1', y1),
        x2: number(name, 'x2', x2),
        y2: number(name, 'y2', y2),
        colour: colour(name, 'colour', c),
        width: atLeast(
          name,
          'width',
          number(name, 'width', width, { example: '2' }),
          0.1,
          'should be more than 0'
        ),
      }
    }
    case 'text': {
      argCount(name, args, 4, 5, ['x', 'y', 'words', 'colour', 'size'])
      const [x, y, words, c, size = 16] = args
      const textValue = typeof words === 'string' ? words : given(words)
      return {
        type: 'text',
        x: number(name, 'x', x),
        y: number(name, 'y', y),
        text: textValue.length > MAX_TEXT_CHARS ? textValue.slice(0, MAX_TEXT_CHARS) : textValue,
        colour: colour(name, 'colour', c),
        size: atLeast(
          name,
          'size',
          number(name, 'size', size, { example: '16' }),
          1,
          'should be at least 1'
        ),
      }
    }
    case 'stamp': {
      argCount(name, args, 3, 4, ['emoji', 'x', 'y', 'size'])
      const [emoji, x, y, size = 32] = args
      if (typeof emoji !== 'string' || !emoji.trim()) {
        throw typeError(
          `stamp(): emoji should be an emoji in quotes, like "⭐", not ${given(emoji)}`
        )
      }
      if (emoji.length > MAX_EMOJI_CHARS) {
        throw valueError('stamp(): stamp one emoji at a time, like "⭐"')
      }
      return {
        type: 'stamp',
        emoji: emoji.trim(),
        x: number(name, 'x', x),
        y: number(name, 'y', y),
        size: atLeast(
          name,
          'size',
          number(name, 'size', size, { example: '32' }),
          1,
          'should be at least 1'
        ),
      }
    }
    case 'grid':
      argCount(name, args, 1, 5, ['rows', 'palette', 'cell', 'x', 'y'])
      return buildGrid(name, args)
    case 'clear':
      argCount(name, args, 0, 0, [])
      return { type: 'clear' }
    default:
      throw typeError(
        `The stage has no ${String(name)}() — use one of: ${STAGE_FUNCTIONS.join(', ')}`
      )
  }
}

/**
 * One stage call → `{ command }`, or `{ error: { kind, message } }` where kind is the Python
 * exception to raise ('TypeError' | 'ValueError'). `args` is the call's positional arguments
 * after JSON (Python None → null; values JSON can't carry arrive as { __hs_type__ }).
 */
export function validateStageCall(name, args) {
  try {
    return { command: buildCommand(name, Array.isArray(args) ? args : []) }
  } catch (err) {
    if (err instanceof StageArgError) return { error: { kind: err.kind, message: err.message } }
    throw err
  }
}

/**
 * A run's command log with the caps (MAX_STAGE_COMMANDS, MAX_GRID_CELLS). `call(name, args)`
 * returns '' when the command was drawn, or 'Kind|message' for Python to raise.
 */
export function createStageRecorder() {
  const commands = []
  let gridCells = 0
  return {
    commands,
    call(name, args) {
      const { command, error } = validateStageCall(name, args)
      if (error) return `${error.kind}|${error.message}`
      if (commands.length >= MAX_STAGE_COMMANDS) {
        return `RuntimeError|The stage stopped after ${MAX_STAGE_COMMANDS.toLocaleString('en-GB')} drawing commands — is a loop drawing forever?`
      }
      if (command.type === 'grid') {
        gridCells += command.cells.reduce((sum, row) => sum + row.length, 0)
        if (gridCells > MAX_GRID_CELLS) {
          return `RuntimeError|The stage stopped: the grids have more than ${MAX_GRID_CELLS.toLocaleString('en-GB')} cells altogether`
        }
      }
      commands.push(command)
      return ''
    },
  }
}

// The commands still on the stage: everything after the last clear().
export function visibleCommands(commands) {
  const list = Array.isArray(commands) ? commands : []
  let start = 0
  list.forEach((command, i) => {
    if (command?.type === 'clear') start = i + 1
  })
  return list.slice(start)
}

// Whether a run drew anything at all (the pane appears once the code draws).
export function stageHasDrawing(stage) {
  const commands = Array.isArray(stage) ? stage : stage?.commands
  return Array.isArray(commands) && commands.length > 0
}

// The stage result's command list, whatever wraps it ({ commands } or a bare list).
export function stageCommandsOf(stage) {
  if (Array.isArray(stage)) return stage
  return Array.isArray(stage?.commands) ? stage.commands : []
}
