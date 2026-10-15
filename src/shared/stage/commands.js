// The Python Stage's command model (src/shared/stage/). Pure and Node-safe.
//
// The `stage` Python module (stagePy.js) hands every call to the worker's JS bridge as
// (name, JSON { args, kwargs }); validateStageCall binds them to the function's parameters and
// turns them into one plain, serialisable command or a friendly error the Python side raises.
// A run's drawing is the ordered command list:
//
//   { type: 'background', colour }                       fills the whole stage
//   { type: 'rect', x, y, w, h, colour, …style }         centre, width, height
//   { type: 'square', x, y, size, colour, …style }       centre, side length
//   { type: 'circle', x, y, r, colour, …style }          centre and radius
//   { type: 'polygon', x, y, sides, size, colour, …style }  centre; size = centre to corner,
//                                                        one corner straight up at angle 0
//   { type: 'line', x1, y1, x2, y2, colour, width, opacity? }
//   { type: 'text', x, y, text, colour, size, angle?, opacity? }   centre of the text
//   { type: 'stamp', emoji, x, y, size, angle?, opacity? }         centre of the emoji
//   { type: 'grid', x, y, cell, colours, cells, wrap? }  x, y = the grid's TOP-LEFT corner
//                                                        (worked out from the centre the
//                                                        student gives); cells[row][col]
//                                                        indexes colours (-1 = nothing drawn);
//                                                        wrap = the width= a flat list was
//                                                        drawn with (rows of that many cells,
//                                                        the last row maybe short)
//   { type: 'clear' }                                    wipes the stage back to white
//
// …style on the filled shapes (rect, square, circle, polygon), each present only when it isn't
// the default: angle (degrees clockwise around the centre, 0–360), opacity (0–1, default 1),
// outline ('#rrggbb') and width (outline width, default 2 with an outline). `colour` is null
// for an outline-only shape (colour=None). See ./geometry.js.
//
// Colours are '#rrggbb'. Coordinates: top-left origin, x to the right, y DOWN, on a fixed
// 400 × 400 stage; every x, y a student writes is a centre, defaulting to the middle (200, 200).
// Commands are never pruned (clear() is a command too), so a step-by-step player (slow-mo) can
// replay a prefix: the picture after N steps is commands.slice(0, N).
import { PICO8_PALETTE, hueColour, isTransparentColour, parseColour } from './colours.js'

export const STAGE_SIZE = 400
export const STAGE_BACKGROUND = '#ffffff'
// Where a shape goes when no x, y is given: the middle of the stage.
export const STAGE_CENTRE = STAGE_SIZE / 2
// The fill of a shape with no colour given (royal blue: clear on white), and of text and lines.
export const DEFAULT_SHAPE_COLOUR = '#4169e1'
export const DEFAULT_INK_COLOUR = '#000000'
// A run that draws more than this stops with a plain message (an endless drawing loop).
export const MAX_STAGE_COMMANDS = 20000
export const MAX_GRID_SIDE = 100
// Every grid's cells added up, per run.
export const MAX_GRID_CELLS = 200000
export const MAX_TEXT_CHARS = 200
export const MAX_EMOJI_CHARS = 16
export const MAX_POLYGON_SIDES = 100

export const STAGE_FUNCTIONS = Object.freeze([
  'background',
  'rect',
  'square',
  'circle',
  'polygon',
  'line',
  'text',
  'stamp',
  'grid',
  'clear',
])

// Shape kinds a stage_shape_count check can count ('any' = every drawn command).
export const STAGE_SHAPE_KINDS = Object.freeze([
  'rect',
  'square',
  'circle',
  'polygon',
  'line',
  'text',
  'stamp',
  'grid',
])

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

// ── Binding a call's values to the function's parameters ────────────────────────────────────

const STYLE_KEYWORDS = ['angle', 'opacity', 'outline', 'width']

