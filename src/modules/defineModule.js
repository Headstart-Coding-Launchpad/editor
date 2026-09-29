// Pure helpers that assemble a lesson-type module from two halves:
//
// - `definition.js` — Node-safe data and pure hooks (no JSX, React, DOM or runtimes), so the
//   CLI, validation and other Node-side code can import module metadata directly.
// - `index.js` — the UI half (workspaces, check editors, layout styles, runtime bridge),
//   merged in with `defineUiModule` into the object the app consumes via the registry.
//
// See docs/architecture/lesson-type-modules.md ("Contract").
import { fieldWorkSlotHooks } from './moduleContract.js'

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
  'unifiedStages', // remote reset uses the unified Starter/Complete stage selector; the student
  // shows a revealed support stage as a read-only reference (LessonTaskContent)
  // Plan step 4.7 — gates in the student and teacher-monitoring UI:
  'teacherStageReveal', // StudentModal's Reveal menu offers the task's support / complete stages
  'highlights', // the teacher can highlight code in StudentModal's mirror (needs a code/files mirror)
  'downloadCode', // the student can download the task / sandbox code as a .launchpad file
  'fixedExplainer', // the side explainer is a fixed-width column that tabs away (see below)
  'topicLibrary', // the explainer offers the topic library
]
// How the student reaches a task's code stages on their own (StudentView, LessonTaskContent):
// - 'progressive' reveals support stages as read-only references and previews the complete
//   solution read-only before offering to load it (python, html)
// - 'offer'       after two failed checks offers to load the next stage, then the complete one
export const STAGE_REVEAL_KINDS = Object.freeze(['progressive', 'offer'])
// How StudentModal mirrors the student's work while the teacher watches:
// - 'code'  the modal's read-only code editor and output panel (python)
// - 'files' the modal's file tabs, editor and preview iframe (html; the 'files' wire channel)
// - 'blocks' the module's TeacherLiveView fed the Blockly project and the sprite, cursor and
//            block-drag mirrors (scratch)
// - 'view'  the module's TeacherLiveView fed its display state (arcade, turtle, filesystem,
//           desktop, electronics)
export const STUDENT_MIRROR_KINDS = Object.freeze(['code', 'files', 'blocks', 'view'])
// What a StudentCard shows under the name for a code task (optional; null = the generic
// "HTML project" / "No run yet" line): the first lines of console output ('output'), whether
// blocks were edited ('blocks') or whether the file tree changed ('fs').
export const CARD_SUMMARY_KINDS = Object.freeze(['output', 'blocks', 'fs', null])
// `capabilities.teacherEditor` (optional; null = the teacher cannot live-edit this module's work,
// and must be non-null exactly when `workSlot.teacherEdit` is set). `surface` is what the teacher
// edits in StudentModal:
// - 'code'  a plain Python code editor; commits { code } (python, turtle)
// - 'files' the module's TeacherLiveView over the files; commits { files } (html)
// - 'blocks' an editable Blockly workspace; commits { code: <project JSON> } (scratch)
// - 'view'  the module's TeacherLiveView over the code string; commits { code } (arcade,
//           electronics)
// `workspace` is the workspace tab the edit opens on and pushes with it (null = none: arcade
// 'code', electronics 'breadboard'); `design` adds the Arcade design to the edit and commit.
// Its copy is `meta.teacherEditCopy`: `action` (the "✏ …" menu item) and `consent` (the
// student's consent prompt).
export const TEACHER_EDIT_SURFACES = Object.freeze(['code', 'files', 'blocks', 'view'])
// Where the teacher's sandbox work lives in TeacherView state: a single code string, the
// Scratch project, a filesystem tree, a desktop state, or HTML files.
export const SANDBOX_STATE_KINDS = Object.freeze(['code', 'blocks', 'fs', 'desktop', 'files'])
// What the student hook's Run (handleRun) does for the module (plan step 4.4):
// - 'runtime'   runs the code through the module's runtime (Pyodide, MicroPython): runWithRuntime
// - 'preview'   builds the HTML preview iframe
// - 'workspace' the workspace runs the work itself (Arcade's game iframe, Scratch's stage) and
//               reports back through its own handler; handleRun does nothing
// - 'none'      nothing to run (filesystem, desktop). A definition may omit `capabilities.run`;
//               it defaults to 'none'.
export const RUN_KINDS = Object.freeze(['runtime', 'preview', 'workspace', 'none'])
// `runResult` (required exactly when `capabilities.run` is 'runtime'): what a runtime run
// produces beyond output and status:
// - errorLine: a stderr line number highlights the editor line (python)
// - turtle:    the run's turtle drawing is written with the run (writeStudentTurtleResult)
// - liveCode:  the runtime rewrites the work while it runs (onCodeUpdate, electronics), and a
//              stopped run still saves { code, output }
export const RUN_RESULT_FLAGS = Object.freeze(['errorLine', 'turtle', 'liveCode'])

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
// - hasPersonalSandbox(lesson) → whether a student who passed a task is offered the personal
//   sandbox (StudentView): always for python, arcade and turtle, else when the lesson has a
//   sandbox starter.
export const LIFECYCLE_HOOKS = Object.freeze([
  'resetTarget',
  'hasComplete',
  'teacherCompleteTab',
  'sandboxStarter',
  'composedSandboxFields',
  'hasPersonalSandbox',
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

// Optional contract v2 groups for modules on useStudentCodeState's generic work slot (plan steps
// 4.3–4.5; every module since 4.5). A module declares both or neither; absent groups are null.
//
// checking — when and how the student hook evaluates the task check against the module's work:
// - trigger: 'change' (every edit and interaction; filesystem, desktop), 'run' (python, turtle,
//   arcade, electronics, html), 'submit' or 'workspace' (the workspace evaluates the checks
//   itself and reports the outcome through the hook's reportRun; scratch).
// - buildContext(work, interaction) → the context handed to the check evaluators. Optional for a
//   'workspace' trigger, whose checks the hook never evaluates.
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
//
// Plan step 4.4 adds the hook form the code modules use (python, turtle, arcade, electronics).
// A work slot declares either the three fields above (filesystem, desktop: defineModule derives
// the source hooks from them with fieldWorkSlotHooks; a slot naming any field must name all
// three) or, naming none, every one of the source hooks:
// - starter(task), stage(task, stageIndex), complete(task), sandbox(lesson) -> a work value
// - fromResetTarget(target, task, action) -> the work for a lifecycle.resetTarget result
// - stored(value) -> { work, meta }: the value as the storage/wire hooks take it (`work`) plus
//   the module's extra record fields (Arcade: `{ arcadeDesign }`); fromStored(stored, fallback)
//   is the inverse, filling whatever `stored` lacks from `fallback`
// and, in both forms:
// - kind: 'code' is text code with code stages (python, turtle, arcade). The own save is
//   restored only in solo and carry-through uses carryCodeFrom; restoring work (stage,
//   complete, remote reset) clears the run output and saves the cleared run with it; task load
//   keeps the check feedback. 'state' (the default) is structured state (electronics,
//   filesystem, desktop). The own save is always restored and carry uses `carryThroughField`;
//   task load resets the check feedback and clears any HTML files; restoring keeps run output.
// - taskReset: the Reset button restores the starter outside the personal sandbox (the code
//   modules and electronics; filesystem and desktop only reset inside the sandbox).
// - teacherSandboxReset: in a teacher sandbox the Reset button restores the teacher's pushed
//   code rather than the task starter (python, turtle).
// - remoteResetPersists: a teacher remote reset saves the restored work and mirrors its extras
//   while watched (arcade, whose design has no other save on reset).
// - teacherEdit: a teacher's live edit (teacherEditApplyCode, or teacherEditApplyFiles on the
//   'files' channel) replaces the work (every module except filesystem and desktop).
// - workspaceOwned: the workspace loads its own work (own save, carry, starter) and receives
//   restored work (reset, stage, complete, teacher edit and push) as pushed state; the slot holds
//   only what the workspace last reported (scratch, whose Blockly workspace owns its state).
//   Needs the 'workspace' checking trigger.
//
// Plan step 4.5 adds per-file slots (html): a slot on the 'files' wire channel stores per file
// (storage layout 'perFile') and its value is `{ files, activeFile }` (filesWorkSlot in
// ./moduleContract.js); every other slot stores one record and travels on the 'code' channel.
export const WORK_SLOT_FIELDS = Object.freeze(['starterField', 'sandboxField', 'stageField'])
export const WORK_SLOT_HOOKS = Object.freeze(['empty', 'normalise'])
export const WORK_SLOT_SOURCE_HOOKS = Object.freeze([
  'starter',
  'stage',
  'complete',
  'sandbox',
  'fromResetTarget',
  'stored',
  'fromStored',
])
export const WORK_SLOT_KINDS = Object.freeze(['code', 'state'])
export const WORK_SLOT_FLAGS = Object.freeze([
  'taskReset',
  'teacherSandboxReset',
  'remoteResetPersists',
  'teacherEdit',
  'workspaceOwned',
])

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

// Plan step 4.7: the capabilities that replaced per-type gates in StudentView, StudentModal,
// StudentWorkspaceBody, StudentCard and LessonTaskContent. Returns the normalised optional
// values (frozen `focusPanes`, frozen `teacherEditor` or null).
function validateUiGates(type, def, workSlot) {
  const caps = def.capabilities
  if (!STAGE_REVEAL_KINDS.includes(caps.stageReveal)) {
    fail(type, `"capabilities.stageReveal" must be one of: ${STAGE_REVEAL_KINDS.join(', ')}`)
  }
  if (!STUDENT_MIRROR_KINDS.includes(caps.studentMirror)) {
    fail(type, `"capabilities.studentMirror" must be one of: ${STUDENT_MIRROR_KINDS.join(', ')}`)
  }
  const filesChannel = def.wire.sandboxChannel === 'files'
  if ((caps.studentMirror === 'files') !== filesChannel) {
    fail(type, '"capabilities.studentMirror" is "files" exactly when "wire.sandboxChannel" is')
  }
  if (caps.highlights && !['code', 'files'].includes(caps.studentMirror)) {
    fail(type, '"capabilities.highlights" needs a "code" or "files" studentMirror')
  }
  if (caps.fixedExplainer && (!caps.sideExplainer || caps.modulePanes)) {
    fail(type, '"capabilities.fixedExplainer" needs "sideExplainer" and no "modulePanes"')
  }
  if (!CARD_SUMMARY_KINDS.includes(caps.cardSummary ?? null)) {
    fail(type, `"capabilities.cardSummary" must be one of: ${CARD_SUMMARY_KINDS.join(', ')}`)
  }
  const panes = caps.focusPanes ?? []
  if (
    !Array.isArray(panes) ||
    panes.some(
      (pane) =>
        typeof pane?.id !== 'string' ||
        !pane.id ||
        pane.id === 'instructions' ||
        typeof pane.label !== 'string' ||
        !pane.label
    )
  ) {
    fail(
      type,
      '"capabilities.focusPanes" must be an array of { id, label } (Instructions is always offered)'
    )
  }
  const editor = caps.teacherEditor ?? null
  if (editor !== null) {
    if (typeof editor !== 'object') fail(type, '"capabilities.teacherEditor" must be an object')
    if (!TEACHER_EDIT_SURFACES.includes(editor.surface)) {
      fail(
        type,
        `"capabilities.teacherEditor.surface" must be one of: ${TEACHER_EDIT_SURFACES.join(', ')}`
      )
    }
    if ((editor.surface === 'files') !== filesChannel) {
      fail(type, '"capabilities.teacherEditor.surface" is "files" exactly when the wire channel is')
    }
    if (editor.workspace != null && (typeof editor.workspace !== 'string' || !editor.workspace)) {
      fail(type, '"capabilities.teacherEditor.workspace" must be a workspace id or null')
    }
    if (editor.design != null && typeof editor.design !== 'boolean') {
      fail(type, '"capabilities.teacherEditor.design" must be a boolean')
    }
    const copy = def.meta.teacherEditCopy
    if (
      typeof copy?.action !== 'string' ||
      !copy.action ||
      typeof copy.consent !== 'string' ||
      !copy.consent
    ) {
      fail(type, 'a "capabilities.teacherEditor" module declares "meta.teacherEditCopy"')
    }
  }
  if (workSlot && (editor !== null) !== workSlot.teacherEdit) {
    fail(type, '"capabilities.teacherEditor" is declared exactly when "workSlot.teacherEdit" is')
  }
  return {
    focusPanes: Object.freeze(
      panes.map((pane) => Object.freeze({ id: pane.id, label: pane.label }))
    ),
    teacherEditor:
      editor === null
        ? null
        : Object.freeze({
            surface: editor.surface,
            workspace: editor.workspace ?? null,
            design: editor.design ?? false,
          }),
  }
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
  const runKind = def.capabilities.run ?? 'none'
  if (!RUN_KINDS.includes(runKind)) {
    fail(type, `"capabilities.run" must be one of: ${RUN_KINDS.join(', ')}`)
  }
  if (runKind === 'runtime') {
    if (!def.runResult || typeof def.runResult !== 'object') {
      fail(type, 'a "runtime" module declares "runResult"')
    }
    for (const key of RUN_RESULT_FLAGS) {
      if (typeof def.runResult[key] !== 'boolean') {
        fail(type, `missing required boolean "runResult.${key}"`)
      }
    }
  } else if (def.runResult != null) {
    fail(type, '"runResult" is only declared by "runtime" modules')
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
      if (def.checking.trigger === 'workspace' && def.checking[key] == null) continue
      if (typeof def.checking[key] !== 'function') {
        fail(type, `missing required function "checking.${key}"`)
      }
    }
  }
  let workSlot = null
  if (hasWorkSlot) {
    if (typeof def.workSlot !== 'object') fail(type, '"workSlot" must be an object')
    // Field form (the three fields; the source hooks are derived from them) or hook form (every
    // source hook declared). A slot naming any field is in field form.
    const hookForm = !WORK_SLOT_FIELDS.some((key) => key in def.workSlot)
    if (hookForm) {
      for (const key of WORK_SLOT_SOURCE_HOOKS) {
        if (typeof def.workSlot[key] !== 'function') {
          fail(type, `missing required function "workSlot.${key}"`)
        }
      }
    } else {
      for (const key of WORK_SLOT_FIELDS) {
        if (typeof def.workSlot[key] !== 'string' || !def.workSlot[key]) {
          fail(type, `missing required string "workSlot.${key}"`)
        }
      }
    }
    for (const key of WORK_SLOT_HOOKS) {
      if (typeof def.workSlot[key] !== 'function') {
        fail(type, `missing required function "workSlot.${key}"`)
      }
    }
    const kind = def.workSlot.kind ?? 'state'
    if (!WORK_SLOT_KINDS.includes(kind)) {
      fail(type, `"workSlot.kind" must be one of: ${WORK_SLOT_KINDS.join(', ')}`)
    }
    for (const key of WORK_SLOT_FLAGS) {
      if (def.workSlot[key] != null && typeof def.workSlot[key] !== 'boolean') {
        fail(type, `"workSlot.${key}" must be a boolean`)
      }
    }
    // A slot stores one record and travels on the code channel, or (html) stores per file and
    // travels on the files channel.
    if ((def.storage.layout === 'perFile') !== (def.wire.sandboxChannel === 'files')) {
      fail(
        type,
        '"workSlot" needs a "record" storage layout on the "code" wire channel, or "perFile" on "files"'
      )
    }
    if (def.workSlot.workspaceOwned && def.checking.trigger !== 'workspace') {
      fail(type, 'a "workSlot.workspaceOwned" module uses the "workspace" checking trigger')
    }
    workSlot = Object.freeze({
      ...(hookForm
        ? {}
        : fieldWorkSlotHooks(def.workSlot, {
            completeField: def.completeField,
            workKey: def.storage.workKey,
          })),
      ...def.workSlot,
      kind,
      ...Object.fromEntries(WORK_SLOT_FLAGS.map((key) => [key, def.workSlot[key] ?? false])),
    })
  }
  const { focusPanes, teacherEditor } = validateUiGates(type, def, workSlot)
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
  // Optional: check types owned elsewhere (e.g. owner 'input') that this module's tasks may use.
  // Those types' validate() reject tasks whose module doesn't list them.
  if (
    def.inheritsCheckTypes != null &&
    (!Array.isArray(def.inheritsCheckTypes) ||
      def.inheritsCheckTypes.some((id) => typeof id !== 'string' || !id))
  ) {
    fail(type, '"inheritsCheckTypes" must be an array of check type ids')
  }

  const result = {
    ...def,
    meta: Object.freeze({
      ...def.meta,
      ...(def.meta.surfaceLabels
        ? { surfaceLabels: Object.freeze({ ...def.meta.surfaceLabels }) }
        : {}),
      teacherEditCopy: teacherEditor
        ? Object.freeze({
            action: def.meta.teacherEditCopy.action,
            consent: def.meta.teacherEditCopy.consent,
          })
        : null,
    }),
    capabilities: Object.freeze({
      ...def.capabilities,
      run: runKind,
      cardSummary: def.capabilities.cardSummary ?? null,
      focusPanes,
      teacherEditor,
    }),
    lifecycle: Object.freeze({ ...def.lifecycle }),
    storage: Object.freeze({ ...def.storage }),
    wire: Object.freeze({ ...def.wire }),
    checking: hasChecking ? Object.freeze({ ...def.checking }) : null,
    workSlot,
    runResult: def.runResult ? Object.freeze({ ...def.runResult }) : null,
    inheritsCheckTypes: Object.freeze([...(def.inheritsCheckTypes ?? [])]),
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
