// Node-safe half of the Template Module module (see ../defineModule.js). UI lives in index.js.
//
// Scaffolded by `npm run new:module` from src/modules/_template/ (plan step 4.8). The scaffold is
// a working "write some text, press Check" module: the work is a text string stored like code
// (`starterCode` / `codeStages[].code` / `completeCode`, the `code` wire channel), checked with the
// core code checks when the workspace's Check button reports a run. Every group of the contract
// is filled with safe defaults; each place to decide is marked TODO(new-module). The contract:
// docs/architecture/lesson-type-modules.md. Keep this file pure: no JSX, React, DOM or runtimes,
// and explicit `.js` extensions on relative imports (the CLI loads it under plain Node).
import { defineModule } from '../defineModule.js'
import { isCodeCheck, normalizeChecks } from '../checks.js'
import { codeCopyStarterToComplete, codeDefaultTypeFields, never } from '../moduleAuthoring.js'
import { printCodeStringTask } from '../printHelpers.js'
import {
  codeStarterPresent,
  validateCodeChecks,
  validateTaskChecks,
  warnCompleteCode,
} from '../moduleTaskValidation.js'
import {
  codeCheckContext,
  codeHasComplete,
  codeResetTarget,
  codeStringWire,
  codeWorkSlot,
  personalSandboxWhenLessonHas,
  recordStorage,
  starterCodeOf,
} from '../moduleContract.js'

