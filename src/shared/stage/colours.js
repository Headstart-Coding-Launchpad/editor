// Colours for the Python Stage (src/shared/stage/): what a student may write as a colour, and
// how a colour is said in words (hints, descriptions, the diff summary never rely on colour
// alone). Pure and Node-safe: the Pyodide worker, the canvas renderer, the rasteriser, checks
// and the CLI all share it.
//
// A colour is one of:
// - a CSS colour name ('red', 'cornflowerblue'), which wins where a name is also a PICO-8 name;
// - a PICO-8 name from the Arcade Kit palette ('dark_blue', 'peach'; spaces work too);
// - a hex string: '#rgb' or '#rrggbb' (case does not matter);
// - 'transparent' / 'none' (grid cells only: nothing is drawn).
import { ARCADE_PALETTE } from '../../modules/arcade/design.js'

// The CSS Color Module Level 4 named colours (without 'transparent').
const CSS_COLOURS_SOURCE = `aliceblue f0f8ff antiquewhite faebd7 aqua 00ffff aquamarine 7fffd4 azure f0ffff
beige f5f5dc bisque ffe4c4 black 000000 blanchedalmond ffebcd blue 0000ff blueviolet 8a2be2
brown a52a2a burlywood deb887 cadetblue 5f9ea0 chartreuse 7fff00 chocolate d2691e coral ff7f50
cornflowerblue 6495ed cornsilk fff8dc crimson dc143c cyan 00ffff darkblue 00008b darkcyan 008b8b
darkgoldenrod b8860b darkgray a9a9a9 darkgreen 006400 darkgrey a9a9a9 darkkhaki bdb76b
darkmagenta 8b008b darkolivegreen 556b2f darkorange ff8c00 darkorchid 9932cc darkred 8b0000
darksalmon e9967a darkseagreen 8fbc8f darkslateblue 483d8b darkslategray 2f4f4f
darkslategrey 2f4f4f darkturquoise 00ced1 darkviolet 9400d3 deeppink ff1493 deepskyblue 00bfff
dimgray 696969 dimgrey 696969 dodgerblue 1e90ff firebrick b22222 floralwhite fffaf0
forestgreen 228b22 fuchsia ff00ff gainsboro dcdcdc ghostwhite f8f8ff gold ffd700 goldenrod daa520
gray 808080 green 008000 greenyellow adff2f grey 808080 honeydew f0fff0 hotpink ff69b4
indianred cd5c5c indigo 4b0082 ivory fffff0 khaki f0e68c lavender e6e6fa lavenderblush fff0f5
lawngreen 7cfc00 lemonchiffon fffacd lightblue add8e6 lightcoral f08080 lightcyan e0ffff
lightgoldenrodyellow fafad2 lightgray d3d3d3 lightgreen 90ee90 lightgrey d3d3d3 lightpink ffb6c1
lightsalmon ffa07a lightseagreen 20b2aa lightskyblue 87cefa lightslategray 778899
lightslategrey 778899 lightsteelblue b0c4de lightyellow ffffe0 lime 00ff00 limegreen 32cd32
linen faf0e6 magenta ff00ff maroon 800000 mediumaquamarine 66cdaa mediumblue 0000cd
mediumorchid ba55d3 mediumpurple 9370db mediumseagreen 3cb371 mediumslateblue 7b68ee
mediumspringgreen 00fa9a mediumturquoise 48d1cc mediumvioletred c71585 midnightblue 191970
mintcream f5fffa mistyrose ffe4e1 moccasin ffe4b5 navajowhite ffdead navy 000080 oldlace fdf5e6
olive 808000 olivedrab 6b8e23 orange ffa500 orangered ff4500 orchid da70d6 palegoldenrod eee8aa
palegreen 98fb98 paleturquoise afeeee palevioletred db7093 papayawhip ffefd5 peachpuff ffdab9
peru cd853f pink ffc0cb plum dda0dd powderblue b0e0e6 purple 800080 rebeccapurple 663399
red ff0000 rosybrown bc8f8f royalblue 4169e1 saddlebrown 8b4513 salmon fa8072 sandybrown f4a460
seagreen 2e8b57 seashell fff5ee sienna a0522d silver c0c0c0 skyblue 87ceeb slateblue 6a5acd
slategray 708090 slategrey 708090 snow fffafa springgreen 00ff7f steelblue 4682b4 tan d2b48c
teal 008080 thistle d8bfd8 tomato ff6347 turquoise 40e0d0 violet ee82ee wheat f5deb3
white ffffff whitesmoke f5f5f5 yellow ffff00 yellowgreen 9acd32`

function pairs(source) {
  const parts = source.split(/\s+/).filter(Boolean)
  const out = {}
  for (let i = 0; i + 1 < parts.length; i += 2) out[parts[i]] = `#${parts[i + 1]}`
  return out
}

export const CSS_COLOURS = Object.freeze(pairs(CSS_COLOURS_SOURCE))

// PICO-8 names (the Arcade Kit palette), keyed with underscores ('dark_blue').
export const PICO8_COLOURS = Object.freeze(
  Object.fromEntries(ARCADE_PALETTE.map(({ name, hex }) => [name, hex]))
)

