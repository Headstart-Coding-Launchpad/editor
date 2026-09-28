import StudentWorkspace from './StudentWorkspace.jsx'
import BuilderWorkspace from './BuilderWorkspace.jsx'
import CheckEditor from './CheckEditor.jsx'
import TurtleTeacherLiveView from './TeacherLiveView.jsx'
import { initPyodide, isPyodideReady, runPython, stopPython, provideInput } from '../python/pyodide'
import { buildTurtleProgram } from './shim.js'
import { scrollLayoutStyles } from '../sharedStyles.js'
import { defineUiModule } from '../defineModule.js'
import definition from './definition.js'

const { taskContentStyle, editorAreaStyle } = scrollLayoutStyles

// Pure data and hooks live in ./definition.js; this file adds the UI and runtime.
const turtleModule = defineUiModule(definition, {
  StudentWorkspace,
  BuilderWorkspace,
  CheckEditor,
  TeacherLiveView: TurtleTeacherLiveView,

  getLayoutStyles: () => ({ taskContentStyle, editorAreaStyle }),

  // ── Runtime ──────────────────────────────────────────────────────────────────
  runtime: {
    init: initPyodide,
    isReady: isPyodideReady,
    stop: stopPython,
    provideInput,
    run: (code, _task, callbacks) => runPython(buildTurtleProgram(code), callbacks),
    buildPreviewSrc: null,
    waitForPreviewText: null,
  },
})

export default turtleModule
