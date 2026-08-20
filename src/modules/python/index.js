import StudentWorkspace from './StudentWorkspace.jsx'
import BuilderWorkspace from './BuilderWorkspace.jsx'
import CheckEditor from './CheckEditor.jsx'
import PythonTeacherLiveView from './TeacherLiveView.jsx'
import { initPyodide, isPyodideReady, runPython, stopPython, provideInput } from './pyodide'
import { scrollLayoutStyles } from '../sharedStyles.js'
import { getStarterStage } from '../../shared/taskUtils.js'

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

  defaultCheck: (interactionMode) => interactionMode === 'submit'
    ? [{ type: 'code_contains', value: '' }]
    : [{ type: 'output_contains', value: '' }],

  carryThroughField: 'carryCodeFrom',
  carryThroughLabel: 'Carry code from task',
  // Also patches codeStages[0].code so the carried code actually shows up in the Builder's
  // Starter tab once a task has stages — the legacy starterCode field alone is no longer
  // what the current-convention UI (or the student runtime) reads once a stage exists.
  getCarryThroughUpdates: (sourceTask, targetTask) => {
    const code = sourceTask.completeCode ?? sourceTask.starterCode ?? ''
    const updates = { starterCode: code }
    if (targetTask?.codeStages?.length) {
      updates.codeStages = targetTask.codeStages.map((stage, i) => i === 0 ? { ...stage, code } : stage)
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

  // ── State helpers ────────────────────────────────────────────────────────────
  defaultState: '',
  // codeStages-aware, matching selectPythonTaskCode's non-carry-through fallback (the real
  // per-student resolver, src/app/studentTaskContent.js) — this hook's single-task contract
  // has no access to saved state or the task list, so it can't replicate carry-through, but
  // it must still prefer a starter stage's code over the legacy starterCode field so it's
  // correct if ever actually invoked (currently it isn't — see moduleInterface.test.js).
  initialState: (task) => getStarterStage(task)?.stage?.code ?? task.starterCode ?? '',
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
