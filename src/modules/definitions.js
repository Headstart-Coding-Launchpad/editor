// Node-safe registry of lesson-type module definitions (the pure half of each module; see
// ./defineModule.js). The CLI, validation and shared type lists import this instead of
// ./registry.js, which pulls in React workspaces and runtimes.
import pythonDefinition from './python/definition.js'
import htmlDefinition from './html/definition.js'
import scratchDefinition from './scratch/definition.js'
import filesystemDefinition from './filesystem/definition.js'
import electronicsDefinition from './electronics/definition.js'
import arcadeDefinition from './arcade/definition.js'
import turtleDefinition from './turtle/definition.js'
import desktopDefinition from './desktop/definition.js'

const DEFINITIONS = [
  pythonDefinition,
  htmlDefinition,
  scratchDefinition,
  filesystemDefinition,
  electronicsDefinition,
  arcadeDefinition,
  turtleDefinition,
  desktopDefinition,
].sort((a, b) => a.meta.order - b.meta.order)

const BY_TYPE = new Map(DEFINITIONS.map((definition) => [definition.type, definition]))

// Registry order (admin/authoring lists), from each definition's meta.order.
export const MODULE_TYPES = Object.freeze(DEFINITIONS.map((definition) => definition.type))

export function getModuleDefinitions() {
  return [...DEFINITIONS]
}

export function getModuleDefinition(type) {
  return BY_TYPE.get(type) ?? null
}

// Types whose definition satisfies `predicate`, in registry order. Core code derives its
// module-type lists from this instead of hand-maintaining them, so a new module declares
// its capabilities once in its definition.js.
export function getModuleTypesWhere(predicate) {
  return DEFINITIONS.filter(predicate).map((definition) => definition.type)
}

// Types whose `capabilities[name]` is true (see ./defineModule.js for the capability list).
export function getModuleTypesWithCapability(name) {
  return getModuleTypesWhere((definition) => definition.capabilities[name] === true)
}

// Every distinct carry-through field (`carryCodeFrom`, `carryBlocksFrom`, …), in registry
// order. Builder id remapping and both validators loop over these.
export const CARRY_THROUGH_FIELDS = Object.freeze([
  ...new Set(DEFINITIONS.map((definition) => definition.carryThroughField)),
])

// Display label for a module type on a given UI surface: the surface's override from
// `meta.surfaceLabels` (see MODULE_LABEL_SURFACES in ./defineModule.js), else `meta.label`.
// Returns null for an unregistered type so each caller keeps its own fallback wording.
export function getModuleLabel(type, surface) {
  const definition = BY_TYPE.get(type)
  if (!definition) return null
  return (surface && definition.meta.surfaceLabels?.[surface]) || definition.meta.label
}
