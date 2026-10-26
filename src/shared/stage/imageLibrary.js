// Image Lab's picture library for the Python Stage (load_image(), docs/authoring/stage.md "Image
// Lab"). Pure and Node-safe: the Pyodide worker's bridge (src/modules/python/stagePictureBridge.js),
// the docs and the tests share it.
//
// Every picture is stored once, at 64 × 64, as raw RGB bytes (3 a pixel, row by row) in
// public/image-lab/<name>.rgb; public/image-lab/manifest.json holds the same names with each
// picture's source, author and licence (all CC0 or public domain; docs/LICENSES.md). Smaller sizes
// are made here: photos by averaging each block of pixels, pixel art and the green screen
// (`crisp`) by taking one pixel from each block, so their colours stay exact.
//
// A picture reaches Python as a flat list of '#rrggbb' strings, row by row: what
// grid(pixels, width=size) draws.

export const IMAGE_STORED_SIZE = 64
export const IMAGE_SIZES = Object.freeze([8, 16, 32, 64])
export const DEFAULT_IMAGE_SIZE = 32
export const IMAGE_BYTES = IMAGE_STORED_SIZE * IMAGE_STORED_SIZE * 3
export const IMAGE_FOLDER = 'image-lab'

const entry = (name, words, kind, crisp = false) => Object.freeze({ name, words, kind, crisp })

// In the order the docs and the "pictures you can load" message list them.
export const IMAGE_LIBRARY = Object.freeze([
  entry('fox', 'a red fox, face on', 'animal'),
  entry('tiger', 'a tiger', 'animal'),
  entry('parrot', 'a scarlet macaw parrot', 'animal'),
  entry('frog', 'a red-eyed tree frog on a leaf', 'animal'),
  entry('jellyfish', 'a jellyfish in dark water', 'animal'),
  entry('earth', 'the Earth from space', 'space'),
  entry('moon', 'the full Moon', 'space'),
  entry('saturn', 'Saturn and its rings', 'space'),
  entry('mars', 'the planet Mars', 'space'),
  entry('rocket', 'a Space Shuttle launching', 'vehicle'),
  entry('car', 'a red sports car', 'vehicle'),
  entry('eiffel_tower', 'the Eiffel Tower', 'place'),
  entry('pyramids', 'the pyramids of Giza', 'place'),
  entry('pizza', 'a pizza', 'food'),
  entry('strawberries', 'two strawberries', 'food'),
  entry('donut', 'a chocolate donut with sprinkles', 'food'),
  entry('moon_surface', "the Moon's surface (a backdrop)", 'backdrop'),
  entry('mars_surface', "Mars's surface (a backdrop)", 'backdrop'),
  entry('nebula', 'a glowing nebula in space (a backdrop)', 'backdrop'),
  entry('beach', 'a sandy beach and sky (a backdrop)', 'backdrop'),
  entry('astronaut_green', 'an astronaut on a flat green screen (#00ff00)', 'green screen', true),
  entry('pixel_fox', 'a pixel-art fox face', 'pixel art', true),
  entry('alien', 'a pixel-art green alien', 'pixel art', true),
  entry('spaceship', 'a pixel-art spaceship', 'pixel art', true),
  entry('robot', 'a pixel-art robot', 'pixel art', true),
  entry('gem', 'a pixel-art blue gem', 'pixel art', true),
  entry('sword', 'a pixel-art sword', 'pixel art', true),
])

export const IMAGE_NAMES = Object.freeze(IMAGE_LIBRARY.map((image) => image.name))
const BY_NAME = new Map(IMAGE_LIBRARY.map((image) => [image.name, image]))

/** A name as the library spells it: trimmed, lower case, spaces and dashes as underscores. */
export function normaliseImageName(name) {
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
}

/** The library entry for a name (any case, spaces or dashes), or null. */
export function findImage(name) {
  return BY_NAME.get(normaliseImageName(name)) ?? null
}

/** Where a picture's bytes are served, under the app's base path (Vite's BASE_URL). */
export function imageUrl(name, base = '/') {
  const root = String(base || '/').replace(/\/?$/, '/')
  return `${root}${IMAGE_FOLDER}/${normaliseImageName(name)}.rgb`
}

/**
 * The library's names written as text anywhere in a program that calls load_image(), so the
 * worker can fetch them before the run: load_image("fox"), but also names = ["fox", "moon"].
 */
export function imageNamesInCode(code) {
  const text = String(code ?? '')
  if (!text.includes('load_image')) return []
  const found = new Set()
  for (const match of text.matchAll(/(['"])([A-Za-z][A-Za-z_ -]{0,30})\1/g)) {
    const image = findImage(match[2])
    if (image) found.add(image.name)
  }
  return [...found]
}

// How many single-letter edits turn a into b (for "did you mean").
function editDistance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const saved = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1))
      previous = saved
    }
  }
  return row[b.length]
}

/** The library name closest to a misspelt one, or null when none is close. */
export function closestImageName(name) {
  const wanted = normaliseImageName(name)
  if (!wanted) return null
  let best = null
  let bestDistance = Infinity
  for (const candidate of IMAGE_NAMES) {
    const distance =
      candidate.includes(wanted) && wanted.length >= 3 ? 1 : editDistance(wanted, candidate)
    if (distance < bestDistance) {
      best = candidate
      bestDistance = distance
    }
  }
  return bestDistance <= Math.max(1, Math.floor(wanted.length / 3)) ? best : null
}

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

const SIZE_WORDS = '8, 16, 32 or 64'

/**
 * load_image(name, size=32)'s values → `{ name, size, image }` or `{ error: { kind, message } }`
 * (kind is the Python exception to raise).
 */
