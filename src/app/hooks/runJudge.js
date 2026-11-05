import {
  completionToleratesRunError,
  evaluateCheck,
  evaluateCheckWithFeedback,
} from '../../modules/checks'
import { explainPythonError } from '../../shared/pythonErrors.js'

/**
 * The judge of a finished runtime Run (request 131 design: the "judge" part of runWithRuntime,
 * moved out unchanged). Pure: no React, no Firebase, no feedback effects. runWithRuntime calls it
 * and then applies the feedback (stage offer, check feedback, support stage) and the records
 * (runRecord.js recordRun) from what it returns.
 */

/**
 * The check context of a Run: the module's `checking.buildContext` over the code that ran, its
 * status, captured variables, Turtle drawing, Python Stage drawing with the task's target, and
 * the name-tag panel's extras (`panelContext`, from useVariablesPanel.receiveRun).
 */
export function buildRunCheckContext({ definition, code, status, result, panelContext }) {
  const { runResult, checking } = definition
  // `ran` tells run_attempted checks this context comes from a real run (see checks.js).
  return checking.buildContext(code, {
    status,
    variables: result.variables ?? {},
    turtle: result.turtle ?? null,
    // The Python Stage checks read the drawing and the task's target drawing (stageTarget).
    stage: runResult.stage
      ? { commands: result.stage?.commands ?? [], target: result.stageTarget ?? null }
      : null,
    ran: true,
    ...panelContext,
  })
}

/**
 * Judges a finished Run of `code` (status, output, runtime result) on `task`.
 * - `alreadySolved`: a solved task stays passed (no evaluation, no feedback).
 * - `isFreePlay`: a teacher or personal sandbox, never checked against the task.
 * - `source`: `'scrub'` for the checks a live scrub runs when it ends (its own verdict is
 *   `scrubPassed`, even on a solved task).
 * Returns `{ passed, suggestion, evaluation, scrubPassed, isScrubRun, hasTests,
 * runFailureBlocksCompletion, checkTask, isFreePlay }`; `evaluation` (the feedback evaluation,
 * for the targeted stage offer) is null when there was none.
 */
export function judgeRun({
  task,
  definition,
  code,
  status,
  outputRaw,
  result,
  panelContext,
  alreadySolved,
  isFreePlay,
  source,
}) {
  const checkContext = buildRunCheckContext({ definition, code, status, result, panelContext })
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
      : evaluateCheckWithFeedback(checkTask, outputRaw, checkContext).passed
  // A scrub's own verdict, even on a solved task (where `passed` holds on): the tutor's card
  // and modal show it as "After scrub".
  const isScrubRun = source === 'scrub'
  const scrubPassed =
    isScrubRun && !isFreePlay && !hasTests && checkTask?.check
      ? !runFailureBlocksCompletion && evaluateCheck(checkTask.check, outputRaw, checkContext)
      : null
  let suggestion = ''
  let evaluation = null
  if (!alreadySolved && !isFreePlay) {
    // Feedback checks can diagnose code even when Python could not run (for
    // example, `print(hello)` raises NameError). Keep completion failed on a
    // runtime error, but still evaluate the feedback checks and their stage
    // offers against the submitted code/output.
    evaluation =
      !hasTests && checkTask?.check
        ? evaluateCheckWithFeedback(checkTask, outputRaw, checkContext, {
            completionPassed:
              !runFailureBlocksCompletion &&
              evaluateCheck(checkTask.check, outputRaw, checkContext),
            // An errored Run: no Stage hint (the error help shows instead).
            runErrored: status === 'error',
            // The error help (ErrorHelp) explains this crash: no completion-check hint too.
            errorExplained:
              status === 'error' &&
              definition?.capabilities?.errorHelp === true &&
              explainPythonError(outputRaw) != null,
          })
        : null
    if (evaluation) {
      passed = evaluation.passed
      suggestion = evaluation.suggestion
    }
  }
  return {
    passed,
    suggestion,
    evaluation,
    scrubPassed,
    isScrubRun,
    hasTests,
    runFailureBlocksCompletion,
    checkTask,
    isFreePlay,
  }
}
