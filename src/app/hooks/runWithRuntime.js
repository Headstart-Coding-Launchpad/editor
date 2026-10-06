import {
  completionToleratesRunError,
  evaluateCheck,
  evaluateCheckWithFeedback,
} from '../../modules/checks'
import { createThrottledMirrorWriter } from '../throttledMirrorWriter'
import { appendStudentOutput, createStudentOutputBuffer } from './studentOutputBuffer'
import { runErrorFor } from '../../badges/signals'
import { lastErrorLine } from '../studentHints.js'

/**
 * Runs the student's code through a `capabilities.run === 'runtime'` module's runtime (Pyodide
 * for python/turtle, MicroPython for electronics) and reports the result: output streamed to
 * the screen and, throttled, to a watching teacher and a Go Live broadcast; input() prompts;
 * the task check with feedback and stage offers; the save; the run record and attempt log.
 *
 * Extracted from useStudentCodeState's handleRun (plan step 4.4) with its behaviour unchanged;
 * handleRun has already reset the run state and set `running`. What differs per module comes
 * from the definition: `runResult.errorLine` (stderr line highlight), `runResult.liveCode`
 * (the runtime rewrites the work mid-run; a stopped run is still saved), `runResult.turtle`
 * (the drawing is written with the run) and `checking.buildContext` (the check context).
 *
 * `ctx` carries the hook state this needs:
 * - actor, task, definition, runtime, startCode, currentTaskId, isWatched (at run start),
 *   isWatchedNow() (checked live on every mirror write), alreadySolved, teacherPresentation
 * - readCode() / setCode(code): the work's code, read and set through the work slot (setCode
 *   keeps the slot's ref fresh synchronously, as the old `codeRef.current = pending` did)
 * - refs: outputRafIdRef, outputMirrorRef, inputPromptRef, inputValueRef, submitInputEchoRef,
 *   appendOutputRef, runtimeCodeRafIdRef, pendingRuntimeCodeRef, lastRuntimeCodeWriteRef,
 *   currentTaskIdRef, phaseRef, inPersonalSandboxRef, teacherAssistedTaskIdsRef
 * - setters: setOutput, setInputPrompt, setErrorLine, setRunStatus, setTurtleResult, setRunning
 * - writers: writeStudentInputState, writeStudentOutput, writeStudentCode, writeStudentRun,
 *   writeStudentTurtleResult, logAttempt
 * - live: canPublishTeacherLive, updateTeacherLive, currentTeacherLivePayload, publishTeacherLive
 * - feedback: applyCheckFeedback, updateTargetedStageOffer, updateSupportStageForAttempt
 * - saveRunRecord(taskId, code, fields): the task's run record (persistence.saveRunRecord)
 * - signals (optional): the live badge reporters (useStudentBadgeSignals); a free-play run is
 *   reported with reportSandboxRun
 */
