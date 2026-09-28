import StudentWorkspace from './StudentWorkspace.jsx'
import BuilderWorkspace from './BuilderWorkspace.jsx'
import CheckEditor from './CheckEditor.jsx'
import PythonTeacherLiveView from './TeacherLiveView.jsx'
import { initPyodide, isPyodideReady, runPython, stopPython, provideInput } from './pyodide'
import { scrollLayoutStyles } from '../sharedStyles.js'
import { defineUiModule } from '../defineModule.js'
import definition from './definition.js'

const { taskContentStyle, editorAreaStyle } = scrollLayoutStyles

// Pure data and hooks live in ./definition.js; this file adds the UI and runtime.
const pythonModule = defineUiModule(definition, {
  StudentWorkspace,
  BuilderWorkspace,
  CheckEditor,

  // ── Teacher-side editor ──────────────────────────────────────────────────────
  TeacherLiveView: PythonTeacherLiveView,

  // ── Layout ───────────────────────────────────────────────────────────────────
  getLayoutStyles: () => ({ taskContentStyle, editorAreaStyle }),

  // ── Runtime ──────────────────────────────────────────────────────────────────
  runtime: {
    init: initPyodide,
    isReady: isPyodideReady,
    stop: stopPython,
    provideInput,
    run: (code, _task, callbacks) => runPython(code, callbacks),
    buildPreviewSrc: null,
    waitForPreviewText: null,
  },
})

export default pythonModule
