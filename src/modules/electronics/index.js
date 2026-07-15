import StudentWorkspace from './StudentWorkspace.jsx'
import BuilderWorkspace from './BuilderWorkspace.jsx'
import CheckEditor from './CheckEditor.jsx'
import TeacherLiveView from './TeacherLiveView.jsx'
import { DEFAULT_CIRCUIT, cloneCircuit, evaluateElectronicsCheck, parseCircuit, serializeCircuit } from './circuit'
import { scrollLayoutStyles } from '../sharedStyles.js'

const { taskContentStyle, editorAreaStyle } = scrollLayoutStyles

const electronicsModule = {
  type: 'electronics',
  StudentWorkspace,
  BuilderWorkspace,
  CheckEditor,
  TeacherLiveView,

  getDisplayState: (task, stage, liveState, tab) => {
    if (tab === 'complete') return serializeCircuit(task?.completeCircuit ?? task?.starterCircuit ?? DEFAULT_CIRCUIT)
    if (tab?.startsWith('stage_')) return serializeCircuit(stage?.circuit ?? task?.starterCircuit ?? DEFAULT_CIRCUIT)
    return liveState
  },

  getLayoutStyles: () => ({ taskContentStyle, editorAreaStyle }),

  makeCodeTaskFields: (task) => ({
    starterCircuit: cloneCircuit(task.starterCircuit ?? DEFAULT_CIRCUIT),
    carryCircuitFrom: task.carryCircuitFrom ?? null,
    microcontroller: task.microcontroller ?? { enabled: false, boardType: null, starterCode: '' },
  }),

  makeNewStage: (task, existing) => ({
    label: `Stage ${existing.length + 1}`,
    circuit: cloneCircuit(task.starterCircuit ?? DEFAULT_CIRCUIT),
  }),

  initCompleteTab: (task, { onUpdate }) => {
    if (!task.completeCircuit) onUpdate({ ...task, completeCircuit: cloneCircuit(task.starterCircuit ?? DEFAULT_CIRCUIT) })
  },

  initStageTab: null,
  defaultCheck: () => [{ type: 'circuit_no_short' }],

  carryThroughField: 'carryCircuitFrom',
  carryThroughLabel: 'Carry circuit from task',
  getCarryThroughUpdates: (sourceTask) => ({
    starterCircuit: cloneCircuit(sourceTask.completeCircuit ?? sourceTask.starterCircuit ?? DEFAULT_CIRCUIT),
  }),
  getNewStarterUpdates: () => ({ starterCircuit: cloneCircuit(DEFAULT_CIRCUIT) }),

  supportsInteractionMode: false,
  supportsIncorrectChecks: false,
  supportsTests: false,
  supportsVariableChecks: false,
  supportsDomChecks: false,

  stageLabels: { starterLabel: 'Starter board', completeLabel: 'Complete board' },
  explainerInlineCodeLanguages: ['python'],

  defaultState: serializeCircuit(DEFAULT_CIRCUIT),
  initialState: (task) => serializeCircuit(task.starterCircuit ?? DEFAULT_CIRCUIT),
  serializeState: (state) => typeof state === 'string' ? state : serializeCircuit(state),
  deserializeState: (raw) => serializeCircuit(parseCircuit(raw, DEFAULT_CIRCUIT)),

  getSandboxState: (lesson, task) => serializeCircuit(lesson?.sandboxStarterCircuit ?? task?.starterCircuit ?? DEFAULT_CIRCUIT),

  runtime: {
    init: () => Promise.resolve(),
    isReady: () => true,
    stop: () => {},
    provideInput: null,
    run: null,
    buildPreviewSrc: null,
    waitForPreviewText: null,
  },

  evaluateCheck: evaluateElectronicsCheck,
}

export default electronicsModule
