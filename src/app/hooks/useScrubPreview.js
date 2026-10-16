import { useEffect, useRef, useState } from 'react'
import { getLessonModule } from '../../modules/registry'
import { getModuleDefinition } from '../../modules/definitions.js'
import { createPreviewScheduler } from '../../shared/scrub/previewScheduler.js'
import {
  getTaskScrub,
  scrubCapabilityOf,
  scrubCodeAsksForInput,
  scrubPreviewMode,
} from '../../shared/scrub/scrubConfig.js'
import { appendStudentOutput, createStudentOutputBuffer } from './studentOutputBuffer'
import { codeCallsInput, getTaskRunOnOpen } from '../../shared/scrub/runOnOpen.js'

// A preview run that hasn't finished by now is stopped (a draw-only program should be quick).
const PREVIEW_TIMEOUT_MS = 4000
// How long after a scrub ends its checks run (the edit lands first; quick steps share one run).
export const SCRUB_RELEASE_DELAY_MS = 150
// While a run is still going, the checks on release wait and try again this often.
const SCRUB_RELEASE_RETRY_MS = 300
// The opening run (runOnOpen) waits this long after the task opens, so its code has loaded.
export const RUN_ON_OPEN_DELAY_MS = 120

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
 * `scrubPreview(code, fileName?, { notify }?)` returns 'preview', 'press-run' (the module or
 * program can't re-run live: no Stage import) or 'press-run-answers' (it calls input() and there
 * was no Run to take answers from). `settleScrubPreview()` resolves once no preview is running,
 * so a real Run never overlaps one.
 *
 * Programs with input() (P6-21): a preview replays, in order, the answers the student gave on
 * their last Run of the task (`rememberRunAnswers(taskId, answers)`, from handleRun). A preview
 * that asks for more answers than that is stopped and `notify('press-run-answers')` is called;
 * later previews say so straight away until the next Run. `scrubReplayAnswers` is the answers
 * the preview on screen used (null when none), for the "Using your last answers" note; a Run
 * clears it (`clearScrubReplay`).
 *
 * Checks on release (P6-20, the task's scrub.checkOnRelease, on by default):
 * `scrubCommitted()` (the editor's onScrubCommit, once a drag, slider step or colour pick ends as
 * an edit) runs the task's checks once through `runChecks({ source: 'scrub', inputAnswers })`,
 * which is handleRun, so the attempt, the result and the tutor's card are exactly a Run's. Only
 * for a program that previews live (so never one that would stop to ask for input), never while
 * predict mode's Run lock holds (`isRunLocked()`), and never on a submit-mode task.
 *
 * Run on open (P6-23, the task's runOnOpen; on by default with scrub): once the runtime is ready
 * (`runtimeReady`) and the task has opened, its code runs once through the same preview run — no
 * attempt, no checks, no save, not a Run — so the picture shows straight away and the first drag
 * redraws at once. Never for a program that calls input(), never in free play (`freePlay`), and
 * only for a 'runtime' module (python, turtle).
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
  runChecks = null,
  isRunLocked = null,
  runtimeReady = false,
  freePlay = false,
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
    runChecks,
    isRunLocked,
  }
  // The answers of the student's last Run, per task: `{ taskId, answers }`, or null.
  const runAnswersRef = useRef(null)
  // The task whose previews asked for more answers than the last Run gave (until the next Run).
  const shortTaskRef = useRef(null)
  const releaseTimerRef = useRef(null)
  const [replayAnswers, setReplayAnswers] = useState(null)

  const sameTask = (a, b) => a != null && b != null && String(a) === String(b)
  const answersFor = (taskId) =>
    sameTask(runAnswersRef.current?.taskId, taskId) ? runAnswersRef.current.answers : null

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
    // input() answers are replayed from the last Run, in order; one too many stops the preview.
    const answers = Array.isArray(job.answers) ? job.answers : []
    let used = 0
    let short = false
    let result
    try {
      result = await mod.runtime.run(job.code, ctx.task, {
        onOutput: (text) => {
          output = appendStudentOutput(output, text)
        },
        onInputRequired: () => {
          if (used < answers.length) {
            const answer = String(answers[used])
            used += 1
            output = appendStudentOutput(output, `${answer}\n`)
            mod.runtime.provideInput?.(answer)
            return
          }
          short = true
          mod.runtime.stop?.()
        },
      })
    } finally {
      clearTimeout(timer)
    }
    const after = contextRef.current
    if (short) {
      shortTaskRef.current = job.taskId
      if (after.task?.id === job.taskId) setReplayAnswers(null)
      job.notify?.('press-run-answers')
      return
    }
    if (!result || result.status === 'stopped' || after.running) return
    if (after.moduleType !== job.moduleType || after.task?.id !== job.taskId) return
    setReplayAnswers(used > 0 ? answers.slice(0, used) : null)
    after.setOutput(output.display)
    if (definition.runResult?.turtle) after.setTurtleResult(result.turtle ?? null)
    if (definition.runResult?.stage) after.setStageResult(result.stage ?? null)
  }

  // A task change drops any waiting preview, the replay note and a waiting check on release.
  useEffect(() => {
    schedulerRef.current.cancel()
    schedulerRef.current.reset()
    clearTimeout(releaseTimerRef.current)
    releaseTimerRef.current = null
    setReplayAnswers(null)
  }, [task?.id, moduleType])

  useEffect(() => () => clearTimeout(releaseTimerRef.current), [])

  // Run on open: once per task opening, after its code has loaded and the runtime is ready.
  const openedRef = useRef(null)
  const taskKey = task?.id == null ? null : `${moduleType}:${task.id}`
  useEffect(() => {
    if (taskKey == null || freePlay) return undefined
    if (!runtimeReady || openedRef.current === taskKey) return undefined
    if (!getTaskRunOnOpen(task)) return undefined
    if (getModuleDefinition(moduleType)?.capabilities?.run !== 'runtime') return undefined
    const timer = setTimeout(() => {
      const ctx = contextRef.current
      if (`${ctx.moduleType}:${ctx.task?.id}` !== taskKey || ctx.running) return
      openedRef.current = taskKey
      const work = ctx.readWork?.()
      if (typeof work !== 'string' || !work.trim() || codeCallsInput(work)) return
      schedulerRef.current.request({
        code: work,
        fileName: null,
        moduleType: ctx.moduleType,
        taskId: ctx.task?.id ?? null,
        answers: null,
        notify: null,
      })
    }, RUN_ON_OPEN_DELAY_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskKey, runtimeReady, freePlay])

  // How the code shows a scrub now: scrubPreviewMode with the last Run's answers, and
  // 'press-run-answers' once a preview of this task has run out of them. `answers` is what a
  // preview (or the checks on release) replays: only for a program that asks for input.
  function previewModeFor(code) {
    const ctx = contextRef.current
    const capability = scrubCapabilityOf(getModuleDefinition(ctx.moduleType))
    if (!capability) return { mode: 'press-run', answers: null }
    const taskId = ctx.task?.id ?? null
    const answers = answersFor(taskId)
    const mode = scrubPreviewMode(capability, code, { inputAnswers: answers })
    const asks = scrubCodeAsksForInput(capability, code)
    if (mode === 'preview' && asks && sameTask(shortTaskRef.current, taskId)) {
      return { mode: 'press-run-answers', answers: null }
    }
    return { mode, answers: asks ? answers : null }
  }

  function scrubPreview(code, fileName = null, { notify } = {}) {
    const { mode, answers } = previewModeFor(code)
    if (mode !== 'preview' || running) return mode
    schedulerRef.current.request({
      code,
      fileName,
      moduleType,
      taskId: task?.id ?? null,
      answers,
      notify,
    })
    return mode
  }

  /** The answers the student gave on a Run (handleRun), replayed by the previews after it. */
  function rememberRunAnswers(taskId, answers) {
    runAnswersRef.current = { taskId, answers: Array.isArray(answers) ? [...answers] : [] }
    shortTaskRef.current = null
  }

  function fireRelease() {
    releaseTimerRef.current = null
    const ctx = contextRef.current
    if (!ctx?.runChecks || !getTaskScrub(ctx.task)?.checkOnRelease) return
    if (ctx.task?.interactionMode === 'submit') return
    if (ctx.running) {
      releaseTimerRef.current = setTimeout(fireRelease, SCRUB_RELEASE_RETRY_MS)
      return
    }
    if (ctx.isRunLocked?.()) return
    const work = ctx.readWork?.()
    const { mode, answers } = previewModeFor(typeof work === 'string' ? work : '')
    if (mode !== 'preview') return
    ctx.runChecks({ source: 'scrub', ...(answers ? { inputAnswers: answers } : {}) })
  }

  /** A scrub ended as an edit (the editor's onScrubCommit): its checks run soon, as a Run. */
  function scrubCommitted() {
    if (!getTaskScrub(contextRef.current?.task)?.checkOnRelease) return
    clearTimeout(releaseTimerRef.current)
    releaseTimerRef.current = setTimeout(fireRelease, SCRUB_RELEASE_DELAY_MS)
  }

  return {
    scrubPreview,
    settleScrubPreview: () => schedulerRef.current.settle(),
    scrubReplayAnswers: replayAnswers,
    clearScrubReplay: () => setReplayAnswers(null),
    rememberRunAnswers,
    scrubCommitted,
  }
}