// Per function: the values it takes in order, how many must be given, the extra keyword-only
// names, what each needs in words (for a missing value) and a call to copy.
const SIGNATURES = {
  background: { positional: ['colour'], required: 1, example: "background('navy')" },
  circle: {
    positional: ['r', 'colour', 'x', 'y'],
    required: 1,
    keywords: STYLE_KEYWORDS,
    example: 'circle(50)',
  },
  square: {
    positional: ['size', 'colour', 'x', 'y'],
    required: 1,
    keywords: STYLE_KEYWORDS,
    example: 'square(80)',
  },
  rect: {
    positional: ['w', 'h', 'colour', 'x', 'y'],
    required: 2,
    keywords: STYLE_KEYWORDS,
    example: 'rect(120, 60)',
  },
  polygon: {
    positional: ['sides', 'size', 'colour', 'x', 'y'],
    required: 2,
    keywords: STYLE_KEYWORDS,
    example: 'polygon(6, 60)',
  },
  line: {
    positional: ['x1', 'y1', 'x2', 'y2', 'colour', 'width'],
    required: 4,
    keywords: ['opacity'],
    example: 'line(0, 0, 400, 400)',
  },
  text: {
    positional: ['words', 'colour', 'x', 'y', 'size'],
    required: 1,
    keywords: ['angle', 'opacity'],
    example: "text('Hello')",
  },
  stamp: {
    positional: ['emoji', 'x', 'y', 'size'],
    required: 1,
    keywords: ['angle', 'opacity'],
    example: 'stamp("⭐")',
  },
  grid: {
    positional: ['rows', 'palette', 'cell', 'x', 'y'],
    required: 1,
    keywords: ['width'],
    example: 'grid([[0, 1], [1, 0]])',
  },
  clear: { positional: [], required: 0, example: 'clear()' },
}

// A parameter's name in words, for "needs …" messages.
const NEEDS_WORDS = {
  colour: 'a colour',
  r: 'a radius',
  size: 'a size',
  w: 'a width',
  h: 'a height',
  sides: 'a number of sides',
  x1: 'x1',
  y1: 'y1',
  x2: 'x2',
  y2: 'y2',
  words: 'some words',
  emoji: 'an emoji',
  rows: 'a list of rows',
}

// Keywords a student might reach for, and the one the stage uses.
const KEYWORD_SUGGESTIONS = {
  rotation: 'angle',
  rotate: 'angle',
  turn: 'angle',
  heading: 'angle',
  alpha: 'opacity',
  transparency: 'opacity',
  border: 'outline',
  stroke: 'outline',
  fill: 'colour',
  radius: 'r',
  thickness: 'width',
  length: 'size',
}

const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth']

function joinWords(items) {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/**
 * The call's values by parameter name: `{ values, positionOf }`, where positionOf[name] is the
 * 0-based position the value was given at (undefined for a keyword). `color=` is read as
 * `colour=`.
 */
function bindCall(fn, signature, args, kwargs) {
  const { positional, required, keywords = [], example } = signature
  if (args.length > positional.length) {
    const names = positional.length ? ` (${positional.join(', ')})` : ''
    throw typeError(
      positional.length === 0
        ? `${fn}() takes no values — write ${example}`
        : `${fn}() takes at most ${positional.length} value${positional.length === 1 ? '' : 's'} in order${names} — you gave ${args.length}. Give the others by name, like x=100`
    )
  }
  const values = {}
  const positionOf = {}
  args.forEach((value, i) => {
    values[positional[i]] = value
    positionOf[positional[i]] = i
  })
  const allowed = [...positional, ...keywords]
  for (const [rawKey, value] of Object.entries(kwargs ?? {})) {
    const key = rawKey === 'color' && allowed.includes('colour') ? 'colour' : rawKey
    if (!allowed.includes(key)) {
      const suggestion = KEYWORD_SUGGESTIONS[key]
      const hint =
        suggestion && allowed.includes(suggestion)
          ? ` — did you mean ${suggestion}=?`
          : ` — it understands ${allowed.map((name) => `${name}=`).join(', ')}`
      throw typeError(`${fn}() has no ${key}=${hint}`)
    }
    if (Object.hasOwn(values, key)) {
      throw typeError(
        positionOf[key] !== undefined
          ? `${fn}() got ${key} twice: once as the ${ORDINALS[positionOf[key]] ?? 'next'} value and once as ${key}=`
          : `${fn}() got ${key} twice`
      )
    }
    values[key] = value
  }
  const missing = positional
    .slice(0, required)
    .filter((name) => values[name] === undefined || values[name] === null)
  if (missing.length > 0) {
    throw typeError(
      `${fn}() needs ${joinWords(missing.map((name) => NEEDS_WORDS[name] ?? name))}, like ${example}`
    )
  }
  return { values, positionOf }
}

function isNumberish(value) {
  return (
    (typeof value === 'number' && Number.isFinite(value)) ||
    (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)))
  )
}

