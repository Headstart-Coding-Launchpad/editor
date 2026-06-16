import StudentWorkspace from './StudentWorkspace.jsx'
import BuilderWorkspace from './BuilderWorkspace.jsx'
import CheckEditor from './CheckEditor.jsx'
import { scrollLayoutStyles } from '../sharedStyles.js'

const { taskContentStyle, editorAreaStyle } = scrollLayoutStyles

const pythonModule = {
  type: 'python',
  StudentWorkspace,
  BuilderWorkspace,
  CheckEditor,

  getLayoutStyles: () => ({ taskContentStyle, editorAreaStyle }),

  makeCodeTaskFields: (task) => ({
    starterCode: task.starterCode ?? '',
    carryCodeFrom: task.carryCodeFrom ?? null,
  }),

  makeNewStage: (task, existing) => ({
    label: `Stage ${existing.length + 1}`,
    code: task.starterCode ?? '',
  }),

  initCompleteTab: (task, { onUpdate }) => {
    if (task.completeCode == null) {
      onUpdate({ ...task, completeCode: task.starterCode ?? '' })
    }
  },

  initStageTab: null,

  defaultCheck: (interactionMode) => interactionMode === 'submit'
    ? [{ type: 'code_contains', value: '' }]
    : [{ type: 'code_no_error' }],

  carryThroughField: 'carryCodeFrom',
  carryThroughLabel: 'Carry code from task',
  getCarryThroughUpdates: (sourceTask) => ({
    starterCode: sourceTask.completeCode ?? sourceTask.starterCode ?? '',
  }),
  getNewStarterUpdates: () => ({
    starterCode: '',
  }),

  supportsInteractionMode: true,
  supportsIncorrectChecks: true,
  supportsTests: true,
  supportsVariableChecks: true,
  supportsDomChecks: false,

  stageLabels: { starterLabel: 'Starter', completeLabel: 'Complete' },
  explainerInlineCodeLanguages: ['python'],
}

export default pythonModule
