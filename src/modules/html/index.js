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

const DEFAULT_HTML_FILE = {
  name: 'index.html',
  type: 'html',
  content: '<!DOCTYPE html>\n<html>\n<body>\n\n</body>\n</html>',
}

const htmlModule = {
  type: 'html',
  StudentWorkspace,
  BuilderWorkspace,
  CheckEditor,

  getLayoutStyles: () => ({ taskContentStyle, editorAreaStyle }),

  makeCodeTaskFields: (task) => ({
    starterFiles: task.starterFiles?.length ? task.starterFiles : [DEFAULT_HTML_FILE],
    entryFile: task.entryFile ?? 'index.html',
    carryCodeFrom: task.carryCodeFrom ?? null,
  }),

  makeNewStage: (task, existing) => ({
    label: `Stage ${existing.length + 1}`,
    files: (task.starterFiles ?? []).map(f => ({ ...f })),
    entryFile: task.entryFile ?? 'index.html',
  }),

  initCompleteTab: (task, { onUpdate, selectedFile, setSelectedCompleteFile }) => {
    if (!task.completeFiles?.length) {
      const initFiles = (task.starterFiles ?? []).map(f => ({ ...f }))
      onUpdate({ ...task, completeFiles: initFiles })
      setSelectedCompleteFile(initFiles[0]?.name ?? '')
    } else {
      setSelectedCompleteFile(task.completeFiles[0]?.name ?? selectedFile ?? '')
    }
  },

  initStageTab: (stage, { setSelectedFile }) => {
    setSelectedFile(stage?.files?.[0]?.name ?? '')
  },

  defaultCheck: (interactionMode) => interactionMode === 'submit'
    ? [{ type: 'code_contains', value: '' }]
    : [{ type: 'output_contains', value: '' }],

  supportsInteractionMode: true,
  supportsIncorrectChecks: true,
  supportsTests: false,

  stageLabels: { starterLabel: 'Starter', completeLabel: 'Complete' },
  explainerInlineCodeLanguages: ['html', 'javascript', 'css'],
}

export default htmlModule
