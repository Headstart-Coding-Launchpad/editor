import StudentWorkspace from './StudentWorkspace.jsx'
import BuilderWorkspace from './BuilderWorkspace.jsx'
import CheckEditor from './CheckEditor.jsx'
import TurtleTeacherLiveView from './TeacherLiveView.jsx'
import { initPyodide, isPyodideReady, runPython, stopPython, provideInput } from '../python/pyodide'
import { buildTurtleProgram } from './shim.js'
import { scrollLayoutStyles } from '../sharedStyles.js'

const { taskContentStyle, editorAreaStyle } = scrollLayoutStyles

const DEFAULT_STARTER_CODE =
  'import turtle\n\nturtle.forward(100)\nturtle.left(90)\nturtle.forward(100)\n'

const turtleModule = {
  type: 'turtle',
  StudentWorkspace,
  BuilderWorkspace,
  CheckEditor,
  TeacherLiveView: TurtleTeacherLiveView,

  getDisplayState: (task, stage, liveState, tab) => {
    if (tab === 'complete') return task?.completeCode ?? ''
    if (tab?.startsWith('stage_')) return stage?.code ?? ''
    return liveState
  },

  getLayoutStyles: () => ({ taskContentStyle, editorAreaStyle }),

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

  // ── State helpers ────────────────────────────────────────────────────────────
  defaultState: '',
  initialState: (task) => task.starterCode ?? DEFAULT_STARTER_CODE,
  serializeState: (state) => state,
  deserializeState: (raw) => (typeof raw === 'string' ? raw : ''),

  // ── Sandbox ──────────────────────────────────────────────────────────────────
  getSandboxState: (lesson, task) => lesson?.sandboxStarter ?? task?.starterCode ?? '',

  // ── Runtime ──────────────────────────────────────────────────────────────────
  runtime: {
    init: initPyodide,
    isReady: isPyodideReady,
    stop: stopPython,
    provideInput,
    run: (code, _task, callbacks) => runPython(buildTurtleProgram(code), callbacks),
    buildPreviewSrc: null,
    waitForPreviewText: null,
  },
}

export default turtleModule