function pyString(value) {
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

function tidy(value) {
  return String(Math.round(Number(value) * 100) / 100)
}

// The stage's old position-first order (before 2026-10-15), recognised so the error can show
// the same drawing written the new way: `{ x, y, call }` or null.
function oldOrderCall(fn, args) {
  const colourPart = (value) => (typeof value === 'string' ? `, ${pyString(value)}` : '')
  if (fn === 'circle' && args.length >= 3 && args.slice(0, 3).every(isNumberish)) {
    const [x, y, r, c] = args
    return { x, y, call: `circle(${r}${colourPart(c)}, x=${x}, y=${y})` }
  }
  if (fn === 'rect' && args.length >= 4 && args.slice(0, 4).every(isNumberish)) {
    const [x, y, w, h, c] = args
    const cx = tidy(Number(x) + Number(w) / 2)
    const cy = tidy(Number(y) + Number(h) / 2)
    return { x: cx, y: cy, call: `rect(${w}, ${h}${colourPart(c)}, x=${cx}, y=${cy})` }
  }
  if (fn === 'text' && args.length >= 3 && isNumberish(args[0]) && isNumberish(args[1])) {
    const [x, y, words, c] = args
    return { x, y, call: `text(${pyString(words)}${colourPart(c)}, x=${x}, y=${y})` }
  }
  return null
}

// A generic example of placing the shape, for a colour given in the wrong place.
const PLACED_EXAMPLES = {
  circle: "circle(50, 'red', x=100, y=80)",
  square: "square(80, 'red', x=100, y=80)",
  rect: "rect(120, 60, 'red', x=100, y=80)",
  polygon: "polygon(6, 60, 'red', x=100, y=80)",
  text: "text('Hello', 'red', x=100, y=80)",
  line: "line(0, 0, 400, 400, 'red')",
}

/**
 * The fill colour from the call: '#rrggbb', null for colour=None (outline only, when
 * `allowNone`), or `fallback` when none was given. A number where the colour goes is almost
 * always the old position-first order, so the message says how to place the shape instead.
 */
function fillColour(fn, { values, positionOf }, args, { fallback, allowNone = false }) {
  if (!Object.hasOwn(values, 'colour')) return fallback
  const value = values.colour
  if (value === null && allowNone) return null
  const at = positionOf.colour
  if (at !== undefined && typeof value === 'number') {
    const old = oldOrderCall(fn, args)
    const ordinal = ORDINALS[at]
    if (fn === 'line') {
      throw typeError(
        `${fn}(): the ${ordinal} value is the colour, like 'red'. A line takes x1, y1, x2, y2 and then its colour, like ${PLACED_EXAMPLES.line}`
      )
    }
    if (old) {
      throw typeError(
        `${fn}(): the ${ordinal} value is the colour, like 'red'. To place it, write x=${old.x}, y=${old.y}, like ${old.call}`
      )
    }
    throw typeError(
      `${fn}(): the ${ordinal} value is the colour, like 'red'. To place it, write x= and y=, like ${PLACED_EXAMPLES[fn] ?? `${fn}(…, x=100, y=80)`}`
    )
  }
  return colour(fn, 'colour', value)
}

function position(fn, values, name) {
  const value = values[name]
  if (value === undefined || value === null) return STAGE_CENTRE
  return number(fn, name, value, { example: '200' })
}

// { x, y }: the centre the call gives, or the middle of the stage. Read after the colour, so an
// old position-first call is explained by its colour rather than by a stray x or y.
function centreOf(fn, values) {
  return { x: position(fn, values, 'x'), y: position(fn, values, 'y') }
}

function size(fn, values, name, label, { example = '50', fallback } = {}) {
  const value = values[name]
  if ((value === undefined || value === null) && fallback !== undefined) return fallback
  return atLeast(fn, label, number(fn, label, value, { example }), 0, "can't be negative")
}

/**
 * angle, opacity, outline and width for a filled shape, text or stamp: only the ones that
 * differ from the defaults, ready to spread into the command.
 */
function styleOf(fn, values, { outlines = true } = {}) {
  const style = {}
  if (values.angle !== undefined && values.angle !== null) {
    const angle = number(fn, 'angle', values.angle, { example: '45' })
    const turned = ((angle % 360) + 360) % 360
    if (turned !== 0) style.angle = turned
  }
  if (values.opacity !== undefined && values.opacity !== null) {
    const opacity = number(fn, 'opacity', values.opacity, { example: '0.5' })
    if (opacity < 0 || opacity > 1) {
      throw valueError(
        `${fn}(): opacity goes from 0 (invisible) to 1 (solid), like opacity=0.5, not ${opacity}`
      )
    }
    if (opacity < 1) style.opacity = opacity
  }
  if (!outlines) return style
  if (values.outline !== undefined && values.outline !== null) {
    style.outline = colour(fn, 'outline', values.outline)
    style.width = 2
  }
  if (values.width !== undefined && values.width !== null) {
    if (!style.outline) {
      throw valueError(
        `${fn}(): width= is how thick the outline is, so it needs an outline too, like outline='black', width=4`
      )
    }
    style.width = atLeast(
      fn,
      'width',
      number(fn, 'width', values.width, { example: '4' }),
      0.1,
      'should be more than 0'
    )
  }
  return style
}

// A filled shape's fill + style, checking that something would show.
function filledShape(fn, bound, args) {
  const fill = fillColour(fn, bound, args, { fallback: DEFAULT_SHAPE_COLOUR, allowNone: true })
  const style = styleOf(fn, bound.values)
  if (fill === null && !style.outline) {
    throw valueError(
      `${fn}(): with colour=None and no outline nothing would show — give it a colour, or an outline like outline='black'`
    )
  }
  return { colour: fill, ...style }
}

// ── Grids ───────────────────────────────────────────────────────────────────────────────────

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

// A flat list (no item is a list) drawn with width= → its rows of `width` cells, left to right,
// top to bottom (the last row may be short). `label` is the student's name for the list, when
// the stage module could tell (see readStageCallPayload).
function flatRows(fn, values, width, label) {
  const name = label ?? 'the list'
  if (width === undefined || width === null) {
    throw typeError(
      `${fn}(): ${label ? `${label} is` : 'the values are'} one long list. Say how many squares fit in a row, like grid(${label ?? 'pixels'}, width=8)`
    )
  }
  if (typeof width !== 'number' || !Number.isFinite(width)) {
    throw typeError(
      `${fn}(): width is how many squares fit in a row, a whole number like width=8, not ${given(width)}`
    )
  }
  if (!Number.isInteger(width) || width < 1) {
    throw valueError(
      `${fn}(): width is how many squares fit in a row, so it should be a whole number of 1 or more, like width=8, not ${width}`
    )
  }
  if (values.length === 0) {
    throw valueError(`${fn}(): ${name} is empty — put some values in it`)
  }
  const rows = []
  for (let i = 0; i < values.length; i += width) rows.push(values.slice(i, i + width))
  return rows
}

function buildGrid(fn, values, { label = null } = {}) {
  const { palette = null, cell = null, width } = values
  let { rows } = values
  const flat = Array.isArray(rows) && rows.length > 0 && !rows.some(Array.isArray)
  let wrap = null
  if (flat) {
    rows = flatRows(fn, rows, width, label)
    wrap = width
  } else if (Array.isArray(rows) && rows.length > 0 && width !== undefined && width !== null) {
    throw typeError(
      `${fn}(): width= is only for one long list. ${label ?? 'This'} is already a list of rows, so take out width=`
    )
  }
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
  // A flat list's cells are named by their place in it: pixels[9].
  const where = (r, c) => (wrap ? `${label ?? 'values'}[${r * wrap + c}]` : `rows[${r}][${c}]`)
  const cells = rows.map((row, r) =>
    row.map((value, c) => gridCell(fn, value, where(r, c), paletteHex, colours, colourIndex))
  )
  // The student gives the grid's centre; the command keeps its top-left corner.
  const cx = position(fn, values, 'x')
  const cy = position(fn, values, 'y')
  return {
    type: 'grid',
    x: cx - (cols * cellSize) / 2,
    y: cy - (rows.length * cellSize) / 2,
    cell: cellSize,
    colours,
    cells,
    ...(wrap ? { wrap } : {}),
  }
}

// ── Commands ────────────────────────────────────────────────────────────────────────────────

function buildCommand(name, args, kwargs, { label = null } = {}) {
  const signature = Object.hasOwn(SIGNATURES, name) ? SIGNATURES[name] : null
  if (!signature) {
    throw typeError(
      `The stage has no ${String(name)}() — use one of: ${STAGE_FUNCTIONS.join(', ')}, hue`
    )
  }
  const bound = bindCall(name, signature, args, kwargs)
  const { values } = bound
  switch (name) {
    case 'background':
      return { type: 'background', colour: colour(name, 'colour', values.colour) }
    case 'circle': {
      const r = size(name, values, 'r', 'r (the radius)')
      const look = filledShape(name, bound, args)
      return { type: 'circle', ...centreOf(name, values), r, ...look }
    }
    case 'square': {
      const side = size(name, values, 'size', 'size', { example: '80' })
      const look = filledShape(name, bound, args)
      return { type: 'square', ...centreOf(name, values), size: side, ...look }
    }
    case 'rect': {
      const w = size(name, values, 'w', 'w (the width)', { example: '120' })
      const h = size(name, values, 'h', 'h (the height)', { example: '60' })
      const look = filledShape(name, bound, args)
      return { type: 'rect', ...centreOf(name, values), w, h, ...look }
    }
    case 'polygon': {
      const sides = number(name, 'sides', values.sides, { example: '6' })
      if (!Number.isInteger(sides) || sides < 3 || sides > MAX_POLYGON_SIDES) {
        throw valueError(
          `${name}(): sides should be a whole number from 3 to ${MAX_POLYGON_SIDES}, like 6 for a hexagon, not ${sides}`
        )
      }
      if (typeof values.size === 'string') {
        throw typeError(
          `${name}(): the second value is the size, like polygon(${sides}, 60). Put the colour after it, like polygon(${sides}, 60, ${pyString(values.size)})`
        )
      }
      const side = size(name, values, 'size', 'size', { example: '60' })
      const look = filledShape(name, bound, args)
      return { type: 'polygon', ...centreOf(name, values), sides, size: side, ...look }
    }
    case 'line': {
      const command = {
        type: 'line',
        x1: number(name, 'x1', values.x1),
        y1: number(name, 'y1', values.y1),
        x2: number(name, 'x2', values.x2),
        y2: number(name, 'y2', values.y2),
        colour: fillColour(name, bound, args, { fallback: DEFAULT_INK_COLOUR }),
        width:
          values.width === undefined || values.width === null
            ? 2
            : atLeast(
                name,
                'width',
                number(name, 'width', values.width, { example: '2' }),
                0.1,
                'should be more than 0'
              ),
      }
      return { ...command, ...styleOf(name, values, { outlines: false }) }
    }
    case 'text': {
      const fill = fillColour(name, bound, args, { fallback: DEFAULT_INK_COLOUR })
      const words = values.words
      const textValue =
        typeof words === 'string' ? words : typeof words === 'number' ? String(words) : given(words)
      return {
        type: 'text',
        x: position(name, values, 'x'),
        y: position(name, values, 'y'),
        text: textValue.length > MAX_TEXT_CHARS ? textValue.slice(0, MAX_TEXT_CHARS) : textValue,
        colour: fill,
        size:
          values.size === undefined || values.size === null
            ? 16
            : atLeast(
                name,
                'size',
                number(name, 'size', values.size, { example: '16' }),
                1,
                'should be at least 1'
              ),
        ...styleOf(name, values, { outlines: false }),
      }
    }
    case 'stamp': {
      const { emoji } = values
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
        x: position(name, values, 'x'),
        y: position(name, values, 'y'),
        size:
          values.size === undefined || values.size === null
            ? 32
            : atLeast(
                name,
                'size',
                number(name, 'size', values.size, { example: '32' }),
                1,
                'should be at least 1'
              ),
        ...styleOf(name, values, { outlines: false }),
      }
    }
    case 'grid':
      return buildGrid(name, values, { label })
    case 'clear':
      return { type: 'clear' }
    default:
      return null
  }
}

