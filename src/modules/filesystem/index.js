import { DEFAULT_FS } from '../../shared/filesystem'
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

const filesystemModule = {
  type: 'filesystem',
  StudentWorkspace,
  BuilderWorkspace,
  CheckEditor,

  getLayoutStyles: () => ({ taskContentStyle, editorAreaStyle }),

  makeCodeTaskFields: (task) => ({
    starterFs: task.starterFs ?? DEFAULT_FS,
    carryFsFrom: task.carryFsFrom ?? null,
  }),

  makeNewStage: (task, existing) => ({
    label: `Stage ${existing.length + 1}`,
    fs: task.starterFs ? { ...task.starterFs } : DEFAULT_FS,
  }),

  initCompleteTab: null,
  initStageTab: null,

  defaultCheck: () => [{ type: 'fs_file_exists', path: '' }],

  carryThroughField: 'carryFsFrom',
  carryThroughLabel: 'Carry filesystem from task',
  getCarryThroughUpdates: (sourceTask) => ({
    starterFs: sourceTask.completeFs ?? sourceTask.starterFs ?? DEFAULT_FS,
  }),
  getNewStarterUpdates: () => ({
    starterFs: DEFAULT_FS,
  }),

  supportsInteractionMode: false,
  supportsIncorrectChecks: false,
  supportsTests: false,
  supportsVariableChecks: false,
  supportsDomChecks: false,

  stageLabels: { starterLabel: 'Starter', completeLabel: 'Complete' },
  explainerInlineCodeLanguages: [],
}

export default filesystemModule