export default defineModule({
  type: 'template_module',

  // ── Presentation ─────────────────────────────────────────────────────────────
  // TODO(new-module): label, icon and picker copy. `order` places it in the registry (the
  // generator appends it); `pickerOrder` (optional) moves it in the composed-lesson picker.
  meta: {
    label: 'Template Module',
    order: 99,
    shortLabel: 'Template Module',
    icon: '🧩',
    pickerHint: 'Workspace · Experimental',
    // 'python' | 'html' | null — the code language (explainer code blocks, editors).
    language: null,
    // true needs lifecycle.playgroundTask and gives the module a /playground/<type> route.
    playground: false,
    // Optional per-surface wording (lessonIntro, builderMeta, print, stageReference).
    // surfaceLabels: {},
    // Required with capabilities.teacherEditor: { action, consent }.
    teacherEditCopy: null,
  },

  // ── Capabilities (UI gates; see docs/architecture/lesson-type-modules.md) ────────
  // TODO(new-module): turn on what the module really supports. Each flag is read by core code
  // instead of a lesson-type comparison, so nothing outside this folder needs to change.
  capabilities: {
    sideExplainer: true, // explainer as a side rail (false: an accordion above the workspace)
    modulePanes: false, // StudentWorkspace reports visiblePanes (onVisiblePanesChange)
    teacherLiveReference: true, // the teacher's live work can be a student's stage reference
    unifiedStages: false, // Starter/Complete live in codeStages roles (the unified selector)
    teacherStageReveal: false, // StudentModal's Reveal menu offers the task's stages
    highlights: false, // teacher code highlights (needs a 'code' / 'files' studentMirror)
    downloadCode: false, // students can download the code as a .launchpad file (python only)
    fixedExplainer: false, // Scratch's fixed-width explainer column
    topicLibrary: true, // the explainer offers the topic library
    stageReveal: 'offer', // 'progressive' (python, html) | 'offer'
    studentMirror: 'view', // how StudentModal mirrors the student: 'code' | 'files' | 'blocks' | 'view'
    cardSummary: null, // StudentCard line: 'output' | 'blocks' | 'fs' | null
    focusPanes: [], // extra panes the teacher can highlight / force: [{ id, label }]
    teacherEditor: null, // consent-based teacher edit: { surface, workspace?, design? } | null
    sandboxState: 'code', // where teacher sandbox work lives: 'code' | 'blocks' | 'fs' | 'desktop' | 'files'
    // What Run does: 'runtime' (needs runResult + a UI runtime), 'preview', 'workspace' (the
    // workspace runs/checks and reports through cs.handleWorkspaceRun, like this scaffold's
    // Check button) or 'none'.
    run: 'workspace',
    // Optional (default false):
    teacherFillHeight: false, // TeacherView's centre column fills the height and clips
    teacherSandboxRow: false, // teacher sandbox workspace fills a plain flex row
    teacherUnifiedStageTabs: false, // teacher code tabs show stage roles, no Starter/Complete tabs
    explainerBlockMenu: false, // explainer editor offers Scratch block references
  },
  // runResult: { errorLine, turtle, liveCode } — required exactly when run is 'runtime'.

  // What the teacher sees on the Starter / stage / Complete tabs (liveState is the Starter work).
  getDisplayState: (task, stage, liveState, tab) => {
    if (tab === 'complete') return task?.completeCode ?? ''
    if (tab?.startsWith('stage_')) return stage?.code ?? ''
    return liveState
  },

  // ── Authoring (Builder) ──────────────────────────────────────────────────────
  // TODO(new-module): the task fields a new code task of this module starts with.
  makeCodeTaskFields: (task) => ({
    starterCode: task.starterCode ?? '',
    carryCodeFrom: task.carryCodeFrom ?? null,
  }),
  makeNewStage: (task, existing) => ({
    label:
      existing.length === 0
        ? 'Starter'
        : `Support ${existing.filter((stage) => stage.role === 'support').length + 1}`,
    role: existing.length === 0 ? 'starter' : 'support',
    code: existing.length === 0 ? (task.starterCode ?? '') : '',
  }),
  initCompleteTab: (task, { onUpdate }) => {
    if (task.completeCode == null) onUpdate({ ...task, completeCode: task.starterCode ?? '' })
  },
  initStageTab: null,
  defaultCheck: () => [{ type: 'code_contains', value: '' }],

  // Carry-through: a later task can start from this task's saved work.
  carryThroughField: 'carryCodeFrom',
  carryThroughLabel: 'Carry work from task',
  completeField: 'completeCode',
  getCarryThroughUpdates: (sourceTask) => ({
    starterCode: sourceTask.completeCode ?? sourceTask.starterCode ?? '',
  }),
  getNewStarterUpdates: () => ({ starterCode: '' }),

  // ── Feature flags (Builder check / mode UI) ──────────────────────────────────
  supportsInteractionMode: false,
  supportsIncorrectChecks: false,
  supportsTests: false,
  supportsVariableChecks: false,
  supportsDomChecks: false,

  stageLabels: { starterLabel: 'Starter', completeLabel: 'Complete' },
  explainerInlineCodeLanguages: [],
  explainerCodeBlockLanguages: [],

  // ── State helpers ────────────────────────────────────────────────────────────
  defaultState: '',
  initialState: (task) => starterCodeOf(task),
  serializeState: (state) => state,
  deserializeState: (raw) => (typeof raw === 'string' ? raw : ''),

  // ── Builder authoring (see ../moduleAuthoring.js and ../printHelpers.js) ──────────
  // TODO(new-module): what the Builder does with this module's tasks.
  authoring: {
    // A new task starts from the previous task's complete (else starter) work and carries it.
    defaultTypeFields: codeDefaultTypeFields,
    // Whether a draft task has no starter work yet (and missingStarterLabel names it).
    missingStarter: never,
    // "Reset to starter code" copies the starter into completeCode.
    copyStarterToComplete: codeCopyStarterToComplete,
    // The module's section of the printable lesson.
    printTask: printCodeStringTask,
    // The Sandbox starter modal's editor: 'code' | 'blocks' | 'fs' | 'circuit' | 'files'.
    sandboxStarterEditor: 'code',
    // The TaskEditor's Run: 'pyodide' | 'preview' | 'none' (nothing to run in the Builder).
    builderRun: 'none',
    // Optional: codeFormat { label, icon }, copyCodePlaceholder (with supportsCopyCode), and the
    // flags fileTabs, sharedTypeAssets, previewTypeAssets, spriteLibrary.
  },

  // ── Contract v2 (see ../moduleContract.js for the shared builders) ─────────────
  lifecycle: {
    // The state a teacher remote reset ('starter', 'complete', 'stage_<n>') puts in front of the
    // student, in this module's shape: { code }.
    resetTarget: codeResetTarget,
    hasComplete: codeHasComplete,
    // Complete has its own teacher tab (unifiedStages is false).
    teacherCompleteTab: () => true,
    sandboxStarter: (lesson, task) => lesson?.sandboxStarter ?? task?.starterCode ?? '',
    composedSandboxFields: (firstTask) => ({ sandboxStarter: firstTask?.starterCode ?? '' }),
    // The personal sandbox is offered when the lesson has a sandbox starter.
    hasPersonalSandbox: personalSandboxWhenLessonHas('sandboxStarter'),
    // Required when meta.playground is true: () => the playground's one task.
    playgroundTask: null,
  },
  // One localStorage record per task: { code, output, runStatus } (docs/agents/runtime-model.md).
  storage: recordStorage({ workKey: 'code', taskMeta: ['output', 'runStatus'] }),
  // The work travels as the `currentCode` / `sandboxCode` string itself.
  wire: codeStringWire(),
  // Checked when the workspace reports a run (its Check button → cs.handleWorkspaceRun).
  checking: { trigger: 'run', buildContext: codeCheckContext },
  // The work value is the text; starter / stage / complete / sandbox read the code fields.
  // TODO(new-module): teacherEdit needs capabilities.teacherEditor and meta.teacherEditCopy.
  workSlot: codeWorkSlot({ teacherEdit: false }),

  // ── Validation (shared by the Builder and the CLI; see ../moduleTaskValidation.js) ──
  // Document every message in docs/authoring/validation-errors.md (validationErrorsDoc.test.js).
  validateTask: (task, { n, errors, warnings }) => {
    validateTaskChecks(task, (checks, kind) =>
      validateCodeChecks(checks, n, errors, kind, { interactionMode: task.interactionMode })
    )
    if (task.check && normalizeChecks(task.check).some((check) => !isCodeCheck(check))) {
      warnings.push(
        `Task ${n} has a Template Module check that is not a code check — only code checks are evaluated`
      )
    }
    warnCompleteCode(task, n, warnings)
  },
  hasStarterContent: codeStarterPresent,
  hasCheckValue: null,
  validateTaskInBrowser: null,
})
