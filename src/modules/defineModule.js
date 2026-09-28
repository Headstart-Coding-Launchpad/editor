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
  // Shared Builder + CLI validation for this module's tasks:
  // validateTask(task, { n, lesson, errors, warnings }) pushes messages. Pure / Node-safe.
  'validateTask',
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

// Contract v2 hook groups (see ./moduleContract.js for the shared builders and
// docs/architecture/lesson-type-modules.md, "Contract v2"). Each group is a frozen object.
//
// lifecycle:
// - resetTarget(task, action, ctx) → the state a remote reset puts in front of the student,
//   in the module's own shape ({ code } | { files, entryFile } | { blocks, stageIndex } |
//   { fs } | { desktop } | { circuit }); ctx carries defaults ({ fs, circuit, desktop }).
// - hasComplete(task) → whether the task has a complete solution to offer the student.
// - teacherCompleteTab(task) → whether the teacher editor shows a separate Complete tab (false
//   for modules whose complete solution lives in the unified code stages).
// - sandboxStarter(lesson, task) → the teacher sandbox starter (getSandboxState is its alias).
// - composedSandboxFields(firstTask) → the lesson-level sandbox fields a composed lesson's
//   module derives from its first code task.
export const LIFECYCLE_HOOKS = Object.freeze([
  'resetTarget',
  'hasComplete',
  'teacherCompleteTab',
  'sandboxStarter',
  'composedSandboxFields',
])
// storage: record adapters onto today's localStorage shapes (docs/agents/runtime-model.md).
export const STORAGE_LAYOUTS = Object.freeze(['record', 'perFile'])
export const STORAGE_HOOKS = Object.freeze([
  'toTaskRecord',
  'fromTaskRecord',
  'toSandboxRecord',
  'fromSandboxRecord',
])
// wire: Realtime Database codec — toCode/fromCode (the `currentCode` / `sandboxCode` string),
// liveExtras (teacherLive `arcadeDesign` / `turtleResult`, explicit nulls), submission (the
// value logged with an attempt).
export const WIRE_CHANNELS = Object.freeze(['code', 'files'])
export const WIRE_HOOKS = Object.freeze(['toCode', 'fromCode', 'liveExtras', 'submission'])

// Optional contract v2 groups for modules on useStudentCodeState's generic work slot (plan step
// 4.3; filesystem and desktop so far). A module declares both or neither; absent groups are null.
//
// checking — when and how the student hook evaluates the task check against the module's work:
// - trigger: 'change' (every edit and interaction; filesystem, desktop), 'run', 'submit' or
//   'workspace' (the workspace evaluates and reports its own checks).
// - buildContext(work, interaction) → the context handed to the check evaluators.
export const CHECK_TRIGGERS = Object.freeze(['change', 'run', 'submit', 'workspace'])
export const CHECKING_HOOKS = Object.freeze(['buildContext'])
// workSlot — where the module's work comes from, for the generic loaders (task load, carry,
// stages, complete, personal sandbox):
// - starterField / sandboxField / stageField: the task, lesson and code-stage fields holding a
//   starting work value (e.g. `starterFs`, `sandboxStarterFs`, `fs`); the complete value is the
//   module's `completeField` and carry uses `carryThroughField`.
// - empty(task) → the work used when a field is missing (a stable module default).
// - normalise(work) → the work as the workspace expects it, applied whenever work is restored
//   (load, reset, stage, complete, sandbox, teacher push) but not to the student's own edits.
export const WORK_SLOT_FIELDS = Object.freeze(['starterField', 'sandboxField', 'stageField'])
export const WORK_SLOT_HOOKS = Object.freeze(['empty', 'normalise'])

