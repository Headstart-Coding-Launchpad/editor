// Node-safe half of the Scratch module (see ../defineModule.js). UI lives in index.js.
import { defineModule } from '../defineModule.js'

export default defineModule({
  type: 'scratch',
  meta: {
    label: 'Scratch',
    order: 3,
    shortLabel: 'Scratch',
    icon: '🧩',
    pickerHint: 'Workspace',
    language: null,
    playground: true,
  },
  capabilities: {
    sideExplainer: true,
    modulePanes: false,
    teacherLiveReference: false,
    unifiedStages: true,
    sandboxState: 'blocks',
  },

  getDisplayState: (task, stage, liveState, tab) => {
    if (tab === 'complete') return task?.completeBlocks ?? null
    if (tab?.startsWith('stage_')) return stage?.blocks ?? null
    return liveState
  },

  // ── Authoring ────────────────────────────────────────────────────────────────
  makeCodeTaskFields: (task) => ({
    toolbox: task.toolbox ?? '',
    starterBlocks: task.starterBlocks ?? null,
    carryBlocksFrom: task.carryBlocksFrom ?? null,
    codeStages: task.codeStages ?? [
      {
        label: 'Starter',
        role: 'starter',
        blocks: task.starterBlocks ?? null,
        predefinedBlocks: task.predefinedBlocks ?? null,
        prebuiltStacks: task.prebuiltStacks ?? null,
      },
    ],
  }),

  makeNewStage: (task, existing) =>
    existing.length === 0
      ? {
          label: 'Starter',
          role: 'starter',
          blocks: task.starterBlocks ?? null,
          predefinedBlocks: task.predefinedBlocks ?? null,
          prebuiltStacks: task.prebuiltStacks ?? null,
        }
      : {
          label: `Support ${existing.filter((stage) => stage.role === 'support').length + 1}`,
          role: 'support',
          markdown: '',
        },

  initCompleteTab: null,
  initStageTab: null,

  defaultCheck: () => [{ type: 'block_used', evaluation: 'after_run', opcode: 'motion_movesteps' }],

  carryThroughField: 'carryBlocksFrom',
  completeField: 'completeBlocks',
  carryThroughLabel: 'Carry blocks from task',
  // Also patches codeStages[0].blocks (see python/definition.js's getCarryThroughUpdates for
  // why) and carries enableStageCode across — without it, a carried __stage__ blocks entry has
  // no Stage workspace to render in, so the carried Stage script becomes silently inert.
  getCarryThroughUpdates: (sourceTask, targetTask) => {
    const blocks = sourceTask.completeBlocks ?? sourceTask.starterBlocks ?? null
    const updates = {
      starterBlocks: blocks,
      sprites: JSON.parse(JSON.stringify(sourceTask.sprites ?? [])),
      backdrops: JSON.parse(JSON.stringify(sourceTask.backdrops ?? [])),
      variables: JSON.parse(JSON.stringify(sourceTask.variables ?? [])),
      enableStageCode: sourceTask.enableStageCode ?? false,
    }
    if (targetTask?.codeStages?.length) {
      updates.codeStages = targetTask.codeStages.map((stage, i) =>
        i === 0 ? { ...stage, blocks } : stage
      )
    }
    return updates
  },
  getNewStarterUpdates: () => ({
    starterBlocks: null,
  }),

  // ── Feature flags ────────────────────────────────────────────────────────────
  supportsInteractionMode: false,
  supportsIncorrectChecks: true,
  supportsTests: false,
  supportsVariableChecks: false,
  supportsDomChecks: false,

  stageLabels: { starterLabel: 'Starter', completeLabel: 'Complete' },
  explainerInlineCodeLanguages: ['scratch'],
  explainerCodeBlockLanguages: ['scratch', 'html', 'css', 'javascript'],

  // ── State helpers ────────────────────────────────────────────────────────────
  defaultState: null,
  initialState: (task) => task.starterBlocks ?? null,
  serializeState: (state) => (state == null ? null : JSON.stringify(state)),
  deserializeState: (raw) => {
    if (raw == null) return null
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw)
      } catch {
        return null
      }
    }
    return raw
  },

  // ── Sandbox ──────────────────────────────────────────────────────────────────
  getSandboxState: (lesson, task) => {
    if (lesson?.sandboxStarter != null) {
      try {
        return JSON.parse(lesson.sandboxStarter)
      } catch {}
    }
    return task?.starterBlocks ?? null
  },
})