function plainKwargs(kwargs) {
  return kwargs && typeof kwargs === 'object' && !Array.isArray(kwargs) ? kwargs : {}
}

/**
 * One stage call → `{ command }`, or `{ error: { kind, message } }` where kind is the Python
 * exception to raise ('TypeError' | 'ValueError'). `args` is the call's positional arguments and
 * `kwargs` its keyword arguments, after JSON (Python None → null; values JSON can't carry arrive
 * as { __hs_type__ }). `options.label` is the student's name for the first value (grid()'s
 * list), used in its messages when known.
 */
export function validateStageCall(name, args, kwargs = {}, { label = null } = {}) {
  try {
    return {
      command: buildCommand(name, Array.isArray(args) ? args : [], plainKwargs(kwargs), {
        label: stageLabel(label),
      }),
    }
  } catch (err) {
    if (err instanceof StageArgError) return { error: { kind: err.kind, message: err.message } }
    throw err
  }
}

/**
 * hue(n, light=50) → `{ value: '#rrggbb' }` or `{ error: { kind, message } }`. Draws nothing;
 * the colour goes back to Python as a string (see hueColour in ./colours.js).
 */
export function stageHue(args, kwargs = {}) {
  try {
    const bound = bindCall(
      'hue',
      { positional: ['n', 'light'], required: 1, example: 'hue(120)' },
      Array.isArray(args) ? args : [],
      plainKwargs(kwargs)
    )
    const n = number('hue', 'n', bound.values.n, { example: '120' })
    let light = 50
    if (bound.values.light !== undefined && bound.values.light !== null) {
      light = number('hue', 'light', bound.values.light)
      if (light < 0 || light > 100) {
        throw valueError(
          `hue(): light goes from 0 (black) to 100 (white), with 50 the full colour, not ${light}`
        )
      }
    }
    return { value: hueColour(n, light) }
  } catch (err) {
    if (err instanceof StageArgError) return { error: { kind: err.kind, message: err.message } }
    throw err
  }
}

