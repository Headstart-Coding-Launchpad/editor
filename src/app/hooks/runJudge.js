import {
  FEEDBACK_TIMING,
  completionToleratesRunError,
  evaluateCheck,
  evaluateCheckWithFeedback,
  normalizeCheckShape,
  normalizeChecks,
  normalizeFeedbackChecks,
} from '../../modules/checks'
import { explainPythonError } from '../../shared/pythonErrors.js'
import { codeCallsInput } from '../../shared/scrub/runOnOpen.js'
import { getShowVariables } from '../../shared/variablesPanel/variablesPanel.js'
import { getRunCounts, taskCountsRuns } from '../../shared/runCounts.js'
import { PYTHON_CHECK_TYPES } from '../../modules/python/checks.js'
import { STAGE_CHECK_TYPES } from '../../shared/stage/checks.js'
import { getPythonSlowMo, slowMoThroughRun } from '../../modules/python/slowMo/config.js'
import { getActivityId } from '../../activities/resolve.js'

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

/**
 * The check types a typed redraw may tick on (request 131): an ALLOW-list. Each reads only what
 * the redraw's own run gives exactly as a Run of the same code does (the same runtime.run with
 * the task: output, status, code, captured variables, the Stage drawing and its target). Anything
 * else (run_attempted's `ran`, the name-tag panel's predictions, run counts, answers, input
 * checks, any type added later) ticks on Run only until it is listed here.
 */
export const LIVE_TICK_CHECK_TYPES = Object.freeze([
  'output',
  'output_line_count',
  'output_not_empty',
  'output_empty',
  'code_no_error',
  'code',
  'code_structure',
  'max_lines',
  ...STAGE_CHECK_TYPES,
  ...PYTHON_CHECK_TYPES,
])

// Every check in a check (or list), with any check wrapped inside one (`check` / `checks`).
function checksIn(check) {
  return normalizeChecks(check).flatMap((c) => [c, ...checksIn(c.check), ...checksIn(c.checks)])
}

/**
 * Whether a finished typed redraw of `code` may tick `task` (request 131): a Python Stage task
 * ('runtime' module with the Stage), live or solo, whose every check (completion, feedback and
 * any wrapped inside one) is on LIVE_TICK_CHECK_TYPES. Typed code tasks only: never an activity
 * or a code_arrange task (its program comes from tiles, not typing). Never for submit mode, Python tests,
 * input() in the code or setupCode (a redraw replays old answers), the name-tag panel or run
 * counts, an on-idle feedback check, a run_attempted check ("press Run and watch"), a task whose
 * Run plays in slow-mo, predict mode's Run lock, the presentation window, the Builder preview or
 * either sandbox. Pure.
 */
export function liveTickEligible({
  task,
  definition,
  code,
  phase,
  teacherPresentation,
  previewMode,
  inPersonalSandbox,
  predictRunLocked,
}) {
  if (!task?.check || !definition) return false
  if (phase !== 'lesson' && phase !== 'solo') return false
  if (teacherPresentation || previewMode || inPersonalSandbox || predictRunLocked) return false
  if (definition.capabilities?.run !== 'runtime' || !definition.runResult?.stage) return false
  if (getActivityId(task) !== null) return false
  if (task.interactionMode === 'submit' || task.tests?.length > 0) return false
  if (codeCallsInput(code) || codeCallsInput(task.setupCode)) return false
  if (getShowVariables(task) || getRunCounts(task) != null || taskCountsRuns(task)) return false
  if (completionToleratesRunError(task.check)) return false
  if (slowMoThroughRun(getPythonSlowMo(task))) return false
  const feedback = normalizeFeedbackChecks(task)
  if (feedback.some((c) => c.show !== FEEDBACK_TIMING.AFTER_ATTEMPT)) return false
  return [...checksIn(task.check), ...checksIn(feedback)].every((c) =>
    LIVE_TICK_CHECK_TYPES.includes(normalizeCheckShape(c)?.type)
  )
}