// Hooks that may be omitted; they default to null (the app treats null as "not provided").
// Validation hooks (see src/shared/lessonValidation.js):
// - hasStarterContent(task) → boolean; null = no "empty editor" warning for this module.
// - hasCheckValue(task) → boolean for the Builder's untested-check reminder; null = the generic
//   code-check rule.
// - validateTaskInBrowser(task, { n, errors, warnings }) → Builder-only rules needing browser
//   APIs (e.g. DOMParser); the CLI never calls it.
const OPTIONAL_FUNCTIONS = [
  'initCompleteTab',
  'initStageTab',
  'serializeState',
  'deserializeState',
  'hasStarterContent',
  'hasCheckValue',
  'validateTaskInBrowser',
]

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
  if (!def.lifecycle || typeof def.lifecycle !== 'object') {
    fail(type, 'missing required object "lifecycle"')
  }
  for (const key of LIFECYCLE_HOOKS) {
    if (typeof def.lifecycle[key] !== 'function') {
      fail(type, `missing required function "lifecycle.${key}"`)
    }
  }
  if (def.getSandboxState != null && def.getSandboxState !== def.lifecycle.sandboxStarter) {
    fail(type, '"getSandboxState" is an alias of "lifecycle.sandboxStarter"; declare only that')
  }
  if (!def.storage || typeof def.storage !== 'object') {
    fail(type, 'missing required object "storage"')
  }
  if (!STORAGE_LAYOUTS.includes(def.storage.layout)) {
    fail(type, `"storage.layout" must be one of: ${STORAGE_LAYOUTS.join(', ')}`)
  }
  for (const key of STORAGE_HOOKS) {
    if (typeof def.storage[key] !== 'function') {
      fail(type, `missing required function "storage.${key}"`)
    }
  }
  if (!def.wire || typeof def.wire !== 'object') fail(type, 'missing required object "wire"')
  if (!WIRE_CHANNELS.includes(def.wire.sandboxChannel)) {
    fail(type, `"wire.sandboxChannel" must be one of: ${WIRE_CHANNELS.join(', ')}`)
  }
  if ((def.wire.sandboxChannel === 'files') !== (def.capabilities.sandboxState === 'files')) {
    fail(type, '"wire.sandboxChannel" is "files" exactly when "capabilities.sandboxState" is')
  }
  for (const key of WIRE_HOOKS) {
    if (typeof def.wire[key] !== 'function') fail(type, `missing required function "wire.${key}"`)
  }
  const hasChecking = def.checking != null
  const hasWorkSlot = def.workSlot != null
  if (hasChecking !== hasWorkSlot) {
    fail(type, '"checking" and "workSlot" are declared together (the generic work slot)')
  }
  if (hasChecking) {
    if (typeof def.checking !== 'object') fail(type, '"checking" must be an object')
    if (!CHECK_TRIGGERS.includes(def.checking.trigger)) {
      fail(type, `"checking.trigger" must be one of: ${CHECK_TRIGGERS.join(', ')}`)
    }
    for (const key of CHECKING_HOOKS) {
      if (typeof def.checking[key] !== 'function') {
        fail(type, `missing required function "checking.${key}"`)
      }
    }
  }
  if (hasWorkSlot) {
    if (typeof def.workSlot !== 'object') fail(type, '"workSlot" must be an object')
    for (const key of WORK_SLOT_FIELDS) {
      if (typeof def.workSlot[key] !== 'string' || !def.workSlot[key]) {
        fail(type, `missing required string "workSlot.${key}"`)
      }
    }
    for (const key of WORK_SLOT_HOOKS) {
      if (typeof def.workSlot[key] !== 'function') {
        fail(type, `missing required function "workSlot.${key}"`)
      }
    }
    // The generic slot persists one task record and travels on the code channel.
    if (def.storage.layout !== 'record' || def.wire.sandboxChannel !== 'code') {
      fail(type, '"workSlot" needs a "record" storage layout and the "code" wire channel')
    }
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
    lifecycle: Object.freeze({ ...def.lifecycle }),
    storage: Object.freeze({ ...def.storage }),
    wire: Object.freeze({ ...def.wire }),
    checking: hasChecking ? Object.freeze({ ...def.checking }) : null,
    workSlot: hasWorkSlot ? Object.freeze({ ...def.workSlot }) : null,
    // Pre-v2 name, kept so existing callers and module authors keep working.
    getSandboxState: def.lifecycle.sandboxStarter,
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