// The PICO-8 palette in index order (0 black … 15 peach): a grid without a palette reads its
// whole numbers as these, like the Arcade Kit.
export const PICO8_PALETTE = Object.freeze(ARCADE_PALETTE.map(({ hex }) => hex))

const TRANSPARENT_WORDS = new Set(['transparent', 'none', 'clear'])

export function isTransparentColour(value) {
  return typeof value === 'string' && TRANSPARENT_WORDS.has(value.trim().toLowerCase())
}

/**
 * A colour as '#rrggbb' (lower case), or null when it isn't one. Strings only: numbers and
 * anything else are not colours here (a grid's palette indexes are handled by the grid).
 */
export function parseColour(value) {
  if (typeof value !== 'string') return null
  const raw = value.trim().toLowerCase()
  if (!raw) return null
  const hex = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/)
  if (hex) {
    const digits = hex[1]
    return digits.length === 3
      ? `#${digits
          .split('')
          .map((d) => d + d)
          .join('')}`
      : `#${digits}`
  }
  if (CSS_COLOURS[raw]) return CSS_COLOURS[raw]
  const pico = raw.replace(/[\s-]+/g, '_').replace(/grey/g, 'gray')
  if (PICO8_COLOURS[pico]) return PICO8_COLOURS[pico]
  const squashed = raw.replace(/[\s_-]+/g, '')
  if (CSS_COLOURS[squashed]) return CSS_COLOURS[squashed]
  return null
}

export function hexToRgb(hex) {
  const value = parseInt(String(hex).slice(1), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

export function rgbToHex([r, g, b]) {
  return `#${[r, g, b].map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')).join('')}`
}

// Two colours count as the same when every channel is within this much (anti-aliasing,
// near-identical hex codes).
export const COLOUR_TOLERANCE = 8

export function coloursMatch(a, b, tolerance = COLOUR_TOLERANCE) {
  if (a == null || b == null) return a == null && b == null
  if (a === b) return true
  const [r1, g1, b1] = hexToRgb(a)
  const [r2, g2, b2] = hexToRgb(b)
  return (
    Math.abs(r1 - r2) <= tolerance &&
    Math.abs(g1 - g2) <= tolerance &&
    Math.abs(b1 - b2) <= tolerance
  )
}

// Plain words for describing any colour: the nearest of these.
const BASIC_WORDS = [
  ['black', '#000000'],
  ['white', '#ffffff'],
  ['grey', '#808080'],
  ['light grey', '#c8c8c8'],
  ['dark grey', '#505050'],
  ['red', '#e01010'],
  ['dark red', '#800000'],
  ['orange', '#ff9000'],
  ['yellow', '#ffe820'],
  ['green', '#10c030'],
  ['dark green', '#006020'],
  ['blue', '#2050f0'],
  ['light blue', '#80c8ff'],
  ['dark blue', '#102060'],
  ['purple', '#8020a0'],
  ['pink', '#ff80b0'],
  ['brown', '#904820'],
  ['cream', '#fff0d8'],
]

// Friendly spellings for names whose CSS spelling runs words together.
const SPOKEN_NAMES = {
  lightgray: 'light grey',
  lightgrey: 'light grey',
  darkgray: 'dark grey',
  darkgrey: 'dark grey',
  gray: 'grey',
  lightblue: 'light blue',
  darkblue: 'dark blue',
  darkgreen: 'dark green',
  darkred: 'dark red',
  lightgreen: 'light green',
  skyblue: 'sky blue',
  hotpink: 'hot pink',
}

/**
 * A colour in words for a student: 'red', 'dark blue', or 'a colour close to orange (#f0a030)'.
 * Accepts anything parseColour does; an exact CSS or PICO-8 name is used as it is.
 */
export function colourInWords(value) {
  if (isTransparentColour(value)) return 'see-through'
  const hex = parseColour(value)
  if (!hex) return String(value ?? '')
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!raw.startsWith('#') && raw) {
    const spoken = SPOKEN_NAMES[raw] ?? raw.replace(/_/g, ' ').replace(/gray/g, 'grey')
    return spoken
  }
  return describeHex(hex)
}

// A hex colour in words: its CSS or PICO-8 name when it has one, else the nearest basic word.
export function describeHex(hex) {
  const named = Object.entries(CSS_COLOURS).find(([, value]) => value === hex)
  if (named) return SPOKEN_NAMES[named[0]] ?? named[0]
  const pico = Object.entries(PICO8_COLOURS).find(([, value]) => value === hex)
  if (pico) return pico[0].replace(/_/g, ' ').replace(/gray/g, 'grey')
  const [r, g, b] = hexToRgb(hex)
  let best = BASIC_WORDS[0]
  let bestDistance = Infinity
  for (const entry of BASIC_WORDS) {
    const [r2, g2, b2] = hexToRgb(entry[1])
    const distance = (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2
    if (distance < bestDistance) {
      bestDistance = distance
      best = entry
    }
  }
  return `a colour close to ${best[0]} (${hex})`
}
