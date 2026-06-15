import StudentWorkspace from './StudentWorkspace.jsx'
import BuilderWorkspace from './BuilderWorkspace.jsx'
import CheckEditor from './CheckEditor.jsx'

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
  StudentWorkspace,
  BuilderWorkspace,
  CheckEditor,

  getLayoutStyles: () => ({ taskContentStyle, editorAreaStyle }),

  makeCodeTaskFields: (task) => ({
    toolbox: task.toolbox ?? '',
    starterBlocks: task.starterBlocks ?? null,
    carryBlocksFrom: task.carryBlocksFrom ?? null,
  }),

  // ScratchTaskSetup manages its own stage list internally
  makeNewStage: null,

  initCompleteTab: null,
  initStageTab: null,

  defaultCheck: () => [{ type: 'block_used', evaluation: 'after_run', opcode: 'motion_movesteps' }],

  supportsInteractionMode: false,
  supportsIncorrectChecks: false,
  supportsTests: false,

  stageLabels: { starterLabel: 'Starter', completeLabel: 'Complete' },
  explainerInlineCodeLanguages: ['scratch'],
}

export default scratchModule
