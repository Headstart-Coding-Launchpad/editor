// Pure helpers that assemble a lesson-type module from two halves:
//
// - `definition.js` — Node-safe data and pure hooks (no JSX, React, DOM or runtimes), so the
//   CLI, validation and other Node-side code can import module metadata directly.
// - `index.js` — the UI half (workspaces, check editors, layout styles, runtime bridge),
//   merged in with `defineUiModule` into the object the app consumes via the registry.
//
// See docs/architecture/lesson-type-modules.md ("Contract").

const REQUIRED_FUNCTIONS = [
  'getDisplayState',
  'makeCodeTaskFields',
  'makeNewStage',
  'defaultCheck',
  'getCarryThroughUpdates',
  'getNewStarterUpdates',
  'initialState',
  'getSandboxState',
]

const REQUIRED_BOOLEANS = [
  'supportsInteractionMode',
  'supportsIncorrectChecks',
  'supportsTests',
  'supportsVariableChecks',
  'supportsDomChecks',
]

const REQUIRED_STRINGS = ['carryThroughField', 'carryThroughLabel']

// Hooks that may be omitted; they default to null (the app treats null as "not provided").
const OPTIONAL_FUNCTIONS = ['initCompleteTab', 'initStageTab', 'serializeState', 'deserializeState']

// Keys the UI half must provide. A value may be null where the app already allows it
// (e.g. TeacherLiveView, runtime), but it must be present and not undefined.
const REQUIRED_UI_KEYS = [
  'StudentWorkspace',
  'BuilderWorkspace',
  'CheckEditor',
  'TeacherLiveView',
  'getLayoutStyles',
  'runtime',
]

function fail(type, message) {
  throw new Error(`defineModule(${type ?? '?'}): ${message}`)
}

function isFnOrNull(value) {
  return value === null || typeof value === 'function'
}

export function defineModule(def) {
  if (!def || typeof def !== 'object') fail(undefined, 'definition must be an object')
  const { type } = def
  if (typeof type !== 'string' || !type) fail(type, 'missing required string field "type"')
  if (!def.meta || typeof def.meta.label !== 'string' || !def.meta.label) {
    fail(type, 'missing required string field "meta.label"')
  }
  if (typeof def.meta.order !== 'number') fail(type, 'missing required number field "meta.order"')
  for (const key of REQUIRED_FUNCTIONS) {
    if (typeof def[key] !== 'function') fail(type, `missing required function "${key}"`)
  }
  for (const key of REQUIRED_BOOLEANS) {
    if (typeof def[key] !== 'boolean') fail(type, `missing required boolean "${key}"`)
  }
  for (const key of REQUIRED_STRINGS) {
    if (typeof def[key] !== 'string') fail(type, `missing required string "${key}"`)
  }
  if (!('defaultState' in def)) fail(type, 'missing required field "defaultState"')
  if (
    typeof def.stageLabels?.starterLabel !== 'string' ||
    typeof def.stageLabels?.completeLabel !== 'string'
  ) {
    fail(type, 'missing required "stageLabels.starterLabel" / "stageLabels.completeLabel"')
  }
  if (!Array.isArray(def.explainerInlineCodeLanguages)) {
    fail(type, 'missing required array "explainerInlineCodeLanguages"')
  }

  const result = { ...def, meta: Object.freeze({ ...def.meta }) }
  for (const key of OPTIONAL_FUNCTIONS) {
    if (!(key in result)) result[key] = null
    if (!isFnOrNull(result[key])) fail(type, `"${key}" must be a function or null`)
  }
  return Object.freeze(result)
}

export function defineUiModule(definition, ui) {
  const def = Object.isFrozen(definition) ? definition : defineModule(definition)
  if (!ui || typeof ui !== 'object') fail(def.type, 'UI part must be an object')
  for (const key of REQUIRED_UI_KEYS) {
    if (!(key in ui) || ui[key] === undefined) fail(def.type, `missing required UI key "${key}"`)
  }
  if (typeof ui.getLayoutStyles !== 'function') {
    fail(def.type, '"getLayoutStyles" must be a function')
  }
  for (const key of Object.keys(ui)) {
    if (key in def) fail(def.type, `UI key "${key}" duplicates a definition field`)
  }
  return { ...def, ...ui }
}
