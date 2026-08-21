import { DEFAULT_FS } from './filesystem'
import StudentWorkspace from './StudentWorkspace.jsx'
import BuilderWorkspace from './BuilderWorkspace.jsx'
import CheckEditor from './CheckEditor.jsx'
import FilesystemTeacherLiveView from './TeacherLiveView.jsx'
import { flexLayoutStyles } from '../sharedStyles.js'

export { DEFAULT_FS }

const { taskContentStyle, editorAreaStyle } = flexLayoutStyles

const filesystemModule = {
  type: 'filesystem',
  StudentWorkspace,
  BuilderWorkspace,
  CheckEditor,
  FeedbackCheckEditor: CheckEditor,

  // ── Teacher-side editor ──────────────────────────────────────────────────────
  TeacherLiveView: FilesystemTeacherLiveView,

  getDisplayState: (task, stage, liveState, tab) => {
    if (tab === 'complete') return task?.completeFs ?? DEFAULT_FS
    if (tab?.startsWith('stage_')) return stage?.fs ?? DEFAULT_FS
    return liveState
  },

  // ── Layout ───────────────────────────────────────────────────────────────────
  getLayoutStyles: () => ({ taskContentStyle, editorAreaStyle }),

  // ── Authoring ────────────────────────────────────────────────────────────────
  makeCodeTaskFields: (task) => ({
    starterFs: task.starterFs ?? DEFAULT_FS,
    carryFsFrom: task.carryFsFrom ?? null,
  }),

  makeNewStage: (task, existing) => ({
    label: `Stage ${existing.length + 1}`,
    role: 'support',
    fs: task.starterFs ? { ...task.starterFs } : DEFAULT_FS,
  }),

  initCompleteTab: null,
  initStageTab: null,

  defaultCheck: () => [{ type: 'fs_path', operator: 'exists', itemType: 'file', path: '' }],

  carryThroughField: 'carryFsFrom',
  carryThroughLabel: 'Carry filesystem from task',
  // Also patches codeStages[0].fs (see python/index.js's getCarryThroughUpdates for why).
  getCarryThroughUpdates: (sourceTask, targetTask) => {
    const fs = sourceTask.completeFs ?? sourceTask.starterFs ?? DEFAULT_FS
    const updates = { starterFs: fs }
    if (targetTask?.codeStages?.length) {
      updates.codeStages = targetTask.codeStages.map((stage, i) => i === 0 ? { ...stage, fs: { ...fs } } : stage)
    }
    return updates
  },
  getNewStarterUpdates: () => ({
    starterFs: DEFAULT_FS,
  }),

  // ── Feature flags ────────────────────────────────────────────────────────────
  supportsInteractionMode: false,
  supportsIncorrectChecks: true,
  supportsTests: false,
  supportsVariableChecks: false,
  supportsDomChecks: false,

  stageLabels: { starterLabel: 'Starter', completeLabel: 'Complete' },
  explainerInlineCodeLanguages: [],

  // ── State helpers ────────────────────────────────────────────────────────────
  defaultState: DEFAULT_FS,
  initialState: (task) => task.starterFs ?? DEFAULT_FS,
  serializeState: (state) => JSON.stringify(state),
  deserializeState: (raw) => {
    try { return JSON.parse(raw) } catch { return DEFAULT_FS }
  },

  // ── Sandbox ──────────────────────────────────────────────────────────────────
  getSandboxState: (lesson, task) => {
    if (lesson?.sandboxStarterFs != null) {
      try { return JSON.parse(JSON.stringify(lesson.sandboxStarterFs)) } catch {}
    }
    const fs = task?.starterFs ?? DEFAULT_FS
    try { return JSON.parse(JSON.stringify(fs)) } catch { return DEFAULT_FS }
  },

  // ── Runtime ──────────────────────────────────────────────────────────────────
  runtime: null,
}

export default filesystemModule
