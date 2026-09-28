// Node-safe half of the Arcade Kit module (see ../defineModule.js). UI lives in index.js.
import { defineModule } from '../defineModule.js'
import { cloneArcadeDesign } from './design.js'

export default defineModule({
  type: 'arcade',
  meta: {
    label: 'Arcade Kit',
    order: 1,
    shortLabel: 'Arcade Kit',
    icon: '🕹️',
    pickerHint: 'Workspace · Experimental',
    language: 'python',
    playground: true,
    surfaceLabels: { stageReference: 'Python' },
  },
  capabilities: {
    sideExplainer: true,
    modulePanes: true,
    teacherLiveReference: true,
    unifiedStages: true,
    sandboxState: 'code',
  },
  getDisplayState: (task, stage, liveState, tab) =>
    tab === 'complete'
      ? (task?.completeCode ?? '')
      : tab?.startsWith('stage_')
        ? (stage?.code ?? '')
        : typeof liveState === 'string'
          ? liveState
          : (task?.starterCode ?? ''),
  makeCodeTaskFields: (task) => {
    const starterCode =
      task.starterCode ??
      'from headstart_arcade import game, Sprite, keys\n\n# Write update() and draw(), then call game.run().\n\ngame.run()\n'
    return {
      starterCode,
      carryCodeFrom: task.carryCodeFrom ?? null,
      codeStages: task.codeStages ?? [
        {
          label: 'Starter',
          role: 'starter',
          code: starterCode,
          arcadeDesign: cloneArcadeDesign(task.arcadeDesign),
        },
      ],
    }
  },
  makeNewStage: (task, existing) =>
    existing.length === 0
      ? {
          label: 'Starter',
          role: 'starter',
          code: task.starterCode ?? '',
          arcadeDesign: cloneArcadeDesign(task.arcadeDesign),
        }
      : {
          label: `Support ${existing.filter((stage) => stage.role === 'support').length + 1}`,
          role: 'support',
          code: '',
        },
  initCompleteTab: (task, { onUpdate }) => {
    if (task.completeCode == null) onUpdate({ ...task, completeCode: task.starterCode ?? '' })
  },
  initStageTab: null,
  defaultCheck: () => [{ type: 'code_contains', value: '' }],
  carryThroughField: 'carryCodeFrom',
  completeField: 'completeCode',
  carryThroughLabel: 'Carry code from task',
  // Also patches codeStages[0].code (see python/definition.js's getCarryThroughUpdates for why).
  getCarryThroughUpdates: (source, targetTask) => {
    const code = source.completeCode ?? source.starterCode ?? ''
    const updates = { starterCode: code }
    if (targetTask?.codeStages?.length)
      updates.codeStages = targetTask.codeStages.map((stage, i) =>
        i === 0 ? { ...stage, code } : stage
      )
    return updates
  },
  getNewStarterUpdates: () => ({ starterCode: '' }),
  supportsInteractionMode: false,
  supportsIncorrectChecks: true,
  supportsTests: false,
  supportsVariableChecks: false,
  supportsDomChecks: false,
  // The game runs in its own iframe with no captured text output, so only code checks can
  // be evaluated (on Run game — see handleArcadeRun in useStudentCodeState.js).
  supportsOutputChecks: false,
  supportsCopyCode: true,
  stageLabels: { starterLabel: 'Starter', completeLabel: 'Complete' },
  explainerInlineCodeLanguages: ['python'],
  explainerCodeBlockLanguages: ['python'],
  defaultState: '',
  initialState: (task) => task.starterCode ?? '',
  serializeState: (state) => state,
  deserializeState: (raw) => (typeof raw === 'string' ? raw : ''),
  getSandboxState: (lesson, task) => lesson?.sandboxStarter ?? task?.starterCode ?? '',
})
