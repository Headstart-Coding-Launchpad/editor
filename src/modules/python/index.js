import StudentWorkspace from './StudentWorkspace.jsx'
import BuilderWorkspace from './BuilderWorkspace.jsx'
import CheckEditor from './CheckEditor.jsx'
import PythonTeacherLiveView from './TeacherLiveView.jsx'
import { initPyodide, isPyodideReady, runPython, stopPython, provideInput } from './pyodide'
import { scrollLayoutStyles } from '../sharedStyles.js'
import { variableCaptureOptions } from '../../shared/variablesPanel/variablesPanel.js'
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
    // The name-tag panel (showVariables) asks the worker to capture the variables.
    run: (code, task, callbacks) =>
      runPython(code, { ...callbacks, capture: variableCaptureOptions(task, code) }),
    buildPreviewSrc: null,
    waitForPreviewText: null,
  },

  // ── Export work (tutor's StudentModal; src/shared/exportWork/exporters.js) ──
  exportWork: () => import('./exportWork.js'),
})

export default pythonModule
