import { useEffect, useRef } from 'react'
import { getLessonModule } from '../../modules/registry'
import { getModuleDefinition } from '../../modules/definitions.js'
import { createPreviewScheduler } from '../../shared/scrub/previewScheduler.js'
import { scrubCapabilityOf, scrubPreviewMode } from '../../shared/scrub/scrubConfig.js'
import { appendStudentOutput, createStudentOutputBuffer } from './studentOutputBuffer'

// A preview run that hasn't finished by now is stopped (a draw-only program should be quick).
const PREVIEW_TIMEOUT_MS = 4000

/**
 * Live preview re-runs while a value is scrubbed in the code editor (a task's `scrub`;
 * src/shared/scrub/), called from useStudentCodeState. A preview is the student's own view only:
 * no attempt log, no checks, no save, no `currentCode` / live write, no typing count. The edit
 * itself is saved and sent when the scrub ends, as a normal edit (handleCodeChange /
 * handleFileChange).
 *
 * - A 'runtime' module (python, turtle) runs the code through its runtime and shows the output
 *   and the drawing (the Python Stage, the turtle canvas).
 * - A 'preview' module (html) rebuilds the student's preview iframe from the files with the
 *   scrubbed file's content. A watching tutor's view updates when the scrub ends and the student
 *   runs, as always ("render only on Run" in live view).
 *
 * `scrubPreview(code, fileName?)` returns 'preview' or 'press-run' (the module or program can't
 * re-run live: no Stage import, an input() call). `settleScrubPreview()` resolves once no preview
 * is running, so a real Run never overlaps one.
 */
export function useScrubPreview({
  moduleType,
  task,
  running,
  readWork,
  previewOptions,
  setOutput,
  setTurtleResult,
  setStageResult,
  setIframeSrc,
}) {
  const contextRef = useRef(null)
  contextRef.current = {
    moduleType,
    task,
    running,
    readWork,
    previewOptions,
    setOutput,
    setTurtleResult,
    setStageResult,
    setIframeSrc,
  }

  const schedulerRef = useRef(null)
  if (!schedulerRef.current) {
    schedulerRef.current = createPreviewScheduler({
      run: (job) => runPreview(job),
      isSame: (a, b) => a.code === b.code && a.fileName === b.fileName && a.taskId === b.taskId,
    })
  }

  async function runPreview(job) {
    const ctx = contextRef.current
    // A real Run started meanwhile, or the student moved to another module's task.
    if (!ctx || ctx.running || ctx.moduleType !== job.moduleType) return
    const mod = getLessonModule(job.moduleType)
    const definition = getModuleDefinition(job.moduleType)
    const runKind = definition?.capabilities.run ?? 'none'
    if (runKind === 'preview') {
      if (typeof mod?.runtime?.buildPreviewSrc !== 'function') return
      const files = (ctx.readWork() ?? []).map((file) =>
        file.name === job.fileName ? { ...file, content: job.code } : file
      )
      const src = mod.runtime.buildPreviewSrc(
        { files, entryFile: ctx.task?.entryFile ?? 'index.html' },
        ctx.task,
        ctx.previewOptions()
      )
      ctx.setIframeSrc(src)
      return
    }
    if (runKind !== 'runtime' || typeof mod?.runtime?.run !== 'function') return
    let output = createStudentOutputBuffer()
    const timer = setTimeout(() => mod.runtime.stop?.(), PREVIEW_TIMEOUT_MS)
    let result
    try {
      result = await mod.runtime.run(job.code, ctx.task, {
        onOutput: (text) => {
          output = appendStudentOutput(output, text)
        },
        // Programs asking for input never preview (scrubPreviewMode); answer anything that does.
        onInputRequired: () => mod.runtime.provideInput?.(''),
      })
    } finally {
      clearTimeout(timer)
    }
    const after = contextRef.current
    if (!result || result.status === 'stopped' || after.running) return
    if (after.moduleType !== job.moduleType || after.task?.id !== job.taskId) return
    after.setOutput(output.display)
    if (definition.runResult?.turtle) after.setTurtleResult(result.turtle ?? null)
    if (definition.runResult?.stage) after.setStageResult(result.stage ?? null)
  }

  // A task change drops any waiting preview.
  useEffect(() => {
    schedulerRef.current.cancel()
    schedulerRef.current.reset()
  }, [task?.id, moduleType])

  function scrubPreview(code, fileName = null) {
    const capability = scrubCapabilityOf(getModuleDefinition(moduleType))
    if (!capability) return 'press-run'
    const mode = scrubPreviewMode(capability, code)
    if (mode !== 'preview' || running) return mode
    schedulerRef.current.request({ code, fileName, moduleType, taskId: task?.id ?? null })
    return mode
  }

  return {
    scrubPreview,
    settleScrubPreview: () => schedulerRef.current.settle(),
  }
}
