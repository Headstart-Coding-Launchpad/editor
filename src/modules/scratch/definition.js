// Node-safe half of the Scratch module (see ../defineModule.js). UI lives in index.js.
import { defineModule } from '../defineModule.js'
import { codeStagesField } from '../../shared/taskFields.js'
import {
  anyCheckHasValue,
  validateScratchChecks,
  validateTaskChecks,
} from '../moduleTaskValidation.js'
import {
  identityFromStored,
  identityStored,
  jsonWire,
  recordStorage,
  stageForAction,
  starterStageOf,
  personalSandboxWhenLessonHas,
} from '../moduleContract.js'
import { never, noUpdates } from '../moduleAuthoring.js'
import { createSpriteFromPreset } from '../../shared/spritePresets.js'
import { printScratchTask } from './print.js'

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value))
}

export default defineModule({
  type: 'scratch',
  meta: {
    teacherEditCopy: {
      action: 'Edit Blocks',
      consent:
        'Your teacher would like to edit your Scratch blocks to help you. You will see their changes live.',
    },
    label: 'Scratch',
    order: 3,
    shortLabel: 'Scratch',
    icon: '🧩',
    pickerHint: 'Workspace',
    language: null,
    playground: true,
    pickerOrder: 4,
  },
  capabilities: {
    stageReveal: 'offer',
    teacherStageReveal: true,
    highlights: false,
    downloadCode: false,
    fixedExplainer: true,
    topicLibrary: false,
    studentMirror: 'blocks',
    cardSummary: 'blocks',
    focusPanes: [
      { id: 'blocks', label: 'Blocks' },
      { id: 'stage', label: 'Stage' },
    ],
    teacherEditor: { surface: 'blocks' },
    sideExplainer: true,
    modulePanes: false,
    teacherLiveReference: false,
    unifiedStages: true,
    sandboxState: 'blocks',
    teacherFillHeight: true,
    teacherSandboxRow: true,
    explainerBlockMenu: true,
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

  taskFields: [
    { name: 'starterBlocks', type: 'object', authored: true },
    { name: 'completeBlocks', type: 'object', authored: true },
    codeStagesField([
      { name: 'blocks', type: 'object', authored: true },
      { name: 'predefinedBlocks', type: 'object', authored: true },
      { name: 'prebuiltStacks', type: 'array', authored: true },
      {
        name: 'markdown',
        type: 'string',
        authored: true,
        description: 'Support stages: the reference the student reads.',
      },
    ]),
    { name: 'sprites', type: 'array', authored: true },
    { name: 'backdrops', type: 'array', authored: true },
    { name: 'variables', type: 'array', authored: true },
    { name: 'toolbox', type: 'string', authored: true },
    { name: 'predefinedBlocks', type: 'object', authored: true },
    { name: 'prebuiltStacks', type: 'array', authored: true },
    { name: 'allowAddSprite', type: 'boolean' },
    { name: 'addSpritePresetIds', type: 'array' },
    { name: 'allowAddBackdrop', type: 'boolean' },
    { name: 'addBackdropPresetIds', type: 'array' },
    { name: 'allowCreateVariable', type: 'boolean' },
    { name: 'allowRemoveSprite', type: 'boolean' },
    { name: 'allowRemoveStarterSprites', type: 'boolean' },
    { name: 'enableStageCode', type: 'boolean' },
    { name: 'carryBlocksFrom', type: 'string' },
  ],
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

  // ── Builder authoring hooks (see ../defineModule.js, "authoring") ─────────────
  authoring: {
    // A following task copies the previous task's blocks, sprites, backdrops and variables; the
    // first task starts with the sprite library's first sprite (when the library has one).
    defaultTypeFields: (prevTask, { defaultSprites = [] } = {}) => {
      if (prevTask) {
        return {
          toolbox: '',
          starterBlocks: prevTask.completeBlocks ?? prevTask.starterBlocks ?? null,
          carryBlocksFrom: prevTask.id,
          sprites: cloneJson(prevTask.sprites ?? []),
          backdrops: cloneJson(prevTask.backdrops ?? []),
          variables: cloneJson(prevTask.variables ?? []),
        }
      }
      const sprites =
        defaultSprites.length > 0 ? [createSpriteFromPreset([], defaultSprites[0])] : undefined
      return {
        toolbox: '',
        starterBlocks: null,
        carryBlocksFrom: null,
        ...(sprites ? { sprites } : {}),
      }
    },
    missingStarter: never,
    copyStarterToComplete: noUpdates,
    printTask: printScratchTask,
    sandboxStarterEditor: 'blocks',
    // The stage runs inside the Scratch workspace; the Builder's Run does nothing.
    builderRun: 'none',
    codeFormat: { label: 'Scratch', icon: 'scratch' },
    spriteLibrary: true,
  },

  // ── Contract v2 (see ../moduleContract.js) ───────────────────────────────────
  lifecycle: {
    playgroundTask: () => ({
      id: 1,
      title: 'Scratch playground',
      starterBlocks: null,
      allowAddSprite: true,
      allowRemoveSprite: true,
      allowRemoveStarterSprites: true,
    }),
    hasPersonalSandbox: personalSandboxWhenLessonHas('sandboxStarter'),
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
  // Generic work slot (useStudentCodeState, plan step 4.5): the Blockly workspace states. The
  // Scratch workspace owns them: it loads the task's own save, carry (carryBlocksFrom) or starter
  // itself (selectScratchInitialProject), evaluates the checks on the stage and reports them
  // (handleScratchCheck → reportRun). Restored blocks (reset, stage, complete, teacher edit) are
  // pushed to it as external state; the slot holds what it last reported (null until then).
  checking: { trigger: 'workspace' },
  workSlot: {
    kind: 'state',
    workspaceOwned: true,
    // The Reset button has always restored `starterBlocks` (the workspace's own loader prefers a
    // starter stage's blocks).
    starter: (task) => task?.starterBlocks ?? null,
    stage: (task, stageIndex) => task?.codeStages?.[stageIndex]?.blocks ?? null,
    complete: (task) => task?.completeBlocks ?? null,
    // The personal sandbox is read by the workspace itself; this is the lesson's starter.
    sandbox: (lesson) => {
      if (lesson?.sandboxStarter == null) return null
      try {
        return JSON.parse(lesson.sandboxStarter)
      } catch {
        return null
      }
    },
    fromResetTarget: (target) => target.blocks,
    empty: () => null,
    normalise: (states) => states,
    stored: identityStored,
    fromStored: identityFromStored,
    taskReset: true,
    teacherEdit: true,
  },

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
