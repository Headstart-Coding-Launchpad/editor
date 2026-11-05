import {
  FEEDBACK_TIMING,
  completionToleratesRunError,
  evaluateCheck,
  evaluateCheckWithFeedback,
  normalizeCheckShape,
  normalizeFeedbackChecks,
} from '../../modules/checks'
import { explainPythonError } from '../../shared/pythonErrors.js'
import { codeCallsInput } from '../../shared/scrub/runOnOpen.js'
import { getShowVariables } from '../../shared/variablesPanel/variablesPanel.js'
import { getRunCounts, taskCountsRuns } from '../../shared/runCounts.js'
import { PYTHON_CHECK_TYPES } from '../../modules/python/checks.js'
import { STAGE_CHECK_TYPES, STAGE_TEXT_OPERATORS, finite } from '../../shared/stage/checks.js'
import { visibleCommands } from '../../shared/stage/commands.js'
import { DEFAULT_TEXT_OPERATOR } from '../../shared/checkHelpers.js'
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
  // With a completion check, the feedback evaluation below sets `passed` (same checks, same
  // context), so this first evaluation is only made for a task without one.
  const evaluatedBelow = !alreadySolved && !isFreePlay && !hasTests && !!checkTask?.check
  let passed = alreadySolved
    ? true
    : runFailureBlocksCompletion || hasTests || isFreePlay
      ? false
      : evaluatedBelow
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

// Request 131: which checks a typed redraw may tick on. A redraw runs half-typed code as the
// student types, so a COMPLETION check must need positive evidence of the right answer: it may
// not pass on trivial, unchanged or half-typed code. Classified per canonical type (aliases such
// as output_contains / code_does_not_contain are normalised first); every type not listed here,
// including any added later, ticks on Run only (runJudge.test.js lists each registry type and its
// decision):
// - output, code, stage_text_shown: only the positive operators (STAGE_TEXT_OPERATORS: contains,
//   equals, matches_regex; no operator is contains, as on Run); never not_*.
// - code_structure: nested_in, directly_nested_in; never not_nested_in.
// - stage_colour_used: yes (something specific is drawn).
// - stage_matches_target, stage_pixel: yes, but only on a drawn Stage that differs from the
//   starter's (liveTickStageAllows): either can pass on a blank Stage or the starter's drawing.
// - stage_shape_count: at least min (min >= 1, or neither min nor max: at least 1) or exactly
//   min (min === max >= 1); never an upper bound alone, a min of 0 or a range.
// - variable_equals, variable_dict_contains, variable_dict_equals, variable_dict_key_value,
//   variable_array_contains, variable_array_equals, variable_array_nth_item: yes (a value).
// - no: code_no_error, output_not_empty, output_empty, output_line_count, max_lines (pass on
//   any or trivial code), variable_exists, variable_type (pass on half-typed code),
//   variable_not_equals (negative), run_attempted, answer, the name-tag panel's and run counts'
//   checks, input checks and every other module's checks.
// The positive text operators are the Stage's own list (contains, equals, matches_regex); a check
// with no operator is compared with the evaluator's default (DEFAULT_TEXT_OPERATOR, contains) on
// Run, so it is read the same way here.
export const LIVE_TICK_TEXT_OPERATORS = STAGE_TEXT_OPERATORS
const positiveText = (check) =>
  LIVE_TICK_TEXT_OPERATORS.includes(check.operator ?? DEFAULT_TEXT_OPERATOR)
const always = () => true
export const LIVE_TICK_COMPLETION_CHECKS = Object.freeze({
  output: positiveText,
  code: positiveText,
  code_structure: (check) => ['nested_in', 'directly_nested_in'].includes(check.operator),
  // Only on a drawn Stage that differs from the starter's (liveTickStageAllows).
  stage_matches_target: always,
  stage_colour_used: always,
  stage_pixel: always,
  stage_text_shown: positiveText,
  stage_shape_count: (check) => {
    const min = finite(check.min)
    const max = finite(check.max)
    if (max === null) return min === null || min >= 1
    return min !== null && min >= 1 && min === max
  },
  variable_equals: always,
  variable_dict_contains: always,
  variable_dict_equals: always,
  variable_dict_key_value: always,
  variable_array_contains: always,
  variable_array_equals: always,
  variable_array_nth_item: always,
})

