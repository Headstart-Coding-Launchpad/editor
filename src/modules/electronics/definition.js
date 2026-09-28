// Node-safe half of the Electronics module (see ../defineModule.js). UI and the MicroPython
// runtime bridge live in index.js.
import { defineModule } from '../defineModule.js'
import {
  DEFAULT_AVAILABLE_COMPONENTS,
  DEFAULT_CIRCUIT,
  cloneCircuit,
  evaluateElectronicsCheck,
  parseCircuit,
  serializeCircuit,
} from './circuit.js'

export default defineModule({
  type: 'electronics',
  meta: {
    label: 'Electronics',
    order: 7,
    shortLabel: 'Electronics',
    icon: '⚡',
    pickerHint: 'Workspace',
    language: 'python',
    playground: true,
  },
  capabilities: {
    sideExplainer: true,
    modulePanes: true,
    teacherLiveReference: true,
    unifiedStages: true,
    sandboxState: 'code',
  },

  getDisplayState: (task, stage, liveState, tab) => {
    if (tab === 'complete')
      return serializeCircuit(task?.completeCircuit ?? task?.starterCircuit ?? DEFAULT_CIRCUIT)
    if (tab?.startsWith('stage_'))
      return serializeCircuit(stage?.circuit ?? task?.starterCircuit ?? DEFAULT_CIRCUIT)
    return liveState
  },

  makeCodeTaskFields: (task) => ({
    starterCircuit: cloneCircuit(task.starterCircuit ?? DEFAULT_CIRCUIT),
    availableComponents: task.availableComponents ?? [...DEFAULT_AVAILABLE_COMPONENTS],
    carryCircuitFrom: task.carryCircuitFrom ?? null,
    microcontroller: task.microcontroller ?? { enabled: false, boardType: null, starterCode: '' },
    codeStages: task.codeStages ?? [
      {
        label: 'Starter',
        role: 'starter',
        circuit: cloneCircuit(task.starterCircuit ?? DEFAULT_CIRCUIT),
      },
    ],
  }),

  makeNewStage: (task, existing) =>
    existing.length === 0
      ? {
          label: 'Starter',
          role: 'starter',
          circuit: cloneCircuit(task.starterCircuit ?? DEFAULT_CIRCUIT),
        }
      : {
          label: `Support ${existing.filter((stage) => stage.role === 'support').length + 1}`,
          role: 'support',
          code: '',
        },

  initCompleteTab: (task, { onUpdate }) => {
    if (!task.completeCircuit)
      onUpdate({ ...task, completeCircuit: cloneCircuit(task.starterCircuit ?? DEFAULT_CIRCUIT) })
  },

  initStageTab: null,
  defaultCheck: () => [{ type: 'circuit_no_short' }],

  carryThroughField: 'carryCircuitFrom',
  completeField: 'completeCircuit',
  carryThroughLabel: 'Carry circuit from task',
  // Also patches codeStages[0].circuit (see python/definition.js's getCarryThroughUpdates for
  // why).
  getCarryThroughUpdates: (sourceTask, targetTask) => {
    const circuit = cloneCircuit(
      sourceTask.completeCircuit ?? sourceTask.starterCircuit ?? DEFAULT_CIRCUIT
    )
    const updates = { starterCircuit: circuit }
    if (targetTask?.codeStages?.length) {
      updates.codeStages = targetTask.codeStages.map((stage, i) =>
        i === 0 ? { ...stage, circuit: cloneCircuit(circuit) } : stage
      )
    }
    return updates
  },
  getNewStarterUpdates: () => ({ starterCircuit: cloneCircuit(DEFAULT_CIRCUIT) }),

  supportsInteractionMode: false,
  supportsIncorrectChecks: true,
  supportsTests: false,
  supportsVariableChecks: false,
  supportsDomChecks: false,

  stageLabels: { starterLabel: 'Starter board', completeLabel: 'Complete board' },
  explainerInlineCodeLanguages: ['python'],
  explainerCodeBlockLanguages: ['python'],

  defaultState: serializeCircuit(DEFAULT_CIRCUIT),
  initialState: (task) => serializeCircuit(task.starterCircuit ?? DEFAULT_CIRCUIT),
  serializeState: (state) => (typeof state === 'string' ? state : serializeCircuit(state)),
  deserializeState: (raw) => serializeCircuit(parseCircuit(raw, DEFAULT_CIRCUIT)),

  getSandboxState: (lesson, task) =>
    serializeCircuit(lesson?.sandboxStarterCircuit ?? task?.starterCircuit ?? DEFAULT_CIRCUIT),

  evaluateCheck: evaluateElectronicsCheck,
})
