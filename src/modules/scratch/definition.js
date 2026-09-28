// Node-safe half of the Scratch module (see ../defineModule.js). UI lives in index.js.
import { defineModule } from '../defineModule.js'
import {
  anyCheckHasValue,
  validateScratchChecks,
  validateTaskChecks,
} from '../moduleTaskValidation.js'
import { jsonWire, recordStorage, stageForAction, starterStageOf } from '../moduleContract.js'

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
    // The stage runs inside the workspace, which reports its checks (handleScratchCheck).
    run: 'workspace',
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

  // ── Contract v2 (see ../moduleContract.js) ───────────────────────────────────
  lifecycle: {
    // Only a stage reset leaves a stage active; starter and complete clear it.
    resetTarget: (task, action) => {
      if (action === 'complete') return { blocks: task.completeBlocks ?? null, stageIndex: null }
      if (action === 'starter') {
        return {
          blocks: starterStageOf(task)?.blocks ?? task.starterBlocks ?? null,
          stageIndex: null,
        }
      }
      const { stage, stageIndex } = stageForAction(task, action)
      return {
        blocks: stage?.blocks ?? task.starterBlocks ?? null,
        stageIndex: stage ? stageIndex : null,
      }
    },
    hasComplete: (task) => !!task?.completeBlocks,
    teacherCompleteTab: (task) => task?.completeBlocks != null,
    sandboxStarter: (lesson, task) => {
      if (lesson?.sandboxStarter != null) {
        try {
          return JSON.parse(lesson.sandboxStarter)
        } catch {}
      }
      return task?.starterBlocks ?? null
    },
    // Lesson-level Scratch sandbox starters are stored as a JSON string.
    composedSandboxFields: (firstTask) => {
      const blocks = firstTask?.starterBlocks ?? null
      return { sandboxStarter: blocks == null ? null : JSON.stringify(blocks) }
    },
  },
  storage: recordStorage({ workKey: 'state' }),
  wire: jsonWire(),

  // ── Validation (shared by the Builder and the CLI; see ../moduleTaskValidation.js) ──
  validateTask: (task, { n, errors }) => {
    validateTaskChecks(task, (checks, kind) => validateScratchChecks(checks, n, errors, kind))
  },
  hasStarterContent: (task) => !!task.starterBlocks,
  hasCheckValue: anyCheckHasValue,
  // Builder only: the CLI has no XML parser, so the toolbox is checked where DOMParser exists.
  validateTaskInBrowser: (task, { n, errors }) => {
    if (!task.toolbox) return
    try {
      const parsed = new globalThis.DOMParser().parseFromString(task.toolbox, 'text/xml')
      if (parsed.querySelector('parsererror')) errors.push(`Task ${n} has invalid toolbox XML`)
    } catch {
      errors.push(`Task ${n} has invalid toolbox XML`)
    }
  },
})
