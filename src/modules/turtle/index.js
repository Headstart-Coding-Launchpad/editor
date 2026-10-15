import StudentWorkspace from './StudentWorkspace.jsx'
import BuilderWorkspace from './BuilderWorkspace.jsx'
import CheckEditor from './CheckEditor.jsx'
import TurtleTeacherLiveView from './TeacherLiveView.jsx'
import {
  initPyodide,
  isPyodideReady,
  runPython,
  stopPython,
  provideInput,
  getStopCount,
} from '../python/pyodide'
import { TURTLE_LINE_OFFSET } from './shim.js'
import { runTurtleTask } from './courseRun.js'
import { variableCaptureOptions } from '../../shared/variablesPanel/variablesPanel.js'
import { slowMoRecordOptions } from '../python/slowMo/config.js'
import { setupRunOptions } from '../../shared/puzzle/setupCode.js'
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
    // A course task (task.course, ./course.js) runs once per map (./courseRun.js).
    run: (code, task, { slowMo = false, freePlay = false, ...callbacks } = {}) =>
      runTurtleTask(code, task, {
        ...callbacks,
        // The task's hidden setupCode runs after the shim, before the student's code (every map).
        setup: freePlay ? null : setupRunOptions(task, { afterLine: TURTLE_LINE_OFFSET }),
        runPython,
        getStopCount: () => getStopCount(),
        firstRunOptions: {
          // The name-tag panel (showVariables); its peek line moves down with the shim's lines.
          capture: variableCaptureOptions(task, code, { lineOffset: TURTLE_LINE_OFFSET }),
          // Slow-mo (src/modules/python/slowMo/): recorded lines come back as editor lines.
          record: slowMo ? slowMoRecordOptions(task, { lineOffset: TURTLE_LINE_OFFSET }) : null,
        },
      }),
    buildPreviewSrc: null,
    waitForPreviewText: null,
  },

  // ── Export work (tutor's StudentModal; src/shared/exportWork/exporters.js) ──
  exportWork: () => import('./exportWork.js'),
})

export default turtleModule
