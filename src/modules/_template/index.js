import StudentWorkspace from './StudentWorkspace.jsx'
import BuilderWorkspace from './BuilderWorkspace.jsx'
import CheckEditor from './CheckEditor.jsx'
import TemplateModuleTeacherLiveView from './TeacherLiveView.jsx'
import { scrollLayoutStyles } from '../sharedStyles.js'
import { defineUiModule } from '../defineModule.js'
import definition from './definition.js'

const { taskContentStyle, editorAreaStyle } = scrollLayoutStyles

// Pure data and hooks live in ./definition.js; this file adds the UI half. Registered in
// src/modules/registry.js (the definition in src/modules/definitions.js).
const templateModuleModule = defineUiModule(definition, {
  StudentWorkspace,
  BuilderWorkspace,
  CheckEditor,

  // ── Teacher-side view (TeacherView tabs and sandbox, StudentModal mirror) ────────
  TeacherLiveView: TemplateModuleTeacherLiveView,

  // ── Layout ───────────────────────────────────────────────────────────────────
  // flexLayoutStyles (../sharedStyles.js) for a workspace that fills and shrinks instead.
  getLayoutStyles: () => ({ taskContentStyle, editorAreaStyle }),

  // ── Runtime ──────────────────────────────────────────────────────────────────
  // TODO(new-module): a 'runtime' module (capabilities.run) supplies
  // { init, isReady, stop, provideInput, run(code, task, callbacks), buildPreviewSrc, waitForPreviewText }.
  runtime: null,
})

export default templateModuleModule
