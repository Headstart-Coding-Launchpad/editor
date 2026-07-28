import StudentWorkspace from './StudentWorkspace.jsx'
import BuilderWorkspace from './BuilderWorkspace.jsx'
import CheckEditor from './CheckEditor.jsx'
import PythonTeacherLiveView from './TeacherLiveView.jsx'
import { initPyodide, isPyodideReady, runPython, stopPython, provideInput } from './pyodide'
import { scrollLayoutStyles } from '../sharedStyles.js'

const { taskContentStyle, editorAreaStyle } = scrollLayoutStyles

const pythonModule = {
  type: 'python',
  StudentWorkspace,
  BuilderWorkspace,
  CheckEditor,

  // ── Teacher-side editor ──────────────────────────────────────────────────────
  TeacherLiveView: PythonTeacherLiveView,

  getDisplayState: (task, stage, liveState, tab) => {
    if (tab === 'complete') return task?.completeCode ?? ''
    if (tab?.startsWith('stage_')) return stage?.code ?? ''
    return liveState
  },

  // ── Layout ───────────────────────────────────────────────────────────────────
  getLayoutStyles: () => ({ taskContentStyle, editorAreaStyle }),

  // ── Authoring ────────────────────────────────────────────────────────────────
  makeCodeTaskFields: (task) => ({
    starterCode: task.starterCode ?? '',
    carryCodeFrom: task.carryCodeFrom ?? null,
    codeStages: task.codeStages ?? [{ label: 'Starter', role: 'starter', code: task.starterCode ?? '' }],
  }),

  makeNewStage: (task, existing) => ({
    label: existing.length === 0 ? 'Starter' : `Support ${existing.filter(stage => stage.role === 'support').length + 1}`,
    role: existing.length === 0 ? 'starter' : 'support',
    code: existing.length === 0 ? (task.starterCode ?? '') : '',
  }),

  initCompleteTab: (task, { onUpdate }) => {
    if (task.completeCode == null) {
      onUpdate({ ...task, completeCode: task.starterCode ?? '' })
    }
  },

  initStageTab: null,

  defaultCheck: (interactionMode) => interactionMode === 'submit'
    ? [{ type: 'code_contains', value: '' }]
    : [{ type: 'output_contains', value: '' }],

  carryThroughField: 'carryCodeFrom',
  carryThroughLabel: 'Carry code from task',
  getCarryThroughUpdates: (sourceTask) => ({
    starterCode: sourceTask.completeCode ?? sourceTask.starterCode ?? '',
  }),
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

  // ── State helpers ────────────────────────────────────────────────────────────
  defaultState: '',
  initialState: (task) => task.starterCode ?? '',
  serializeState: (state) => state,
  deserializeState: (raw) => typeof raw === 'string' ? raw : '',

  // ── Sandbox ──────────────────────────────────────────────────────────────────
  getSandboxState: (lesson, task) => lesson?.sandboxStarter ?? task?.starterCode ?? '',

  // ── Runtime ──────────────────────────────────────────────────────────────────
  runtime: {
    init: initPyodide,
    isReady: isPyodideReady,
    stop: stopPython,
    provideInput,
    run: (code, _task, callbacks) => runPython(code, callbacks),
    buildPreviewSrc: null,
    waitForPreviewText: null,
  },
}

export default pythonModule
