// Node-safe half of the Python Turtle module (see ../defineModule.js). UI and the Pyodide
// runtime bridge live in index.js.
import { defineModule } from '../defineModule.js'
import { codeStarterPresent, validateTaskChecks } from '../moduleTaskValidation.js'
import { validateTurtleChecks } from '../../shared/checkAuthoringValidation.js'
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
import { compactTurtleResultForSync } from './sync.js'

const DEFAULT_STARTER_CODE =
  'import turtle\n\nturtle.forward(100)\nturtle.left(90)\nturtle.forward(100)\n'

export default defineModule({
  type: 'turtle',
  meta: {
    teacherEditCopy: TEACHER_EDIT_CODE_COPY,
    label: 'Python Turtle',
    order: 2,
    shortLabel: 'Turtle',
    icon: '🐢',
    pickerHint: 'Workspace',
    language: 'python',
    playground: false,
    surfaceLabels: { stageReference: 'Python' },
  },
  capabilities: {
    stageReveal: 'offer',
    teacherStageReveal: false,
    highlights: false,
    downloadCode: false,
    fixedExplainer: false,
    topicLibrary: true,
    studentMirror: 'view',
    teacherEditor: { surface: 'code' },
    sideExplainer: true,
    modulePanes: true,
    teacherLiveReference: true,
    unifiedStages: true,
    sandboxState: 'code',
    run: 'runtime',
  },
  // The run's drawing is synced with the run (a run result, like output).
  runResult: { errorLine: false, turtle: true, liveCode: false },

  getDisplayState: (task, stage, liveState, tab) => {
    if (tab === 'complete') return task?.completeCode ?? ''
    if (tab?.startsWith('stage_')) return stage?.code ?? ''
    return liveState
  },

  makeCodeTaskFields: (task) => {
    const starterCode = task.starterCode ?? DEFAULT_STARTER_CODE
    return {
      starterCode,
      carryCodeFrom: task.carryCodeFrom ?? null,
      codeStages: task.codeStages ?? [{ label: 'Starter', role: 'starter', code: starterCode }],
    }
  },

  makeNewStage: (task, existing) => ({
    label:
      existing.length === 0
        ? 'Starter'
        : `Support ${existing.filter((stage) => stage.role === 'support').length + 1}`,
    role: existing.length === 0 ? 'starter' : 'support',
    code: existing.length === 0 ? (task.starterCode ?? DEFAULT_STARTER_CODE) : '',
  }),

  initCompleteTab: (task, { onUpdate }) => {
    if (task.completeCode == null) onUpdate({ ...task, completeCode: task.starterCode ?? '' })
  },

  initStageTab: null,

  defaultCheck: () => [
    { type: 'turtle_segment_count', operator: 'greater_than_or_equal', value: '1' },
  ],

  carryThroughField: 'carryCodeFrom',
  completeField: 'completeCode',
  carryThroughLabel: 'Carry code from task',
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
  getNewStarterUpdates: () => ({ starterCode: '' }),

  // ── Feature flags ────────────────────────────────────────────────────────────
  // Matches Arcade Kit: draw-and-check tasks, not submit-based text output.
  supportsInteractionMode: false,
  supportsIncorrectChecks: true,
  supportsTests: false,
  supportsVariableChecks: false,
  supportsDomChecks: false,
  supportsCopyCode: true,

  stageLabels: { starterLabel: 'Starter', completeLabel: 'Complete' },
  explainerInlineCodeLanguages: ['python'],
  explainerCodeBlockLanguages: ['python'],

  // ── State helpers ────────────────────────────────────────────────────────────
  defaultState: '',
  initialState: (task) => task.starterCode ?? DEFAULT_STARTER_CODE,
  serializeState: (state) => state,
  deserializeState: (raw) => (typeof raw === 'string' ? raw : ''),

  // ── Contract v2 (see ../moduleContract.js) ───────────────────────────────────
  lifecycle: {
    hasPersonalSandbox: alwaysPersonalSandbox,
    resetTarget: codeResetTarget,
    hasComplete: codeHasComplete,
    teacherCompleteTab: () => false,
    sandboxStarter: (lesson, task) => lesson?.sandboxStarter ?? task?.starterCode ?? '',
    // Composed lessons have never derived a turtle sandbox starter from the first task.
    composedSandboxFields: () => ({}),
  },
  storage: recordStorage({ workKey: 'code', taskMeta: ['output', 'runStatus'] }),
  // The drawing is a run result; it is compacted before it travels on teacherLive.
  wire: codeStringWire({
    liveExtras: ({ turtleResult } = {}) => ({
      arcadeDesign: null,
      turtleResult: compactTurtleResultForSync(turtleResult),
    }),
  }),
  // Generic work slot (useStudentCodeState): the code string, checked when it runs.
  checking: { trigger: 'run', buildContext: codeCheckContext },
  workSlot: codeWorkSlot({ teacherSandboxReset: true }),

  // ── Validation (shared by the Builder and the CLI; see ../moduleTaskValidation.js) ──
  validateTask: (task, { n, errors }) => {
    validateTaskChecks(task, (checks, kind) => validateTurtleChecks(checks, n, errors, kind))
  },
  hasStarterContent: codeStarterPresent,
})
