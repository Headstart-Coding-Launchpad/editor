import StudentWorkspace from './StudentWorkspace.jsx'
import BuilderWorkspace from './BuilderWorkspace.jsx'
import CheckEditor from './CheckEditor.jsx'

const taskContentStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  overflow: 'visible',
}

const editorAreaStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
}

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
    : [{ type: 'output_contains', value: '' }],

  supportsInteractionMode: true,
  supportsIncorrectChecks: true,
  supportsTests: true,

  stageLabels: { starterLabel: 'Starter', completeLabel: 'Complete' },
  explainerInlineCodeLanguages: ['python'],
}

export default pythonModule
