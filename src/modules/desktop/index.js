import { makeDefaultDesktop } from './desktopState.js'
import StudentWorkspace from './StudentWorkspace.jsx'
import BuilderWorkspace from './BuilderWorkspace.jsx'
import CheckEditor from './CheckEditor.jsx'
import DesktopTeacherLiveView from './TeacherLiveView.jsx'
import { defineUiModule } from '../defineModule.js'
import definition from './definition.js'

export { makeDefaultDesktop }

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

// Pure data and hooks live in ./definition.js; this file adds the UI.
const desktopModule = defineUiModule(definition, {
  StudentWorkspace,
  BuilderWorkspace,
  CheckEditor,
  FeedbackCheckEditor: CheckEditor,

  // ── Teacher-side editor ──────────────────────────────────────────────────────
  TeacherLiveView: DesktopTeacherLiveView,

  // ── Layout ───────────────────────────────────────────────────────────────────
  getLayoutStyles: () => ({ taskContentStyle, editorAreaStyle }),

  // ── Runtime ──────────────────────────────────────────────────────────────────
  runtime: null,
})

export default desktopModule