// A FEEDBACK check never makes a pass (it can only hold one back with its hint), so it only has
// to read what the redraw's own run gives exactly as a Run of the same code does: output,
// status, code, captured variables, the Stage drawing and its target. run_attempted's `ran`, the
// name-tag panel's predictions, run counts, answers, input checks and any type added later: no.
export const LIVE_TICK_FEEDBACK_CHECK_TYPES = Object.freeze([
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

// The entries of a check (or list), each normalised; null when any entry is not a plain check.
// Strict, and flat: no evaluator reads checks nested in a check (`check` / `checks` keys), so an
// entry carrying one, or an entry with no type, means no live tick.
function plainChecks(check) {
  const entries = check == null ? [] : Array.isArray(check) ? check : [check]
  const plain = []
  for (const c of entries) {
    if (c == null || typeof c !== 'object' || c.check !== undefined || c.checks !== undefined) {
      return null
    }
    const normalized = normalizeCheckShape(c)
    if (typeof normalized?.type !== 'string') return null
    plain.push(normalized)
  }
  return plain
}

/** Whether one completion check may tick a typed redraw (LIVE_TICK_COMPLETION_CHECKS). */
export function liveTickCompletionCheck(check) {
  const plain = plainChecks(check)
  if (!plain || plain.length !== 1) return false
  const rule = Object.prototype.hasOwnProperty.call(LIVE_TICK_COMPLETION_CHECKS, plain[0].type)
    ? LIVE_TICK_COMPLETION_CHECKS[plain[0].type]
    : null
  return rule?.(plain[0]) === true
}

// Completion checks that can pass on a blank Stage (stage_pixel on the background colour) or on
// the starter's own drawing (stage_matches_target with a loose tolerance): they tick only on a
// drawn Stage that differs from the starter's (liveTickStageAllows).
export const LIVE_TICK_DRAWN_STAGE_CHECKS = Object.freeze(['stage_pixel', 'stage_matches_target'])

/** Whether `task`'s completion checks need the starter's Stage to tick (liveTickStageAllows). */
export function liveTickNeedsStarterStage(task) {
  const plain = plainChecks(task?.check)
  return !!plain && plain.some((c) => LIVE_TICK_DRAWN_STAGE_CHECKS.includes(c.type))
}

/**
 * Whether a typed redraw's Stage (`commands`) may tick `task` (request 131): always, unless a
 * completion check is in LIVE_TICK_DRAWN_STAGE_CHECKS; then only when something is drawn (after
 * the last clear) and the drawing is not the starter's (`starterCommands`, from a run of the
 * starter code; null when unknown, which never ticks). Pure.
 */
export function liveTickStageAllows({ task, commands, starterCommands }) {
  if (!liveTickNeedsStarterStage(task)) return true
  const drawn = Array.isArray(commands) ? commands : []
  if (visibleCommands(drawn).length === 0) return false
  if (!Array.isArray(starterCommands)) return false
  return JSON.stringify(drawn) !== JSON.stringify(starterCommands)
}

function allCompletionChecksTick(check) {
  const plain = plainChecks(check)
  return !!plain && plain.length > 0 && plain.every((c) => liveTickCompletionCheck(c))
}

function allFeedbackChecksReadable(checks) {
  const plain = plainChecks(checks)
  return !!plain && plain.every((c) => LIVE_TICK_FEEDBACK_CHECK_TYPES.includes(c.type))
}

// Code the same as the starter, but for trailing spaces and blank lines at either end.
function sameCode(a, b) {
  const plain = (text) =>
    String(text ?? '')
      .replace(/[ \t]+$/gm, '')
      .trim()
  return plain(a) === plain(b)
}

/**
 * Whether a finished typed redraw of `code` may tick `task` (request 131): a Python Stage task
 * ('runtime' module with the Stage), live or solo, whose every completion check needs positive
 * evidence (LIVE_TICK_COMPLETION_CHECKS) and every feedback check reads only the redraw's own run
 * (LIVE_TICK_FEEDBACK_CHECK_TYPES), with code that is not the task's starter (`starterCode`, the
 * starter work's code: a pass on unchanged starter code is not the student's work). Typed code
 * tasks only: never an activity or a code_arrange task
 * (its program comes from tiles, not typing), nor a copyCode task (its first Run measures how far
 * the code is from the copy, typingStats.noteRun). Never for submit mode, Python tests,
 * input() in the code or setupCode (a redraw replays old answers), the name-tag panel or run
 * counts, an on-idle feedback check, a run_attempted check ("press Run and watch"), a task whose
 * Run plays in slow-mo, predict mode's Run lock, the presentation window, the Builder preview or
 * either sandbox. Pure.
 */
export function liveTickEligible({
  task,
  definition,
  code,
  starterCode,
  phase,
  teacherPresentation,
  previewMode,
  inPersonalSandbox,
  predictRunLocked,
}) {
  if (!task?.check || !definition) return false
  if (sameCode(code, starterCode) || sameCode(code, task.starterCode)) return false
  if (phase !== 'lesson' && phase !== 'solo') return false
  if (teacherPresentation || previewMode || inPersonalSandbox || predictRunLocked) return false
  if (definition.capabilities?.run !== 'runtime' || !definition.runResult?.stage) return false
  if (getActivityId(task) !== null) return false
  if (task.copyCode != null && task.copyCode !== '') return false
  if (task.interactionMode === 'submit' || task.tests?.length > 0) return false
  if (codeCallsInput(code) || codeCallsInput(task.setupCode)) return false
  if (getShowVariables(task) || getRunCounts(task) != null || taskCountsRuns(task)) return false
  if (completionToleratesRunError(task.check)) return false
  if (slowMoThroughRun(getPythonSlowMo(task))) return false
  const feedback = normalizeFeedbackChecks(task)
  if (feedback.some((c) => c.show !== FEEDBACK_TIMING.AFTER_ATTEMPT)) return false
  return allCompletionChecksTick(task.check) && allFeedbackChecksReadable(feedback)
}
