import { DEFAULT_FS } from './filesystem'
import StudentWorkspace from './StudentWorkspace.jsx'
import BuilderWorkspace from './BuilderWorkspace.jsx'
import CheckEditor from './CheckEditor.jsx'
import FilesystemTeacherLiveView from './TeacherLiveView.jsx'

export { DEFAULT_FS }

const taskContentStyle = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  minHeight: 0,
  overflow: 'visible',
}

const editorAreaStyle = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  minHeight: 0,
}

const filesystemModule = {
  type: 'filesystem',
  StudentWorkspace,
  BuilderWorkspace,
  CheckEditor,

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
    fs: task.starterFs ? { ...task.starterFs } : DEFAULT_FS,
  }),

  initCompleteTab: null,
  initStageTab: null,

  defaultCheck: () => [{ type: 'fs_file_exists', path: '' }],

  carryThroughField: 'carryFsFrom',
  carryThroughLabel: 'Carry filesystem from task',
  getCarryThroughUpdates: (sourceTask) => ({
    starterFs: sourceTask.completeFs ?? sourceTask.starterFs ?? DEFAULT_FS,
  }),
  getNewStarterUpdates: () => ({
    starterFs: DEFAULT_FS,
  }),

  // ── Feature flags ────────────────────────────────────────────────────────────
  supportsInteractionMode: false,
  supportsIncorrectChecks: false,
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
