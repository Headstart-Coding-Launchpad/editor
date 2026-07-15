import pythonModule from './python/index.js'
import htmlModule from './html/index.js'
import scratchModule from './scratch/index.js'
import filesystemModule from './filesystem/index.js'
import electronicsModule from './electronics/index.js'

const MODULES = {
  python: pythonModule,
  html: htmlModule,
  scratch: scratchModule,
  filesystem: filesystemModule,
  electronics: electronicsModule,
}

export function getLessonModule(type) {
  return MODULES[type] ?? null
}

export function getStudentWorkspace(type) {
  return MODULES[type]?.StudentWorkspace ?? null
}

export function getBuilderWorkspace(type) {
  return MODULES[type]?.BuilderWorkspace ?? null
}

export function getCheckEditor(type) {
  return MODULES[type]?.CheckEditor ?? null
}
