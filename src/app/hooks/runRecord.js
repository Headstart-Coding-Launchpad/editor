import { runErrorFor } from '../../badges/signals'
import { lastErrorLine } from '../studentHints.js'

/**
 * The records of a judged runtime Run (request 131 design: the "record" part of runWithRuntime,
 * moved out unchanged): the Go Live publish, the saved run record, the student's run (with the
 * Turtle or Stage drawing), the Turtle course run, the free-play badge signal, the per-task last
 * run, and the attempt log. Each keeps its own phase, presentation and free-play conditions.
 *
 * `ctx` is runWithRuntime's ctx. recordRun reads only these fields:
 *   actor.anonymousId; currentTaskId; isWatched; alreadySolved; teacherPresentation;
 *   definition.runResult (.turtle, .stage); refs.phaseRef, refs.inPersonalSandboxRef,
 *   refs.teacherAssistedTaskIdsRef; live.canPublishTeacherLive, live.publishTeacherLive;
 *   saveRunRecord; writers.writeStudentRun, writers.writeStudentTurtleResult (required when
 *   runResult.turtle), writers.writeStudentStageResult / writeStudentTaskRun (optional),
 *   writers.logAttempt; signals (optional, .reportSandboxRun); recordCourseRun (optional).
 * A rejected or throwing writer propagates out of recordRun unchanged (later records skipped).
 * `run` is `{ code, outputRaw, status, result, judgement, source }`: the code that ran (after any
 * runtime update), its raw output, status and runtime result, judgeRun's judgement, and the Run's
 * source (`'scrub'`, or `'live'` for a typed redraw's pass, request 131, is logged on the attempt).
 */
export async function recordRun(ctx, { code, outputRaw, status, result, judgement, source }) {
  const {
    actor,
    definition,
    currentTaskId,
    isWatched,
    alreadySolved,
    teacherPresentation,
    refs,
    writers,
    live,
    saveRunRecord,
    signals = null,
  } = ctx
  const { runResult } = definition
  const { canPublishTeacherLive, publishTeacherLive } = live
  const { passed, suggestion, scrubPassed, hasTests, checkTask, isFreePlay } = judgement
  // A real console error, named when the output shows it ('NameError'), for the badge data.
  const runError = runErrorFor(status, outputRaw)

  if (canPublishTeacherLive()) {
    publishTeacherLive({
      code,
      output: outputRaw,
      runStatus: status,
      checkPassed: passed,
      checkAttempted: !alreadySolved && !hasTests && !!checkTask?.check,
      checkSuggestion: suggestion,
    })
  }
  saveRunRecord(currentTaskId, code, { output: outputRaw, runStatus: status })
  if (
    !teacherPresentation &&
    (refs.phaseRef.current === 'lesson' ||
      refs.phaseRef.current === 'sandbox' ||
      refs.inPersonalSandboxRef.current ||
      isWatched)
  ) {
    // A rejected write rejects recordRun here (as on main): the records below are skipped and
    // the error reaches handleRun. runWithRuntime's finally still ends the Run.
    await writers.writeStudentRun(actor.anonymousId, {
      code,
      output: outputRaw,
      status,
      checkPassed: hasTests || isFreePlay ? undefined : passed,
      ...(typeof scrubPassed === 'boolean' ? { scrubPassed } : {}),
      errorText: status === 'error' ? lastErrorLine(outputRaw) : undefined,
    })
    // Turtle's canvas is a run RESULT (like output), not an editing-tool state like
    // Arcade's design — so it's synced here alongside writeStudentRun, not only on
    // explicit edits. Lets a teacher open StudentModal and see the student's actual
    // drawing, not just their code.
    if (runResult.turtle) writers.writeStudentTurtleResult(actor.anonymousId, result.turtle ?? null)
    // The Python Stage drawing is a run result too: the tutor's card and StudentModal draw it.
    if (runResult.stage) writers.writeStudentStageResult?.(actor.anonymousId, result.stage ?? null)
  }
  // A Turtle course run (task.course) for the session report.
  if (!isFreePlay && result.turtle?.course) ctx.recordCourseRun?.(result.turtle.course)
  if (isFreePlay && !teacherPresentation) {
    signals?.reportSandboxRun({ error: runError, submission: code })
  }
  // Every lesson Run keeps its code per task, checked or not, solved or not (lastRuns): what the
  // End Session share link and the session report use for a task's final code.
  if (!teacherPresentation && !isFreePlay && refs.phaseRef.current === 'lesson') {
    writers.writeStudentTaskRun?.(actor.anonymousId, currentTaskId, code)
  }
  if (
    !teacherPresentation &&
    refs.phaseRef.current === 'lesson' &&
    !alreadySolved &&
    !hasTests &&
    checkTask?.check
  ) {
    writers.logAttempt(actor.anonymousId, currentTaskId, {
      submission: code,
      passed,
      suggestion,
      teacherAssisted: refs.teacherAssistedTaskIdsRef.current.has(currentTaskId),
      error: runError,
      ...(source === 'scrub' || source === 'live' ? { source } : {}),
    })
  }
}
