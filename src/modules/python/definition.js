// Node-safe half of the Python module (see ../defineModule.js). UI lives in index.js.
import { defineModule } from '../defineModule.js'
import { codeStagesField } from '../../shared/taskFields.js'
import {
  codeStarterPresent,
  validateCodeChecks,
  validatePythonTests,
  validateTaskChecks,
  warnCompleteCode,
} from '../moduleTaskValidation.js'
import { getStarterStage } from '../../shared/taskStages.js'
import {
  codeCheckContext,
  codeHasComplete,
  codeResetTarget,
  codeStringWire,
  codeWorkSlot,
  recordStorage,
  TEACHER_EDIT_CODE_COPY,
  alwaysPersonalSandbox,
  noLiveExtras,
  variablesPanelLiveExtra,
} from '../moduleContract.js'
import { SHOW_VARIABLES_TASK_FIELD } from '../../shared/variablesPanel/variablesPanel.js'
import { LAYOUT_TASK_FIELD, validateTaskLayout } from '../../shared/resultPane/resultPane.js'
import { validateShowVariables } from '../../shared/variablesPanel/validation.js'
import { PYTHON_SLOW_MO_TASK_FIELD, validatePythonSlowMo } from './slowMo/config.js'
import {
  PUZZLE_TASK_FIELD,
  validateLockedLines,
  validatePuzzle,
} from '../../shared/puzzle/puzzle.js'
import {
  SETUP_CODE_TASK_FIELD,
  SETUP_NOTE_TASK_FIELD,
  validateSetupCode,
} from '../../shared/puzzle/setupCode.js'
import { STAGE_TARGET_TASK_FIELD, validateStageTarget } from '../../shared/stage/validation.js'
import { compactStageForSync } from '../../shared/stage/sync.js'
import { SCRUB_TASK_FIELD, validateScrub } from '../../shared/scrub/scrubConfig.js'
import { RUN_ON_OPEN_TASK_FIELD, validateRunOnOpen } from '../../shared/scrub/runOnOpen.js'
import {
  codeCopyStarterToComplete,
  codeDefaultTypeFields,
  never,
  PYTHON_COPY_CODE_PLACEHOLDER,
} from '../moduleAuthoring.js'
import { printCodeStringTask } from '../printHelpers.js'

