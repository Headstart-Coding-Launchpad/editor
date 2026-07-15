import ScratchWorkspace from './StudentWorkspace.jsx'
import { SPRITE_TYPES } from './ScratchWorkspace.jsx'
import BuilderWorkspace from './BuilderWorkspace.jsx'
import CheckEditor from './CheckEditor.jsx'
import ScratchTeacherLiveView from './TeacherLiveView.jsx'
import { DEFAULT_SPRITES } from './checks'

export { DEFAULT_SPRITES, SPRITE_TYPES }

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

const scratchModule = {
  type: 'scratch',
  StudentWorkspace: ScratchWorkspace,
  BuilderWorkspace,
  CheckEditor,

  // ── Teacher-side editor ──────────────────────────────────────────────────────
  TeacherLiveView: ScratchTeacherLiveView,

  getDisplayState: (task, stage, liveState, tab) => {
    if (tab === 'complete') return task?.completeBlocks ?? null
    if (tab?.startsWith('stage_')) return stage?.blocks ?? null
    return liveState
  },

  // ── Layout ───────────────────────────────────────────────────────────────────
  getLayoutStyles: () => ({ taskContentStyle, editorAreaStyle }),

  // ── Authoring ────────────────────────────────────────────────────────────────
  makeCodeTaskFields: (task) => ({
    toolbox: task.toolbox ?? '',
    starterBlocks: task.starterBlocks ?? null,
    carryBlocksFrom: task.carryBlocksFrom ?? null,
  }),

  makeNewStage: null,

  initCompleteTab: null,
  initStageTab: null,

  defaultCheck: () => [{ type: 'block_used', evaluation: 'after_run', opcode: 'motion_movesteps' }],

  carryThroughField: 'carryBlocksFrom',
  carryThroughLabel: 'Carry blocks from task',
  getCarryThroughUpdates: (sourceTask) => ({
    starterBlocks: sourceTask.completeBlocks ?? sourceTask.starterBlocks ?? null,
    sprites: JSON.parse(JSON.stringify(sourceTask.sprites ?? [])),
    backdrops: JSON.parse(JSON.stringify(sourceTask.backdrops ?? [])),
    variables: JSON.parse(JSON.stringify(sourceTask.variables ?? [])),
  }),
  getNewStarterUpdates: () => ({
    starterBlocks: null,
  }),

  // ── Feature flags ────────────────────────────────────────────────────────────
  supportsInteractionMode: false,
  supportsIncorrectChecks: false,
  supportsTests: false,
  supportsVariableChecks: false,
  supportsDomChecks: false,

  stageLabels: { starterLabel: 'Starter', completeLabel: 'Complete' },
  explainerInlineCodeLanguages: ['scratch'],

  // ── State helpers ────────────────────────────────────────────────────────────
  defaultState: null,
  initialState: (task) => task.starterBlocks ?? null,
  serializeState: (state) => state == null ? null : JSON.stringify(state),
  deserializeState: (raw) => {
    if (raw == null) return null
    if (typeof raw === 'string') {
      try { return JSON.parse(raw) } catch { return null }
    }
    return raw
  },

  // ── Sandbox ──────────────────────────────────────────────────────────────────
  getSandboxState: (lesson, task) => {
    if (lesson?.sandboxStarter != null) {
      try { return JSON.parse(lesson.sandboxStarter) } catch {}
    }
    return task?.starterBlocks ?? null
  },

  // ── Runtime ──────────────────────────────────────────────────────────────────
  runtime: null,
}

export default scratchModule
