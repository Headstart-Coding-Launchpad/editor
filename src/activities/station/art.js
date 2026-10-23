// Art for the Space station: Lesson Gen's Phase 1 PNG set (#109), copied to public/station/phase-1
// (128 px cells, one PNG per state, a white `-glow.png` mask per part that is tinted in code).
// Every art path lives here; station.js never reads it. Node-safe: no JSX, no DOM. Paths are built
// from Vite's BASE_URL so they work under the deployed base path.

const BASE = (import.meta.env?.BASE_URL ?? '/').replace(/\/?$/, '/')
export const ART_DIR = `${BASE}station/phase-1/`
const url = (file) => `${ART_DIR}${file}`

// The scene picture is 1600 x 1000 (1.6:1); a cell is 128 px of that.
export const SCENE_PX = Object.freeze({ w: 1600, h: 1000, cell: 128 })

export const COLOUR_HEX = Object.freeze({
  blue: '#3b82f6',
  red: '#ef4444',
  green: '#22c55e',
  purple: '#a855f7',
  orange: '#f97316',
  yellow: '#facc15',
  pink: '#ec4899',
  silver: '#cbd5e1',
  white: '#ffffff',
})

export const SCENE_ART = Object.freeze({
  backdrop: url('backdrop.png'),
  interior: Object.freeze({ lit: url('interior-lit.png'), dark: url('interior-dark.png') }),
  hull: Object.freeze({ lit: url('hull-lit.png'), dark: url('hull-dark.png') }),
  hullGlow: url('hull-glow.png'),
})

// The zoo and toy shop packs (public/station/zoo, public/station/toyshop): same format as phase-1.
const worldDir = (id) => `${BASE}station/${id}/`
const ZOO_DIR = worldDir('zoo')
const TOYSHOP_DIR = worldDir('toyshop')

// The scene pictures of a world other than the station: the backdrop, the zoo's base layer of
// empty enclosures and a white mask per enclosure (tinted in code to show where an animal lives).
export const WORLD_ART = Object.freeze({
  zoo: Object.freeze({
    backdrop: `${ZOO_DIR}backdrop.png`,
    base: `${ZOO_DIR}zoo-base.png`,
    enclosureGlow: (kind) => `${ZOO_DIR}enclosure-${kind}-glow.png`,
  }),
  toyshop: Object.freeze({ backdrop: `${TOYSHOP_DIR}backdrop.png`, base: null }),
})

// Part id (station.js) -> art file name; a part with states maps each state to its own file.
const FILES = {
  'power-on': 'power-button-on',
  'power-off': 'power-button-off',
  'crate-closed': 'crate-1x1-closed',
  'crate-open': 'crate-1x1-open',
  'crew-robot-1': 'crew-robot-1',
  'crew-robot-2': 'crew-robot-2',
  'crew-robot-3': 'crew-robot-3',
  'crew-plant': 'crew-plant',
  'captain-badge': 'captain-badge',
  solar: 'module-solar-2x2',
  dome: 'module-dome',
  greenhouse: 'module-greenhouse',
  'docking-arm': 'module-docking-arm',
  'rainbow-ring': 'module-rainbow-ring',
  telescope: 'part-telescope',
  dish: 'part-dish',
  flag: 'part-flag',
  antenna: 'part-antenna',
  beacon: 'part-beacon',
  satellite: 'part-satellite',
  'cargo-pod': 'part-cargo-pod',
}

// { src, glow } for a part, or for a part's state ('open' / 'closed' for crates, 'on' / 'off' for
// the power button, e.g. artFor('crate-1', 'open')). Null for an id with no art.
export function artFor(partId, state) {
  const key = /^crate-\d/.test(partId)
    ? `crate-${state === 'open' ? 'open' : 'closed'}`
    : partId === 'power'
      ? `power-${state === 'on' ? 'on' : 'off'}`
      : partId
  const file = FILES[key]
  if (file) return { src: url(`${file}.png`), glow: url(`${file}-glow.png`) }
  // An animal (ice-penguin) or a toy (toy-kite): the file is named after the part id.
  const dir = /^(ice|grass|jungle|water)-/.test(partId)
    ? ZOO_DIR
    : /^toy-/.test(partId)
      ? TOYSHOP_DIR
      : null
  return dir ? { src: `${dir}${partId}.png`, glow: `${dir}${partId}-glow.png` } : null
}

// Sticker shapes for the crates, drawn in code (100 x 100 viewBox paths). The colour comes from
// COLOUR_HEX; a sticker id is `<colour>-<shape>`, like red-star.
export const STICKER_PATHS = Object.freeze({
  star: 'M50 6 L61 38 L95 38 L67 58 L78 92 L50 71 L22 92 L33 58 L5 38 L39 38 Z',
  circle: 'M50 8 A42 42 0 1 1 49.9 8 Z',
  triangle: 'M50 8 L94 88 L6 88 Z',
  square: 'M12 12 H88 V88 H12 Z',
  heart:
    'M50 90 L13 50 C0 33 12 10 32 12 C42 13 48 20 50 27 C52 20 58 13 68 12 C88 10 100 33 87 50 Z',
})