export default defineModule({
  type: 'python',
  meta: {
    teacherEditCopy: TEACHER_EDIT_CODE_COPY,
    label: 'Python',
    order: 0,
    shortLabel: 'Python',
    icon: '🐍',
    pickerHint: 'Workspace',
    language: 'python',
    playground: true,
  },
  capabilities: {
    // Saved to a matched student's class roster on Run / submission (src/shared/roster/).
    rosterWork: 'code',
    // Controls a tutor or a task's `highlight` field can pulse (src/shared/controlHighlight.js).
    // Run and Stop share one button, which carries data-highlight-target="run stop".
    highlightTargets: [
      { id: 'run', label: 'Run button' },
      { id: 'stop', label: 'Stop button' },
    ],
    stageReveal: 'progressive',
    teacherStageReveal: true,
    highlights: true,
    downloadCode: true,
    typingStats: true,
    fixedExplainer: false,
    topicLibrary: true,
    studentMirror: 'code',
    cardSummary: 'output',
    teacherEditor: { surface: 'code' },
    sideExplainer: true,
    modulePanes: true,
    teacherLiveReference: true,
    unifiedStages: true,
    sandboxState: 'code',
    teacherUnifiedStageTabs: true,
    run: 'runtime',
    // Authors hint at starter lines with `#> …` marker lines (src/shared/lineHints.js).
    lineHints: 'python',
    // A classmate can help (src/shared/peerHelp.js).
    peerHelp: { anchors: 'lines', hints: 'python' },
    // A passed task's side-quests run in a throwaway Python workspace (src/shared/sideQuests.js).
    sideQuests: true,
    // A task's `scrub` (src/shared/scrub/): a scrubbed value re-runs live only in programs that
    // draw on the Python Stage (import stage) and never ask for input().
    scrub: { liveRerun: 'preview', needsImport: 'stage', inputCall: 'input' },
  },
  // Pyodide reports the failing line on stderr; the editor highlights it. A run's Python Stage
  // drawing (src/shared/stage/) is written with the run (writeStudentStageResult).
  runResult: { errorLine: true, turtle: false, liveCode: false, stage: true },

  getDisplayState: (task, stage, liveState, tab) => {
    if (tab === 'complete') return task?.completeCode ?? ''
    if (tab?.startsWith('stage_')) return stage?.code ?? ''
    return liveState
  },

  // ── Authoring ────────────────────────────────────────────────────────────────
  makeCodeTaskFields: (task) => ({
    starterCode: task.starterCode ?? '',
    carryCodeFrom: task.carryCodeFrom ?? null,
    codeStages: task.codeStages ?? [
      { label: 'Starter', role: 'starter', code: task.starterCode ?? '' },
    ],
  }),

  makeNewStage: (task, existing) => ({
    label:
      existing.length === 0
        ? 'Starter'
        : `Support ${existing.filter((stage) => stage.role === 'support').length + 1}`,
    role: existing.length === 0 ? 'starter' : 'support',
    code: existing.length === 0 ? (task.starterCode ?? '') : '',
  }),

  // Legacy/read-compat: the Builder no longer creates or edits completeCode once a task
  // uses codeStages (TaskEditor.jsx and TeacherEditorPanel.jsx both treat python as a
  // unified-stages type, so the literal 'complete' tab this feeds is never rendered from
  // current UI). Left in place only so an older saved lesson still using completeCode
  // keeps reading correctly.
  initCompleteTab: (task, { onUpdate }) => {
    if (task.completeCode == null) {
      onUpdate({ ...task, completeCode: task.starterCode ?? '' })
    }
  },

  initStageTab: null,

  defaultCheck: (interactionMode) =>
    interactionMode === 'submit'
      ? [{ type: 'code_contains', value: '' }]
      : [{ type: 'output_contains', value: '' }],

  taskFields: [
    { name: 'starterCode', type: 'string', authored: true },
    { name: 'completeCode', type: 'string', authored: true },
    codeStagesField([{ name: 'code', type: 'string', authored: true }]),
    { name: 'copyCode', type: 'string', authored: true, description: 'Read-only code to copy.' },
    {
      name: 'showBlocks',
      type: 'boolean',
      description: 'Coloured block brackets in the Python editor (default true; false hides them).',
    },
    { name: 'interactionMode', type: 'string', values: ['run', 'submit'] },
    {
      name: 'tests',
      type: 'array',
      authored: true,
      itemFields: [
        { name: 'id', type: 'string', required: true },
        { name: 'name', type: 'string', authored: true },
        { name: 'inputs', type: 'array', authored: true },
        { name: 'check', type: 'object', required: true, authored: true },
      ],
    },
    { name: 'carryCodeFrom', type: 'string' },
    {
      name: 'carryCodeFromLesson',
      type: 'object',
      description:
        "{ lesson, task }: start from the student's own saved work on that task of an earlier lesson (stock ids; the tutor matches students to the class roster). Not with carryCodeFrom.",
    },
    SHOW_VARIABLES_TASK_FIELD,
    STAGE_TARGET_TASK_FIELD,
    SCRUB_TASK_FIELD,
    RUN_ON_OPEN_TASK_FIELD,
    PYTHON_SLOW_MO_TASK_FIELD,
    // Hidden setup and puzzle rules (src/shared/puzzle/).
    SETUP_CODE_TASK_FIELD,
    SETUP_NOTE_TASK_FIELD,
    PUZZLE_TASK_FIELD,
    // Which result tab shows first on smaller screens (src/shared/resultPane/).
    LAYOUT_TASK_FIELD,
  ],
  carryThroughField: 'carryCodeFrom',
  completeField: 'completeCode',
  carryThroughLabel: 'Carry code from task',
  // Also patches codeStages[0].code so the carried code actually shows up in the Builder's
  // Starter tab once a task has stages — the legacy starterCode field alone is no longer
  // what the current-convention UI (or the student runtime) reads once a stage exists.
  getCarryThroughUpdates: (sourceTask, targetTask) => {
    const code = sourceTask.completeCode ?? sourceTask.starterCode ?? ''
    const updates = { starterCode: code }
    if (targetTask?.codeStages?.length) {
      updates.codeStages = targetTask.codeStages.map((stage, i) =>
        i === 0 ? { ...stage, code } : stage
      )
    }
    return updates
  },
  getNewStarterUpdates: () => ({
    starterCode: '',
  }),

  // ── Feature flags ────────────────────────────────────────────────────────────
  supportsInteractionMode: true,
  supportsIncorrectChecks: true,
  supportsTests: true,
  supportsVariableChecks: true,
  supportsDomChecks: false,
  supportsCopyCode: true,

  stageLabels: { starterLabel: 'Starter', completeLabel: 'Complete' },
  explainerInlineCodeLanguages: ['python'],
  explainerCodeBlockLanguages: ['python'],

  // ── State helpers ────────────────────────────────────────────────────────────
  defaultState: '',
  // codeStages-aware, matching selectPythonTaskCode's non-carry-through fallback (the real
  // per-student resolver, src/app/studentTaskContent.js) — this hook's single-task contract
  // has no access to saved state or the task list, so it can't replicate carry-through, but
  // it must still prefer a starter stage's code over the legacy starterCode field so it's
  // correct if ever actually invoked (currently it isn't — see moduleInterface.test.js).
  initialState: (task) => getStarterStage(task)?.stage?.code ?? task.starterCode ?? '',
  serializeState: (state) => state,
  deserializeState: (raw) => (typeof raw === 'string' ? raw : ''),

  // ── Builder authoring hooks (see ../defineModule.js, "authoring") ─────────────
  authoring: {
    defaultTypeFields: codeDefaultTypeFields,
    missingStarter: never,
    copyStarterToComplete: codeCopyStarterToComplete,
    printTask: printCodeStringTask,
    sandboxStarterEditor: 'code',
    builderRun: 'pyodide',
    copyCodePlaceholder: PYTHON_COPY_CODE_PLACEHOLDER,
  },

  // ── Contract v2 (see ../moduleContract.js) ───────────────────────────────────
  lifecycle: {
    playgroundTask: () => ({ id: 1, title: 'Python playground', starterCode: '' }),
    hasPersonalSandbox: alwaysPersonalSandbox,
    resetTarget: codeResetTarget,
    hasComplete: codeHasComplete,
    // Complete lives in the unified code stages, not a separate teacher tab.
    teacherCompleteTab: () => false,
    sandboxStarter: (lesson, task) => lesson?.sandboxStarter ?? task?.starterCode ?? '',
    composedSandboxFields: (firstTask) => ({ sandboxStarter: firstTask?.starterCode ?? '' }),
  },
  storage: recordStorage({ workKey: 'code', taskMeta: ['output', 'runStatus'] }),
  // The name-tag panel (showVariables) and the Python Stage drawing travel with a Go Live
  // broadcast (the stage compacted like students/{id}/currentStageResult).
  wire: codeStringWire({
    liveExtras: (input = {}) => ({
      ...noLiveExtras(),
      ...variablesPanelLiveExtra(input),
      stage: compactStageForSync(input.stage),
    }),
  }),
  // Generic work slot (useStudentCodeState): the code string, checked when it runs.
  checking: { trigger: 'run', buildContext: codeCheckContext },
  workSlot: codeWorkSlot({ teacherSandboxReset: true }),

  // ── Validation (shared by the Builder and the CLI; see ../moduleTaskValidation.js) ──
  validateTask: (task, { n, errors, warnings }) => {
    validateTaskChecks(task, (checks, kind) =>
      validateCodeChecks(checks, n, errors, kind, { interactionMode: task.interactionMode })
    )
    validatePythonTests(task, n, errors, warnings)
    warnCompleteCode(task, n, warnings)
    validateShowVariables(task, n, errors, warnings)
    validateStageTarget(task, n, errors, warnings)
    validateScrub(task, n, errors, warnings, {
      starterCode: getStarterStage(task)?.stage?.code ?? task.starterCode ?? null,
    })
    validateRunOnOpen(task, n, errors, warnings, {
      starterCode: getStarterStage(task)?.stage?.code ?? task.starterCode ?? null,
    })
    validatePythonSlowMo(task, n, errors, warnings)
    validateSetupCode(task, n, errors, warnings)
    validatePuzzle(task, n, errors, warnings)
    validateLockedLines(task, n, warnings)
    validateTaskLayout(task, n, errors, warnings)
  },
  hasStarterContent: codeStarterPresent,
})
