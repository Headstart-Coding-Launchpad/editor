import StudentWorkspace from './StudentWorkspace.jsx'
import BuilderWorkspace from './BuilderWorkspace.jsx'
import CheckEditor from './CheckEditor.jsx'
import PythonTeacherLiveView from './TeacherLiveView.jsx'
import {
  getStopCount,
  initPyodide,
  isPyodideReady,
  runPython,
  stopPython,
  provideInput,
} from './pyodide'
import { scrollLayoutStyles } from '../sharedStyles.js'
import { variableCaptureOptions } from '../../shared/variablesPanel/variablesPanel.js'
import { loadStageTarget, stageTargetCode } from './stageTarget.js'
import { slowMoRecordOptions } from './slowMo/config.js'
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
    // The name-tag panel (showVariables) asks the worker to capture the variables. A task with a
    // stageTarget draws it first (once, cached) and hands its commands back as `stageTarget`
    // for the diff view and the stage_matches_target check (src/shared/stage/). A slow-mo run
    // (callbacks.slowMo, src/modules/python/slowMo/) also records every line for playback.
    run: async (code, task, { slowMo = false, ...callbacks } = {}) => {
      const targetCode = stageTargetCode(task)
      const stops = getStopCount()
      const target = targetCode ? await loadStageTarget(targetCode) : null
      // Stop pressed while the target was drawing stops this run too.
      if (getStopCount() !== stops) return { status: 'stopped' }
      const result = await runPython(code, {
        ...callbacks,
        capture: variableCaptureOptions(task, code),
        record: slowMo ? slowMoRecordOptions(task) : null,
      })
      return targetCode ? { ...result, stageTarget: target?.commands ?? null } : result
    },
    buildPreviewSrc: null,
    waitForPreviewText: null,
  },

  // ── Export work (tutor's StudentModal; src/shared/exportWork/exporters.js) ──
  exportWork: () => import('./exportWork.js'),
})

export default pythonModule
