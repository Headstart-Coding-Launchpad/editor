// Node-safe half of the Python module (see ../defineModule.js). UI lives in index.js.
import { defineModule } from '../defineModule.js'
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
} from '../moduleContract.js'

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
    stageReveal: 'progressive',
    teacherStageReveal: true,
    highlights: true,
    downloadCode: true,
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
    run: 'runtime',
  },
  // Pyodide reports the failing line on stderr; the editor highlights it.
  runResult: { errorLine: true, turtle: false, liveCode: false },

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

  // ── Contract v2 (see ../moduleContract.js) ───────────────────────────────────
  lifecycle: {
    hasPersonalSandbox: alwaysPersonalSandbox,
    resetTarget: codeResetTarget,
    hasComplete: codeHasComplete,
    // Complete lives in the unified code stages, not a separate teacher tab.
    teacherCompleteTab: () => false,
    sandboxStarter: (lesson, task) => lesson?.sandboxStarter ?? task?.starterCode ?? '',
    composedSandboxFields: (firstTask) => ({ sandboxStarter: firstTask?.starterCode ?? '' }),
  },
  storage: recordStorage({ workKey: 'code', taskMeta: ['output', 'runStatus'] }),
  wire: codeStringWire(),
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
  },
  hasStarterContent: codeStarterPresent,
})
