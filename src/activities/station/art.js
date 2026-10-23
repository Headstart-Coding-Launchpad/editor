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
  return file ? { src: url(`${file}.png`), glow: url(`${file}-glow.png`) } : null
}
