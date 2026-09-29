import pythonModule from './python/index.js'
import htmlModule from './html/index.js'
import scratchModule from './scratch/index.js'
import filesystemModule from './filesystem/index.js'
import electronicsModule from './electronics/index.js'
import arcadeModule from './arcade/index.js'
import turtleModule from './turtle/index.js'
import desktopModule from './desktop/index.js'
import { MODULE_TYPES, getModuleDefinition } from './definitions.js'

const MODULES = {
  python: pythonModule,
  html: htmlModule,
  scratch: scratchModule,
  filesystem: filesystemModule,
  electronics: electronicsModule,
  arcade: arcadeModule,
  turtle: turtleModule,
  desktop: desktopModule,
}

// Order and labels come from each module's definition.js (meta.order / meta.label).
export function getLessonModules() {
  return MODULE_TYPES.map((type) => MODULES[type])
    .filter(Boolean)
    .map((module) => ({
      ...module,
      label: module.label ?? getModuleDefinition(module.type)?.meta.label ?? module.type,
    }))
}

export function getLessonModule(type) {
  return MODULES[type] ?? null
}
