// Placeholder art for the Space station: an emoji and a colour per part (the pilot is a CSS helmet
// with a dark visor: no people or faces in the course art). Swapping to Lesson Gen's
// PNG set later (one PNG per state, 128 px cells, a white glow PNG per part tinted in code)
// changes only this file; station.js never reads it. Node-safe.

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

export const PART_ART = Object.freeze({
  'crate-1': { emoji: '📦', colour: '#b45309', shape: 'square' },
  'crate-2': { emoji: '📦', colour: '#b45309', shape: 'square' },
  'crate-3': { emoji: '📦', colour: '#b45309', shape: 'square' },
  'crew-robot': { emoji: '🤖', colour: '#94a3b8', shape: 'round' },
  'crew-pilot': { emoji: '', colour: '#cbd5e1', shape: 'helmet' },
  'crew-plant': { emoji: '🌱', colour: '#4ade80', shape: 'round' },
  solar: { emoji: '☀️', colour: '#fde047', shape: 'wide' },
  dome: { emoji: '🔮', colour: '#7dd3fc', shape: 'round' },
  greenhouse: { emoji: '🌿', colour: '#86efac', shape: 'square' },
  'docking-arm': { emoji: '🦾', colour: '#d1d5db', shape: 'wide' },
  telescope: { emoji: '🔭', colour: '#c4b5fd', shape: 'square' },
  dish: { emoji: '📡', colour: '#fca5a5', shape: 'round' },
  flag: { emoji: '🚩', colour: '#fb7185', shape: 'square' },
  antenna: { emoji: '📶', colour: '#a5b4fc', shape: 'square' },
  lab: { emoji: '🧪', colour: '#99f6e4', shape: 'square' },
  'rocket-pad': { emoji: '🚀', colour: '#fdba74', shape: 'wide' },
  'space-slide': { emoji: '🛝', colour: '#f9a8d4', shape: 'wide' },
})

const FALLBACK = { emoji: '❔', colour: '#e5e7eb', shape: 'square' }

export function artFor(partId) {
  return PART_ART[partId] ?? FALLBACK
}
