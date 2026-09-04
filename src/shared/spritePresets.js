// Reusable Scratch sprite/backdrop preset helpers. Pure, no React/Firebase dependency —
// shared between the lesson builder (author-side "Add sprite"/"Add backdrop" pickers) and
// the student-facing Scratch workspace (author-gated "Add sprite"/"Add backdrop" pickers
// backed by the same admin-curated `lessonTypeAssets/scratch` library).
export const SPRITE_PRESETS_PATH = 'scratch-assets/sprites.json'

const BLANK_SPRITE = {
  type: 'cat',
  x: 0,
  y: 0,
  size: 100,
  direction: 90,
}

function cloneDefinition(def) {
  return JSON.parse(JSON.stringify(def))
}

function nextSpriteId(sprites) {
  const usedIds = new Set(sprites.map((sprite) => sprite.id))
  let number = 1
  while (usedIds.has(`sprite${number}`)) number += 1
  return `sprite${number}`
}

function nextBackdropId(backdrops) {
  const usedIds = new Set(backdrops.map((backdrop) => backdrop.id))
  let number = 1
  while (usedIds.has(`backdrop${number}`)) number += 1
  return `backdrop${number}`
}

function uniqueName(name, items) {
  const usedNames = new Set(items.map((item) => item.name))
  if (!usedNames.has(name)) return name
  let number = 2
  while (usedNames.has(`${name} ${number}`)) number += 1
  return `${name} ${number}`
}

export function normalizeSpritePresets(data) {
  if (!Array.isArray(data)) return []
  return data.filter(
    (preset) =>
      preset &&
      typeof preset.id === 'string' &&
      typeof preset.name === 'string' &&
      preset.name.trim() !== ''
  )
}

export function createSpriteFromPreset(sprites, preset = null) {
  const id = nextSpriteId(sprites)
  const source = preset
    ? cloneDefinition(preset)
    : { ...BLANK_SPRITE, name: `Sprite ${id.replace('sprite', '')}` }
  delete source.id
  return {
    ...source,
    id,
    name: uniqueName(source.name, sprites),
  }
}

export function normalizeBackdropPresets(data) {
  if (!Array.isArray(data)) return []
  return data.filter(
    (preset) =>
      preset &&
      typeof preset.id === 'string' &&
      typeof preset.name === 'string' &&
      preset.name.trim() !== ''
  )
}

export function createBackdropFromPreset(backdrops, preset = null) {
  const id = nextBackdropId(backdrops)
  const source = preset
    ? cloneDefinition(preset)
    : { name: `Backdrop ${id.replace('backdrop', '')}`, colour: '#ffffff' }
  delete source.id
  return {
    ...source,
    id,
    name: uniqueName(source.name, backdrops),
  }
}

// Two-tier library resolution: the global admin-curated library, optionally narrowed to
// an author-picked subset (by preset id) for a single task. An empty/omitted restriction
// list means "offer the whole library" rather than "offer nothing".
export function resolvePresetLibrary(libraryPresets, restrictToIds) {
  const presets = Array.isArray(libraryPresets) ? libraryPresets : []
  if (!Array.isArray(restrictToIds) || restrictToIds.length === 0) return presets
  const allowed = new Set(restrictToIds)
  return presets.filter((preset) => allowed.has(preset.id))
}
