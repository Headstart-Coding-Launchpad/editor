import { completionToleratesRunError } from '../../modules/checks'
import { createThrottledMirrorWriter } from '../throttledMirrorWriter'
import { appendStudentOutput, createStudentOutputBuffer } from './studentOutputBuffer'
import { judgeRun } from './runJudge'
import { recordRun } from './runRecord'

/**
 * Runs the student's code through a `capabilities.run === 'runtime'` module's runtime (Pyodide
 * for python/turtle, MicroPython for electronics) and reports the result: output streamed to
 * the screen and, throttled, to a watching teacher and a Go Live broadcast; input() prompts;
 * the task check with feedback and stage offers; the save; the run record and attempt log.
 * The verdict is judgeRun (runJudge.js, pure) and the records are recordRun (runRecord.js);
 * this function keeps the execution, the streaming, input(), the stop and the screen.
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
 *   currentTaskIdRef, phaseRef, inPersonalSandboxRef, teacherAssistedTaskIdsRef, and optionally
 *   runEpochRef (bumped by a task change, so a run it stopped never paints onto the next task)
 * - setters: setOutput, setInputPrompt, setErrorLine, setRunStatus, setTurtleResult,
 *   setStageResult (optional), setRunning
 * - writers: writeStudentInputState, writeStudentOutput, writeStudentCode, writeStudentRun,
 *   writeStudentTurtleResult, writeStudentStageResult (optional), writeStudentTaskRun (optional),
 *   logAttempt
 * - live: canPublishTeacherLive, updateTeacherLive, currentTeacherLivePayload, publishTeacherLive
 * - feedback: applyCheckFeedback, updateTargetedStageOffer, updateSupportStageForAttempt
 * - saveRunRecord(taskId, code, fields): the task's run record (persistence.saveRunRecord)
 * - signals (optional): the live badge reporters (useStudentBadgeSignals); a free-play run is
 *   reported with reportSandboxRun
 * - variablesPanel (optional): the name-tag panel (useVariablesPanel), handed each finished run
 * - recordCourseRun (optional): a Turtle course run's `turtle.course` for the session report
 *   (useCourseLog); not for free play
 * - runOptions (optional): `{ slowMo: true, onResult(result) }` from a slow-mo Run
 *   (src/modules/python/slowMo/): the runtime records the run for playback, and `onResult` gets
 *   the runtime's result (with its `slowMo` recording) before anything else is done with it.
 *   The recorded run IS the run: output, checks, the attempt and the save are exactly as for Run.
 *   Or `{ source: 'scrub', inputAnswers? }`: the checks a live scrub runs when it ends
 *   (useScrubPreview, scrub.checkOnRelease). It is a Run in every way, except that input()
 *   questions are answered from `inputAnswers` (the last Run's answers, in order; a question past
 *   them is asked as usual) and the attempt is logged with `source: 'scrub'`.
 * - onInputAnswer (optional): told each answer given to input() on this run (typed by the
 *   student, through handleInputSubmit, is recorded by the caller; replayed ones come here)
 */
let turtleRunCount = 0

