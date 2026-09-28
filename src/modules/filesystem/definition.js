// Node-safe half of the Filesystem module (see ../defineModule.js). UI lives in index.js.
import { defineModule } from '../defineModule.js'
import { DEFAULT_FS } from './filesystem.js'

export default defineModule({
  type: 'filesystem',
  meta: {
    label: 'Filesystem',
    order: 5,
    shortLabel: 'Filesystem',
    icon: '🗂️',
    pickerHint: 'File manager',
    language: null,
    playground: false,
    surfaceLabels: { builderMeta: 'Files & Folders' },
  },
  capabilities: {
    sideExplainer: false,
    modulePanes: false,
    teacherLiveReference: true,
    unifiedStages: false,
    sandboxState: 'fs',
  },

  getDisplayState: (task, stage, liveState, tab) => {
    if (tab === 'complete') return task?.completeFs ?? DEFAULT_FS
    if (tab?.startsWith('stage_')) return stage?.fs ?? DEFAULT_FS
    return liveState
  },

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
  completeField: 'completeFs',
  carryThroughLabel: 'Carry filesystem from task',
  // Also patches codeStages[0].fs (see python/definition.js's getCarryThroughUpdates for why).
  getCarryThroughUpdates: (sourceTask, targetTask) => {
    const fs = sourceTask.completeFs ?? sourceTask.starterFs ?? DEFAULT_FS
    const updates = { starterFs: fs }
    if (targetTask?.codeStages?.length) {
      updates.codeStages = targetTask.codeStages.map((stage, i) =>
        i === 0 ? { ...stage, fs: { ...fs } } : stage
      )
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
  explainerCodeBlockLanguages: [],

  // ── State helpers ────────────────────────────────────────────────────────────
  defaultState: DEFAULT_FS,
  initialState: (task) => task.starterFs ?? DEFAULT_FS,
  serializeState: (state) => JSON.stringify(state),
  deserializeState: (raw) => {
    try {
      return JSON.parse(raw)
    } catch {
      return DEFAULT_FS
    }
  },

  // ── Sandbox ──────────────────────────────────────────────────────────────────
  getSandboxState: (lesson, task) => {
    if (lesson?.sandboxStarterFs != null) {
      try {
        return JSON.parse(JSON.stringify(lesson.sandboxStarterFs))
      } catch {}
    }
    const fs = task?.starterFs ?? DEFAULT_FS
    try {
      return JSON.parse(JSON.stringify(fs))
    } catch {
      return DEFAULT_FS
    }
  },
})