// A variable name the stage module found for a call's first value, or null.
function stageLabel(label) {
  return typeof label === 'string' && /^[A-Za-z_][A-Za-z0-9_]{0,39}$/.test(label) ? label : null
}

/**
 * The bridge's JSON for one call → { args, kwargs, label }. Accepts `{ args, kwargs, label? }`
 * or a bare list of positional arguments. `label` is the student's variable name for the first
 * value (grid() sends it, for "pixels is one long list"), or null.
 */
export function readStageCallPayload(payload) {
  if (Array.isArray(payload)) return { args: payload, kwargs: {}, label: null }
  return {
    args: Array.isArray(payload?.args) ? payload.args : [],
    kwargs: plainKwargs(payload?.kwargs),
    label: stageLabel(payload?.label),
  }
}

/**
 * A run's command log with the caps (MAX_STAGE_COMMANDS, MAX_GRID_CELLS). `call(name, args,
 * kwargs)` returns '' when the command was drawn, or 'Kind|message' for Python to raise.
 */
export function createStageRecorder() {
  const commands = []
  let gridCells = 0
  return {
    commands,
    call(name, args, kwargs = {}, options = {}) {
      const { command, error } = validateStageCall(name, args, kwargs, options)
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

// Whether a program imports the stage module (`import stage` / `from stage import …`), so the
// workspace can offer its Picture tab before the first Run (src/shared/resultPane/).
const IMPORTS_STAGE = /^\s*(?:import\s+stage\b|from\s+stage\s+import\b)/m
export function codeImportsStage(code) {
  return IMPORTS_STAGE.test(String(code ?? ''))
}