export function readImageRequest(args = [], kwargs = {}) {
  const fail = (kind, message) => ({ error: { kind, message } })
  const list = Array.isArray(args) ? args : []
  const named = kwargs && typeof kwargs === 'object' ? kwargs : {}
  if (list.length > 2) {
    return fail(
      'TypeError',
      'load_image() takes a name and a size, like load_image("fox", size=64)'
    )
  }
  for (const key of Object.keys(named)) {
    if (key !== 'name' && key !== 'size') {
      return fail('TypeError', `load_image() has no ${key}= — it understands name= and size=`)
    }
  }
  if (list.length > 0 && 'name' in named)
    return fail('TypeError', 'load_image() got the name twice')
  if (list.length > 1 && 'size' in named)
    return fail('TypeError', 'load_image() got the size twice')
  const name = list.length > 0 ? list[0] : named.name
  const size = list.length > 1 ? list[1] : (named.size ?? DEFAULT_IMAGE_SIZE)
  if (name === undefined) {
    return fail('TypeError', 'load_image() needs the name of a picture, like load_image("fox")')
  }
  if (typeof name !== 'string') {
    return fail(
      'TypeError',
      `load_image(): the name should be a picture's name in quotes, like load_image("fox"), not ${given(name)}`
    )
  }
  if (typeof size !== 'number' || !IMAGE_SIZES.includes(size)) {
    return fail(
      typeof size === 'number' ? 'ValueError' : 'TypeError',
      `load_image(): size can be ${SIZE_WORDS} (squares along each side), like load_image("fox", size=64), not ${given(size)}`
    )
  }
  const image = findImage(name)
  if (!image) {
    const close = closestImageName(name)
    const shown = name.length > 30 ? `${name.slice(0, 30)}…` : name
    return fail(
      'ValueError',
      close
        ? `load_image(): there's no picture called '${shown}' — did you mean '${close}'?`
        : `load_image(): there's no picture called '${shown}'. Pictures you can load: ${IMAGE_NAMES.join(', ')}`
    )
  }
  return { name: image.name, size, image }
}

/**
 * A stored picture (IMAGE_STORED_SIZE square, RGB bytes) at `size` along each side: blocks of
 * pixels averaged (rounded), or for `crisp` pictures the top-left pixel of each block.
 */
export function resizeImageBytes(bytes, size, { crisp = false, from = IMAGE_STORED_SIZE } = {}) {
  if (size === from) return bytes
  const block = from / size
  if (!Number.isInteger(block) || block < 1) throw new Error(`Can't shrink ${from} to ${size}`)
  const out = new Uint8Array(size * size * 3)
  const area = block * block
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const target = (row * size + col) * 3
      if (crisp) {
        const source = (row * block * from + col * block) * 3
        out[target] = bytes[source]
        out[target + 1] = bytes[source + 1]
        out[target + 2] = bytes[source + 2]
        continue
      }
      for (let channel = 0; channel < 3; channel++) {
        let sum = 0
        for (let dy = 0; dy < block; dy++) {
          for (let dx = 0; dx < block; dx++) {
            sum += bytes[((row * block + dy) * from + col * block + dx) * 3 + channel]
          }
        }
        out[target + channel] = Math.round(sum / area)
      }
    }
  }
  return out
}

const HEX_PAIRS = Array.from({ length: 256 }, (_, n) => n.toString(16).padStart(2, '0'))

// The colours the pixel art and the green screen are drawn in (#259 follow-up, Lesson Gen #261):
// each is a CSS colour name, so load_image() hands those pictures to Python as names and a Level 1
// colour swap reads `if fox[i] == "orange":`. Photos stay '#rrggbb'.
export const PIXEL_ART_COLOURS = Object.freeze({
  '000000': 'black',
  ffffff: 'white',
  808080: 'gray',
  a9a9a9: 'darkgray',
  d3d3d3: 'lightgray',
  c0c0c0: 'silver',
  696969: 'dimgray',
  '2f4f4f': 'darkslategray',
  ff0000: 'red',
  ffa500: 'orange',
  ffff00: 'yellow',
  ffd700: 'gold',
  daa520: 'goldenrod',
  f0e68c: 'khaki',
  '00ff00': 'lime',
  '32cd32': 'limegreen',
  '00bfff': 'deepskyblue',
  '87ceeb': 'skyblue',
  '4169e1': 'royalblue',
  191970: 'midnightblue',
  800080: 'purple',
  d2691e: 'chocolate',
  a0522d: 'sienna',
})

/**
 * RGB bytes as the pixel list the bridge hands to Python for a `crisp` picture: one entry per
 * pixel, a PIXEL_ART_COLOURS name where the colour is one, else 'rrggbb'; comma-separated.
 */
export function rgbBytesToNamedPixels(bytes) {
  const out = []
  for (let i = 0; i + 2 < bytes.length; i += 3) {
    const hex = HEX_PAIRS[bytes[i]] + HEX_PAIRS[bytes[i + 1]] + HEX_PAIRS[bytes[i + 2]]
    out.push(PIXEL_ART_COLOURS[hex] ?? `#${hex}`)
  }
  return out.join(',')
}

/** RGB bytes as one string of 'rrggbb' groups, the form the bridge hands to Python. */
export function rgbBytesToHex(bytes) {
  let out = ''
  for (let i = 0; i + 2 < bytes.length; i += 3) {
    out += HEX_PAIRS[bytes[i]] + HEX_PAIRS[bytes[i + 1]] + HEX_PAIRS[bytes[i + 2]]
  }
  return out
}
