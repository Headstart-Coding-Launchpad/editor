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