export async function runWithRuntime(ctx) {
  const {
    actor,
    task,
    definition,
    runtime,
    startCode,
    currentTaskId,
    isWatched,
    isWatchedNow,
    alreadySolved,
    teacherPresentation,
    readCode,
    setCode,
    refs,
    setters,
    writers,
    live,
    feedback,
    saveRunRecord,
    signals = null,
  } = ctx
  const { runResult, checking } = definition
  const { setOutput, setInputPrompt, setErrorLine, setRunStatus, setTurtleResult, setRunning } =
    setters
  const {
    canPublishTeacherLive,
    updateTeacherLive,
    currentTeacherLivePayload,
    publishTeacherLive,
  } = live

  if (refs.outputRafIdRef.current !== null) {
    cancelAnimationFrame(refs.outputRafIdRef.current)
    refs.outputRafIdRef.current = null
  }
  refs.outputMirrorRef.current?.cancel()
  refs.inputPromptRef.current = null
  refs.inputValueRef.current = ''
  // Clear the previous run's mirrored output/prompt up front — otherwise a
  // program that asks for input() (or is slow) before printing anything
  // shows the watching teacher the last run's output under the new run.
  if (isWatchedNow()) {
    writers.writeStudentInputState(actor.anonymousId, { prompt: null, value: '', output: '' })
  }
  let outputBuffer = createStudentOutputBuffer()
  // Leading + trailing throttle (200ms) so the tail of a burst of output
  // always reaches the teacher instead of waiting for the run to end.
  const outputMirror = createThrottledMirrorWriter({
    write: (raw) => {
      if (canPublishTeacherLive()) updateTeacherLive(currentTeacherLivePayload({ output: raw }))
      if (isWatchedNow()) writers.writeStudentOutput(actor.anonymousId, raw)
    },
  })
  refs.outputMirrorRef.current = outputMirror
  const appendLocalOutput = (text) => {
    const nextOutputBuffer = appendStudentOutput(outputBuffer, text)
    if (nextOutputBuffer === outputBuffer) return false
    outputBuffer = nextOutputBuffer
    // Throttle React re-renders to one per animation frame (~60fps max).
    // outputBuffer is a closure var so the RAF always reads the latest value.
    if (refs.outputRafIdRef.current === null) {
      refs.outputRafIdRef.current = requestAnimationFrame(() => {
        refs.outputRafIdRef.current = null
        setOutput(outputBuffer.display)
      })
    }
    return true
  }
  const echoOutput = (text) => {
    if (appendLocalOutput(text)) outputMirror.push(outputBuffer.raw)
  }
  refs.submitInputEchoRef.current = (value) => {
    appendLocalOutput(value + '\n')
    outputMirror.markWritten()
    if (canPublishTeacherLive())
      updateTeacherLive(currentTeacherLivePayload({ output: outputBuffer.raw }))
    // One update: the echoed line lands in the output at the same moment
    // the prompt row disappears, so the teacher never sees the typed text
    // vanish (or linger) while the echo waits on the throttle.
    if (isWatchedNow()) {
      writers.writeStudentInputState(actor.anonymousId, {
        prompt: null,
        value: '',
        output: outputBuffer.raw,
      })
    }
  }
  let latestRuntimeCode = startCode
  const flushRuntimeCodeUpdate = () => {
    if (refs.runtimeCodeRafIdRef.current !== null) {
      cancelAnimationFrame(refs.runtimeCodeRafIdRef.current)
      refs.runtimeCodeRafIdRef.current = null
    }
    const pending = refs.pendingRuntimeCodeRef.current
    refs.pendingRuntimeCodeRef.current = null
    if (typeof pending !== 'string') return
    latestRuntimeCode = pending
    setCode(pending)
    const now = Date.now()
    if (now - refs.lastRuntimeCodeWriteRef.current >= 200) {
      refs.lastRuntimeCodeWriteRef.current = now
      if (canPublishTeacherLive()) updateTeacherLive(currentTeacherLivePayload({ code: pending }))
      if (isWatched) writers.writeStudentCode(actor.anonymousId, pending)
    }
  }
  const scheduleRuntimeCodeUpdate = (nextCode) => {
    if (!runResult.liveCode || typeof nextCode !== 'string' || nextCode === latestRuntimeCode)
      return
    latestRuntimeCode = nextCode
    refs.pendingRuntimeCodeRef.current = nextCode
    if (refs.runtimeCodeRafIdRef.current !== null) return
    refs.runtimeCodeRafIdRef.current = requestAnimationFrame(flushRuntimeCodeUpdate)
  }
  refs.appendOutputRef.current = echoOutput
  const result = await runtime.run(startCode, task, {
    onOutput: (text, kind, line) => {
      echoOutput(text)
      if (runResult.errorLine && kind === 'stderr' && typeof line === 'number') {
        setErrorLine(line)
      }
    },
    onInputRequired: (prompt) => {
      refs.inputPromptRef.current = prompt
      refs.inputValueRef.current = ''
      setInputPrompt(prompt)
      if (isWatchedNow()) {
        // Bundle any output still waiting on the throttle (usually the
        // prompt text itself) with the prompt row appearing.
        outputMirror.markWritten()
        if (canPublishTeacherLive())
          updateTeacherLive(currentTeacherLivePayload({ output: outputBuffer.raw }))
        writers.writeStudentInputState(actor.anonymousId, {
          prompt,
          value: '',
          output: outputBuffer.raw,
        })
      } else {
        outputMirror.flush()
      }
    },
    onCodeUpdate: scheduleRuntimeCodeUpdate,
    getRuntimeCode: readCode,
  })
  refs.submitInputEchoRef.current = null
  outputMirror.cancel()
  if (refs.outputMirrorRef.current === outputMirror) refs.outputMirrorRef.current = null
  refs.inputPromptRef.current = null
  refs.inputValueRef.current = ''
  setInputPrompt(null)
  if (isWatchedNow()) writers.writeStudentInputState(actor.anonymousId, { prompt: null, value: '' })

  // Cancel any pending RAF and sync final output immediately
  if (refs.outputRafIdRef.current !== null) {
    cancelAnimationFrame(refs.outputRafIdRef.current)
    refs.outputRafIdRef.current = null
  }

  // A run_attempted-only task ("press Run and watch") completes on any run, so a run the
  // student stopped still counts — a demo that loops forever (a blinking LED) can only end
  // that way. It is reported like a finished run, with status 'stopped', but only while the
  // student is still on the task: a stop triggered by navigating away reports nothing.
  const stoppedRunCounts =
    result.status === 'stopped' &&
    currentTaskId === refs.currentTaskIdRef.current &&
    !alreadySolved &&
    refs.phaseRef.current !== 'sandbox' &&
    !refs.inPersonalSandboxRef.current &&
    !(task?.tests?.length > 0) &&
    completionToleratesRunError(task?.check)

  if (result.status === 'stopped' && !stoppedRunCounts) {
    flushRuntimeCodeUpdate()
    // Only repaint the buffered output if the student is still on the task that
    // produced it — a stop triggered by navigating away must not overwrite the
    // freshly reset state for the task they moved to.
    if (currentTaskId === refs.currentTaskIdRef.current) setOutput(outputBuffer.display)
    if (runResult.liveCode)
      saveRunRecord(currentTaskId, latestRuntimeCode, { output: outputBuffer.raw })
    if (canPublishTeacherLive())
      updateTeacherLive(
        currentTeacherLivePayload({ code: latestRuntimeCode, output: outputBuffer.raw })
      )
    if (isWatchedNow()) {
      writers.writeStudentCode(actor.anonymousId, latestRuntimeCode)
      writers.writeStudentOutput(actor.anonymousId, outputBuffer.raw)
    }
    setRunning(false)
    return
  }

  flushRuntimeCodeUpdate()
  setOutput(outputBuffer.display)
  const status = result.status
  setRunStatus(status)
  const nextCode = typeof result.updatedCode === 'string' ? result.updatedCode : latestRuntimeCode
  if (nextCode !== startCode) setCode(nextCode)

  if (status !== 'stopped') setTurtleResult(result.turtle ?? null)
  // `ran` tells run_attempted checks this context comes from a real run (see checks.js).
  const checkContext = checking.buildContext(nextCode, {
    status,
    variables: result.variables ?? {},
    turtle: result.turtle ?? null,
    ran: true,
  })
  // A teacher-started or personal sandbox is free play: the session still points at a
  // lesson task, but sandbox code has nothing to do with that task's check, so scoring
  // it reported a "failed" run to the teacher on every sandbox Run.
  const isFreePlay = refs.phaseRef.current === 'sandbox' || refs.inPersonalSandboxRef.current
  // A real console error, named when the output shows it ('NameError'), for the badge data.
  const runError = runErrorFor(status, outputBuffer.raw)
  const checkTask = isFreePlay ? null : task
  const hasTests = checkTask?.tests?.length > 0
  // An errored (or, see stoppedRunCounts, stopped) run fails the completion check — except a
  // run_attempted-only check, which any run satisfies.
  const runFailureBlocksCompletion =
    (status === 'error' || status === 'stopped') && !completionToleratesRunError(checkTask?.check)
  let passed = alreadySolved
    ? true
    : runFailureBlocksCompletion || hasTests || isFreePlay
      ? false
      : evaluateCheckWithFeedback(checkTask, outputBuffer.raw, checkContext).passed
  let suggestion = ''
  if (!alreadySolved && !isFreePlay) {
    // Feedback checks can diagnose code even when Python could not run (for
    // example, `print(hello)` raises NameError). Keep completion failed on a
    // runtime error, but still evaluate the feedback checks and their stage
    // offers against the submitted code/output.
    const evaluation =
      !hasTests && checkTask?.check
        ? evaluateCheckWithFeedback(checkTask, outputBuffer.raw, checkContext, {
            completionPassed:
              !runFailureBlocksCompletion &&
              evaluateCheck(checkTask.check, outputBuffer.raw, checkContext),
          })
        : null
    if (evaluation) {
      passed = evaluation.passed
      suggestion = evaluation.suggestion
      feedback.updateTargetedStageOffer(checkTask, evaluation, passed)
    }
    if (!hasTests && checkTask?.check) feedback.applyCheckFeedback(passed, suggestion)
    feedback.updateSupportStageForAttempt(status !== 'error' && (!checkTask?.check || passed))
  }

  if (canPublishTeacherLive()) {
    publishTeacherLive({
      code: nextCode,
      output: outputBuffer.raw,
      runStatus: status,
      checkPassed: passed,
      checkAttempted: !alreadySolved && !hasTests && !!checkTask?.check,
      checkSuggestion: suggestion,
    })
  }
  saveRunRecord(currentTaskId, nextCode, { output: outputBuffer.raw, runStatus: status })
  if (
    !teacherPresentation &&
    (refs.phaseRef.current === 'lesson' ||
      refs.phaseRef.current === 'sandbox' ||
      refs.inPersonalSandboxRef.current ||
      isWatched)
  ) {
    await writers.writeStudentRun(actor.anonymousId, {
      code: nextCode,
      output: outputBuffer.raw,
      status,
      checkPassed: hasTests || isFreePlay ? undefined : passed,
      errorText: status === 'error' ? lastErrorLine(outputBuffer.raw) : undefined,
    })
    // Turtle's canvas is a run RESULT (like output), not an editing-tool state like
    // Arcade's design — so it's synced here alongside writeStudentRun, not only on
    // explicit edits. Lets a teacher open StudentModal and see the student's actual
    // drawing, not just their code.
    if (runResult.turtle) writers.writeStudentTurtleResult(actor.anonymousId, result.turtle ?? null)
  }
  if (isFreePlay && !teacherPresentation) {
    signals?.reportSandboxRun({ error: runError, submission: nextCode })
  }
  if (
    !teacherPresentation &&
    refs.phaseRef.current === 'lesson' &&
    !alreadySolved &&
    !hasTests &&
    checkTask?.check
  ) {
    writers.logAttempt(actor.anonymousId, currentTaskId, {
      submission: nextCode,
      passed,
      suggestion,
      teacherAssisted: refs.teacherAssistedTaskIdsRef.current.has(currentTaskId),
      error: runError,
    })
  }
  setRunning(false)
}
