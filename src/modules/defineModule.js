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

const REQUIRED_STRINGS = ['carryThroughField', 'carryThroughLabel', 'completeField']

// Presentation metadata under `meta`. `label` is the canonical name; the rest feed the
// shared label/icon maps (see getModuleLabel in ./definitions.js).
const REQUIRED_META_STRINGS = ['label', 'shortLabel', 'icon', 'pickerHint']

// Optional per-surface label overrides, `meta.surfaceLabels[surface]`, where a surface has
// historically used different wording from `meta.label`:
// - lessonIntro: the information-task Introduction slide (InformationTask.jsx)
// - builderMeta: the Builder lesson meta panel (LessonMetaPanel.jsx)
// - print: the printable lesson (printLesson.js)
// - stageReference: the support/teacher-live stage reference kicker (SupportStagePanel.jsx)
export const MODULE_LABEL_SURFACES = Object.freeze([
  'lessonIntro',
  'builderMeta',
  'print',
  'stageReference',
])

// Code-fence / editor languages a module can declare as `meta.language`.
const MODULE_LANGUAGES = ['python', 'html', null]

// Layout/live-view capabilities that replaced hand-maintained type lists in core code.
const REQUIRED_CAPABILITY_BOOLEANS = [
  'sideExplainer', // explainer renders as a side rail (LessonTaskContent) instead of an accordion
  'modulePanes', // StudentWorkspace reports visiblePanes through the generic modulePanes state
  'teacherLiveReference', // teacher live code can be shown as the support-stage reference
  'unifiedStages', // remote reset uses the unified Starter/Complete stage selector
]
// Where the teacher's sandbox work lives in TeacherView state: a single code string, the
// Scratch project, a filesystem tree, a desktop state, or HTML files.
export const SANDBOX_STATE_KINDS = Object.freeze(['code', 'blocks', 'fs', 'desktop', 'files'])

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
  for (const key of REQUIRED_META_STRINGS) {
    if (typeof def.meta[key] !== 'string' || !def.meta[key]) {
      fail(type, `missing required string field "meta.${key}"`)
    }
  }
  if (!MODULE_LANGUAGES.includes(def.meta.language)) {
    fail(type, `"meta.language" must be one of: ${MODULE_LANGUAGES.join(', ')}`)
  }
  if (typeof def.meta.playground !== 'boolean') {
    fail(type, 'missing required boolean field "meta.playground"')
  }
  if (def.meta.surfaceLabels != null) {
    for (const [surface, label] of Object.entries(def.meta.surfaceLabels)) {
      if (!MODULE_LABEL_SURFACES.includes(surface)) {
        fail(type, `unknown "meta.surfaceLabels" surface "${surface}"`)
      }
      if (typeof label !== 'string' || !label) {
        fail(type, `"meta.surfaceLabels.${surface}" must be a non-empty string`)
      }
    }
  }
  if (!def.capabilities || typeof def.capabilities !== 'object') {
    fail(type, 'missing required object "capabilities"')
  }
  for (const key of REQUIRED_CAPABILITY_BOOLEANS) {
    if (typeof def.capabilities[key] !== 'boolean') {
      fail(type, `missing required boolean "capabilities.${key}"`)
    }
  }
  if (!SANDBOX_STATE_KINDS.includes(def.capabilities.sandboxState)) {
    fail(type, `"capabilities.sandboxState" must be one of: ${SANDBOX_STATE_KINDS.join(', ')}`)
  }
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
  for (const key of ['explainerInlineCodeLanguages', 'explainerCodeBlockLanguages']) {
    if (!Array.isArray(def[key])) fail(type, `missing required array "${key}"`)
  }

  const result = {
    ...def,
    meta: Object.freeze({
      ...def.meta,
      ...(def.meta.surfaceLabels
        ? { surfaceLabels: Object.freeze({ ...def.meta.surfaceLabels }) }
        : {}),
    }),
    capabilities: Object.freeze({ ...def.capabilities }),
  }
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
