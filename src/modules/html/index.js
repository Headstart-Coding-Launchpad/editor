import StudentWorkspace from './StudentWorkspace.jsx'
import BuilderWorkspace from './BuilderWorkspace.jsx'
import CheckEditor from './CheckEditor.jsx'
import HtmlTeacherLiveView from './TeacherLiveView.jsx'
import { buildIframeSrc, waitForIframeText as waitForPreviewText } from './iframe'
import { scrollLayoutStyles } from '../sharedStyles.js'
import { defineUiModule } from '../defineModule.js'
import definition from './definition.js'

const { taskContentStyle, editorAreaStyle } = scrollLayoutStyles

// Pure data and hooks live in ./definition.js; this file adds the UI and preview runtime.
const htmlModule = defineUiModule(definition, {
  StudentWorkspace,
  BuilderWorkspace,
  CheckEditor,

  // ── Teacher-side editor ──────────────────────────────────────────────────────
  TeacherLiveView: HtmlTeacherLiveView,

  // ── Layout ───────────────────────────────────────────────────────────────────
  getLayoutStyles: () => ({ taskContentStyle, editorAreaStyle }),

  // ── Runtime ──────────────────────────────────────────────────────────────────
  runtime: {
    init: () => Promise.resolve(),
    isReady: () => true,
    stop: () => {},
    provideInput: null,
    run: null,
    buildPreviewSrc: (state, task, opts = {}) =>
      buildIframeSrc(state?.files ?? state, state?.entryFile ?? task?.entryFile, opts),
    waitForPreviewText,
  },
})

export default htmlModule
