import pythonModule from './python/index.js'
import htmlModule from './html/index.js'
import scratchModule from './scratch/index.js'
import filesystemModule from './filesystem/index.js'
import electronicsModule from './electronics/index.js'
import arcadeModule from './arcade/index.js'
import desktopModule from './desktop/index.js'

const MODULES = {
  python: pythonModule,
  html: htmlModule,
  scratch: scratchModule,
  filesystem: filesystemModule,
  electronics: electronicsModule,
  arcade: arcadeModule,
  desktop: desktopModule,
}

const MODULE_ORDER = ['python', 'arcade', 'scratch', 'html', 'filesystem', 'desktop', 'electronics']
const MODULE_LABELS = {
  python: 'Python',
  scratch: 'Scratch',
  html: 'HTML',
  filesystem: 'Filesystem',
  electronics: 'Electronics',
  arcade: 'Arcade Kit',
  desktop: 'Desktop',
}

export function getLessonModules() {
  return MODULE_ORDER
    .map(type => MODULES[type])
    .filter(Boolean)
    .map(module => ({ ...module, label: module.label ?? MODULE_LABELS[module.type] ?? module.type }))
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
