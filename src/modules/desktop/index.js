import { makeDefaultDesktop, normaliseDesktop, serializeDesktop, deserializeDesktop } from './desktopState.js'
import StudentWorkspace from './StudentWorkspace.jsx'
import BuilderWorkspace from './BuilderWorkspace.jsx'
import CheckEditor from './CheckEditor.jsx'
import DesktopTeacherLiveView from './TeacherLiveView.jsx'

export { makeDefaultDesktop }

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

const desktopModule = {
  type: 'desktop',
  StudentWorkspace,
  BuilderWorkspace,
  CheckEditor,
  FeedbackCheckEditor: CheckEditor,

  // ── Teacher-side editor ──────────────────────────────────────────────────────
  TeacherLiveView: DesktopTeacherLiveView,

  getDisplayState: (task, stage, liveState, tab) => {
    if (tab === 'complete') return task?.completeDesktop ?? makeDefaultDesktop(task?.availableApps)
    if (tab?.startsWith('stage_')) return stage?.desktop ?? makeDefaultDesktop(task?.availableApps)
    return liveState
  },

  // ── Layout ───────────────────────────────────────────────────────────────────
  getLayoutStyles: () => ({ taskContentStyle, editorAreaStyle }),

  // ── Authoring ────────────────────────────────────────────────────────────────
  makeCodeTaskFields: (task) => ({
    starterDesktop: task.starterDesktop ?? makeDefaultDesktop(task.availableApps ?? ['fileManager']),
    carryDesktopFrom: task.carryDesktopFrom ?? null,
    availableApps: task.availableApps ?? ['fileManager'],
  }),

  makeNewStage: (task, existing) => ({
    label: `Stage ${existing.length + 1}`,
    role: 'support',
    desktop: task.starterDesktop ? { ...task.starterDesktop } : makeDefaultDesktop(task.availableApps),
  }),

  initCompleteTab: null,
  initStageTab: null,

  defaultCheck: () => [{ type: 'fs_path', operator: 'exists', itemType: 'file', path: '' }],

  carryThroughField: 'carryDesktopFrom',
  carryThroughLabel: 'Carry desktop from task',
  getCarryThroughUpdates: (sourceTask) => ({
    starterDesktop: sourceTask.completeDesktop ?? sourceTask.starterDesktop ?? makeDefaultDesktop(sourceTask.availableApps),
  }),
  getNewStarterUpdates: () => ({
    starterDesktop: makeDefaultDesktop(),
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
  defaultState: makeDefaultDesktop(),
  initialState: (task) => normaliseDesktop(task.starterDesktop ?? makeDefaultDesktop(task.availableApps ?? ['fileManager'])),
  serializeState: (state) => serializeDesktop(state),
  deserializeState: (raw) => deserializeDesktop(raw),

  // ── Sandbox ──────────────────────────────────────────────────────────────────
  getSandboxState: (lesson, task) => {
    if (lesson?.sandboxStarterDesktop != null) {
      try { return normaliseDesktop(JSON.parse(JSON.stringify(lesson.sandboxStarterDesktop))) } catch {}
    }
    const desktop = task?.starterDesktop ?? makeDefaultDesktop(task?.availableApps ?? ['fileManager'])
    try { return normaliseDesktop(JSON.parse(JSON.stringify(desktop))) } catch { return makeDefaultDesktop() }
  },

  // ── Runtime ──────────────────────────────────────────────────────────────────
  runtime: null,
}

export default desktopModule
