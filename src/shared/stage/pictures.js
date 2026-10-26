// Image Lab's Stage helpers that need the browser-free colour and raster code (docs/authoring/
// stage.md "Image Lab"). Pure and Node-safe; the worker's bridge (src/modules/python/
// stagePictureBridge.js) calls them.
//
// - red(c), green(c), blue(c) read '#rrggbb' in Python itself; any other colour (a name, '#rgb',
//   a PICO-8 name) comes here to be turned into '#rrggbb' (stageColourValue).
// - snapshot(size=32): the Stage's drawing so far as a flat list of colours, row by row, the
//   shape load_image() returns. It uses the Stage's own rasteriser (./raster.js), sampling the
//   middle of each square, so a shape's colour comes back exactly as it was drawn. Text and
//   emoji are not included (they depend on each device's fonts).
import { MAX_GRID_SIDE } from './commands.js'
import { isTransparentColour, parseColour } from './colours.js'
import { rasteriseStage } from './raster.js'

export const DEFAULT_SNAPSHOT_SIZE = 32

const COLOUR_EXAMPLE = "'#ff8800', 'orange' or rgb(255, 136, 0)"

function given(value) {
  if (value === null || value === undefined) return 'None'
  if (value === true) return 'True'
  if (value === false) return 'False'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return `the text '${value.slice(0, 30)}'`
  if (Array.isArray(value)) return 'a list'
  if (typeof value === 'object' && typeof value.__hs_type__ === 'string') {
    return `a ${value.__hs_type__}`
  }
  return 'something else'
}

/**
 * The colour a red()/green()/blue() call was given, as `{ value: '#rrggbb' }`, or `{ error:
 * { kind, message } }`. `fn` names the call in the message.
 */
export function stageColourValue(fn, args = [], kwargs = {}) {
  const name = typeof fn === 'string' && /^[a-z_]{1,20}$/.test(fn) ? fn : 'colour'
  const list = Array.isArray(args) ? args : []
  const value = list.length > 0 ? list[0] : kwargs?.c
  if (list.length !== 1 && kwargs?.c === undefined) {
    return {
      error: {
        kind: 'TypeError',
        message: `${name}() reads one colour, like ${name}('#ff8800')`,
      },
    }
  }
  if (typeof value !== 'string') {
    return {
      error: {
        kind: 'TypeError',
        message: `${name}(): give it a colour, like ${COLOUR_EXAMPLE}, not ${given(value)}`,
      },
    }
  }
  if (isTransparentColour(value)) {
    return {
      error: {
        kind: 'ValueError',
        message: `${name}(): '${value.trim()}' is see-through, so it has no red, green or blue to read`,
      },
    }
  }
  const hex = parseColour(value)
  if (!hex) {
    const shown = value.length > 30 ? `${value.slice(0, 30)}…` : value
    return {
      error: {
        kind: 'ValueError',
        message: `${name}(): '${shown}' isn't a colour I know. Try ${COLOUR_EXAMPLE}`,
      },
    }
  }
  return { value: hex }
}

/** snapshot(size=32)'s values → `{ size }` or `{ error: { kind, message } }`. */
export function readSnapshotRequest(args = [], kwargs = {}) {
  const list = Array.isArray(args) ? args : []
  const named = kwargs && typeof kwargs === 'object' ? kwargs : {}
  const extra = Object.keys(named).find((key) => key !== 'size')
  if (extra) {
    return {
      error: { kind: 'TypeError', message: `snapshot() has no ${extra}= — it understands size=` },
    }
  }
  if (list.length > 1 || (list.length === 1 && 'size' in named)) {
    return {
      error: {
        kind: 'TypeError',
        message: 'snapshot() takes one value, the size, like snapshot(size=32)',
      },
    }
  }
  const size = list.length === 1 ? list[0] : (named.size ?? DEFAULT_SNAPSHOT_SIZE)
  if (typeof size !== 'number' || !Number.isInteger(size) || size < 1 || size > MAX_GRID_SIDE) {
    return {
      error: {
        kind: typeof size === 'number' ? 'ValueError' : 'TypeError',
        message: `snapshot(): size is how many squares along each side, a whole number from 1 to ${MAX_GRID_SIDE}, like snapshot(size=32), not ${given(size)}`,
      },
    }
  }
  return { size }
}

const HEX_PAIRS = Array.from({ length: 256 }, (_, n) => n.toString(16).padStart(2, '0'))

/**
 * The drawing (a run's command list so far) as `size` × `size` colours, one string of
 * 'rrggbb' groups row by row (Python splits it into '#rrggbb' items).
 */
export function snapshotHex(commands, size = DEFAULT_SNAPSHOT_SIZE) {
  const { cells } = rasteriseStage(Array.isArray(commands) ? commands : [], size)
  let out = ''
  for (const value of cells) {
    out += HEX_PAIRS[(value >> 16) & 255] + HEX_PAIRS[(value >> 8) & 255] + HEX_PAIRS[value & 255]
  }
  return out
}

/** snapshotHex as a list of '#rrggbb' (for tests and JS callers). */
export function snapshotColours(commands, size = DEFAULT_SNAPSHOT_SIZE) {
  const hex = snapshotHex(commands, size)
  const out = []
  for (let i = 0; i < hex.length; i += 6) out.push(`#${hex.slice(i, i + 6)}`)
  return out
}