function newTurtleRunId() {
  turtleRunCount += 1
  return `${Date.now().toString(36)}-${turtleRunCount}`
}

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
    readCode,
    setCode,
    refs,
    setters,
    writers,
    live,
    feedback,
    saveRunRecord,
  } = ctx
  const { runResult } = definition
  const { setOutput, setInputPrompt, setErrorLine, setRunStatus, setTurtleResult, setRunning } =
    setters
  const { canPublishTeacherLive, updateTeacherLive, currentTeacherLivePayload } = live

  // Whether the student is still on the task this run belongs to. The task id alone is not
  // enough: a task change stops the run and resets the output before the new id reaches
  // currentTaskIdRef (on the next render), so a stop resolving in between still matched and
  // painted the old task's output (an input() prompt) onto the new task. The epoch catches it.
  const runEpoch = refs.runEpochRef?.current
  const stillOnTask = () =>
    currentTaskId === refs.currentTaskIdRef.current && refs.runEpochRef?.current === runEpoch

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
  // Set while an unwatched run's input() prompt has been mirrored (see onInputRequired), so
  // it is cleared again once answered or when the run ends.
  let unwatchedPromptShared = false
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
    } else if (unwatchedPromptShared) {
      // The answer is in: the card stops saying "Waiting for input".
      unwatchedPromptShared = false
      writers.writeStudentInputState(actor.anonymousId, { prompt: null, value: '' })
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
  // A scrub's checks answer input() from the last Run's answers (see runOptions above).
  const replayAnswers = Array.isArray(ctx.runOptions?.inputAnswers)
    ? ctx.runOptions.inputAnswers
    : []
  let replayed = 0
  const result = await runtime.run(startCode, task, {
    onOutput: (text, kind, line) => {
      echoOutput(text)
      if (runResult.errorLine && kind === 'stderr' && typeof line === 'number') {
        setErrorLine(line)
      }
    },
    onInputRequired: (prompt, { stage } = {}) => {
      if (replayed < replayAnswers.length) {
        const answer = String(replayAnswers[replayed])
        replayed += 1
        refs.submitInputEchoRef.current?.(answer)
        ctx.onInputAnswer?.(answer)
        runtime.provideInput?.(answer)
        return
      }
      refs.inputPromptRef.current = prompt
      refs.inputValueRef.current = ''
      setInputPrompt(prompt)
      // The Stage shows what the program has drawn so far while the question waits (P6-32), for
      // the student and (one write per prompt) the tutor; the finished run's drawing replaces it.
      // Slow-mo plays the drawing back after the run instead.
      if (stage && runResult.stage && !ctx.runOptions?.slowMo) {
        setters.setStageResult?.(stage)
        writers.writeStudentStageResult?.(actor.anonymousId, stage)
      }
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
        // Tutor visibility: an unwatched student's card would otherwise say "No output yet"
        // while their program sits waiting for input() (HSC Audit, Visual Review 03). One
        // write per prompt (never per keystroke): the prompt and the output so far, so the
        // card can say "Waiting for input". The typed value stays unmirrored.
        unwatchedPromptShared = true
        writers.writeStudentInputState(actor.anonymousId, {
          prompt,
          value: '',
          output: outputBuffer.raw,
        })
      }
    },
    onCodeUpdate: scheduleRuntimeCodeUpdate,
    getRuntimeCode: readCode,
    ...(ctx.runOptions?.slowMo ? { slowMo: true } : {}),
    // Free play (a sandbox) never runs the task's hidden setupCode.
    ...(refs.phaseRef.current === 'sandbox' || refs.inPersonalSandboxRef.current
      ? { freePlay: true }
      : {}),
  })
  ctx.runOptions?.onResult?.(result)
  refs.submitInputEchoRef.current = null
  outputMirror.cancel()
  if (refs.outputMirrorRef.current === outputMirror) refs.outputMirrorRef.current = null
  refs.inputPromptRef.current = null
  refs.inputValueRef.current = ''
  setInputPrompt(null)
  if (isWatchedNow() || unwatchedPromptShared) {
    writers.writeStudentInputState(actor.anonymousId, { prompt: null, value: '' })
  }
  unwatchedPromptShared = false

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
    stillOnTask() &&
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
    if (stillOnTask()) setOutput(outputBuffer.display)
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

  // A Run's Turtle drawing gets a runId so the picture plays it (src/modules/turtle/
  // useTurtlePlayback.js), here and on Go Live screens. A slow-mo run has none: slow-mo plays it.
  if (status !== 'stopped') {
    setTurtleResult(
      result.turtle
        ? ctx.runOptions?.slowMo
          ? result.turtle
          : { ...result.turtle, runId: newTurtleRunId() }
        : null
    )
  }
  // The Python Stage drawing (src/shared/stage/): the pane shows it once the code draws.
  if (status !== 'stopped' && runResult.stage) setters.setStageResult?.(result.stage ?? null)
  // The name-tag panel (showVariables, useVariablesPanel.js) shows this run and marks the
  // predictions; it hands back `variablePredictions` for the variables_predicted check, and the
  // run counts (runCounts / #@count, src/shared/runCounts.js: placed on the code that ran) as
  // `runCounts` for runs_predicted / line_run_count. Free play (a sandbox) has no task panel.
  const panelContext =
    ctx.variablesPanel?.receiveRun({
      task: refs.phaseRef.current === 'sandbox' || refs.inPersonalSandboxRef.current ? null : task,
      status,
      result,
      code: startCode,
    }) ?? {}
  // A teacher-started or personal sandbox is free play: the session still points at a
  // lesson task, but sandbox code has nothing to do with that task's check, so scoring
  // it reported a "failed" run to the teacher on every sandbox Run.
  const isFreePlay = refs.phaseRef.current === 'sandbox' || refs.inPersonalSandboxRef.current
  const source = ctx.runOptions?.source
  // The verdict (runJudge.js, pure), then its feedback on screen, then the records (runRecord.js).
  // setRunning(false) is in a finally: a throw from a check or a rejected/throwing write still
  // propagates unchanged, but no longer leaves Run stuck on Stop. On success it runs once, after
  // await recordRun, exactly where it was.
  try {
    const judgement = judgeRun({
      task,
      definition,
      code: nextCode,
      status,
      outputRaw: outputBuffer.raw,
      result,
      panelContext,
      alreadySolved,
      isFreePlay,
      source,
    })
    const { passed, suggestion, evaluation, isScrubRun, hasTests, checkTask } = judgement
    if (!alreadySolved && !isFreePlay) {
      if (evaluation) feedback.updateTargetedStageOffer(checkTask, evaluation, passed)
      // A repeated mistake shows (and records) the next hint of the ladder (C5).
      if (!hasTests && checkTask?.check)
        judgement.suggestion =
          feedback.applyCheckFeedback(passed, suggestion, { scrub: isScrubRun, evaluation }) ??
          suggestion
      // A failed scrub release is not a failed attempt, so it does not step the support offers.
      if (!(isScrubRun && !passed)) {
        feedback.updateSupportStageForAttempt(status !== 'error' && (!checkTask?.check || passed))
      }
    }

    await recordRun(ctx, {
      code: nextCode,
      outputRaw: outputBuffer.raw,
      status,
      result,
      judgement,
      source,
    })
  } finally {
    setRunning(false)
  }
}
