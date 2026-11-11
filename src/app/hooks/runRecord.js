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
 *   writers.logAttempt; signals (optional, .reportSandboxRun); recordCourseRun (optional);
 *   confirmsLivePass (optional: the task was ticked by a typed redraw, request 131).
 * RECORD_RUN_CTX_FIELDS lists the required ones; missingRecordRunFields(ctx) names any missing.
 * A rejected or throwing writer propagates out of recordRun unchanged (later records skipped).
 * `run` is `{ code, outputRaw, status, result, judgement, shownSuggestion, source }`: the code
 * that ran (after any runtime update), its raw output, status and runtime result, judgeRun's
 * judgement, the hint on screen (C5 ladder; else judgement.suggestion), and the Run's source (`'scrub'`, or `'live'` for a typed redraw's pass, request 131, is logged on the attempt).
 */
// The ctx fields recordRun needs, as paths (writeStudentTurtleResult only when runResult.turtle).
export const RECORD_RUN_CTX_FIELDS = Object.freeze([
  'actor.anonymousId',
  'definition.runResult',
  'currentTaskId',
  'isWatched',
  'alreadySolved',
  'teacherPresentation',
  'refs.phaseRef',
  'refs.inPersonalSandboxRef',
  'refs.teacherAssistedTaskIdsRef',
  'live.canPublishTeacherLive',
  'live.publishTeacherLive',
  'saveRunRecord',
  'writers.writeStudentRun',
  'writers.logAttempt',
])

/** The RECORD_RUN_CTX_FIELDS paths `ctx` leaves undefined (an empty list when it has them all). */
export function missingRecordRunFields(ctx) {
  const fields = [...RECORD_RUN_CTX_FIELDS]
  if (ctx?.definition?.runResult?.turtle) fields.push('writers.writeStudentTurtleResult')
  return fields.filter(
    (path) => path.split('.').reduce((value, key) => value?.[key], ctx) === undefined
  )
}

export async function recordRun(ctx, run) {
  const { code, outputRaw, status, result, judgement, shownSuggestion, source } = run
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
  const { passed, scrubPassed, hasTests, checkTask, isFreePlay, evaluation } = judgement
  const suggestion = shownSuggestion ?? judgement.suggestion
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
      // After an explained crash no hint shows, but the author's held hint is still recorded.
      suggestion: suggestion || evaluation?.hintLadder?.[0] || '',
      teacherAssisted: refs.teacherAssistedTaskIdsRef.current.has(currentTaskId),
      error: runError,
      ...(source === 'scrub' || source === 'live' ? { source } : {}),
    })
  } else if (
    ctx.confirmsLivePass === true &&
    alreadySolved &&
    status === 'success' &&
    source !== 'scrub' &&
    source !== 'live' &&
    !teacherPresentation &&
    refs.phaseRef.current === 'lesson' &&
    !hasTests &&
    checkTask?.check
  ) {
    // A pressed Run of a task a typed redraw ticked (request 131): logAttempt gives that attempt
    // the Run's source when the code is the same, and logs nothing otherwise.
    writers.logAttempt(actor.anonymousId, currentTaskId, {
      submission: code,
      passed: true,
      onSolvedTask: true,
    })
  }
}
