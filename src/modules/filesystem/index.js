import { DEFAULT_FS } from './filesystem'
import StudentWorkspace from './StudentWorkspace.jsx'
import BuilderWorkspace from './BuilderWorkspace.jsx'
import CheckEditor from './CheckEditor.jsx'
import FilesystemTeacherLiveView from './TeacherLiveView.jsx'
import { flexLayoutStyles } from '../sharedStyles.js'
import { defineUiModule } from '../defineModule.js'
import definition from './definition.js'

export { DEFAULT_FS }

const { taskContentStyle, editorAreaStyle } = flexLayoutStyles

// Pure data and hooks live in ./definition.js; this file adds the UI.
const filesystemModule = defineUiModule(definition, {
  StudentWorkspace,
  BuilderWorkspace,
  CheckEditor,
  FeedbackCheckEditor: CheckEditor,

  // ── Teacher-side editor ──────────────────────────────────────────────────────
  TeacherLiveView: FilesystemTeacherLiveView,

  // ── Layout ───────────────────────────────────────────────────────────────────
  getLayoutStyles: () => ({ taskContentStyle, editorAreaStyle }),

  // ── Runtime ──────────────────────────────────────────────────────────────────
  runtime: null,
})

export default filesystemModule
