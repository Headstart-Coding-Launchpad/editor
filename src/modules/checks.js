import { createCheckRegistry } from './checkRegistry.js'
import { CHECKS as FS_CHECKS, FS_CHECK_TYPES } from './filesystem/checks.js'
import { CHECKS as PYTHON_CHECKS } from './python/checks.js'
import { CHECKS as HTML_CHECKS } from './html/checks.js'
import { ELECTRONICS_CHECK_TYPES, evaluateElectronicsCheck } from './electronics/circuit.js'
import { CHECKS as ELECTRONICS_CHECKS } from './electronics/checks.js'
import { CHECKS as TURTLE_CHECKS, TURTLE_CHECK_TYPES } from './turtle/checks.js'
import { CHECKS as DESKTOP_CHECKS, DESKTOP_CHECK_TYPES } from './desktop/checks.js'
import { CHECKS as INPUT_CHECKS, INPUT_CHECK_TYPES } from '../shared/input/checks.js'
import {
  normalizeOutput,
  normalizeExactOutput,
  countOutputLines,
  compareValues,
  evaluateCodeCheck,
  compareText,
} from '../shared/checkHelpers.js'

export function substituteTestInputs(value, inputs) {
  if (typeof value !== 'string' || !inputs?.length) return value
  return inputs.reduce((v, { name, value: val }) => {
    if (!name) return v
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return v.replace(new RegExp(`\\{${escapedName}\\}`, 'g'), () => val ?? '')
  }, value)
}

export function resolveTestCheck(check, inputs) {
  if (!check || !inputs?.length) return check
  if (Array.isArray(check)) return check.map((c) => resolveTestCheck(c, inputs))
  if (typeof check.value === 'string')
    return { ...check, value: substituteTestInputs(check.value, inputs) }
  return check
}

export function normalizeChecks(check) {
  if (!check) return []
  if (Array.isArray(check)) return check.filter((c) => c?.type)
  return [check]
}

export const FEEDBACK_TIMING = {
  AFTER_ATTEMPT: 'after_attempt',
  ON_IDLE: 'on_idle',
}

const CORE_CHECK_DEFINITIONS = {
  output: {
    subject: 'Output',
    operators: [
      'contains',
      'not_contains',
      'equals',
      'not_equals',
      'matches_regex',
      'not_matches_regex',
    ],
    fields: ['value', 'flags'],
    evaluate: 'on_run',
  },
  output_line_count: {
    subject: 'Output line count',
    operators: [
      'equals',
      'not_equals',
      'greater_than',
      'greater_than_or_equal',
      'less_than',
      'less_than_or_equal',
    ],
    fields: ['operator', 'value'],
    evaluate: 'on_run',
  },
  code: {
    subject: 'Code',
    operators: [
      'contains',
      'not_contains',
      'equals',
      'not_equals',
      'matches_regex',
      'not_matches_regex',
    ],
    fields: ['value', 'flags'],
    evaluate: 'on_change',
    submitAllowed: true,
  },
  answer: {
    subject: 'Answer',
    operators: [
      'contains',
      'not_contains',
      'equals',
      'not_equals',
      'matches_regex',
      'not_matches_regex',
    ],
    fields: ['value', 'flags'],
    evaluate: 'on_submit',
  },
  code_no_error: {
    subject: 'Run status',
    operators: ['success'],
    fields: [],
    evaluate: 'on_run',
  },
  run_attempted: {
    subject: 'Run pressed',
    operators: [],
    fields: ['requireSuccess'],
    evaluate: 'on_run',
  },
}

const CORE_LEGACY_CHECK_ALIASES = {
  output_contains: { type: 'output', operator: 'contains' },
  output_not_contains: { type: 'output', operator: 'not_contains' },
  output_equals: { type: 'output', operator: 'equals' },
  output_not_equals: { type: 'output', operator: 'not_equals' },
  output_matches_regex: { type: 'output', operator: 'matches_regex' },
  output_not_matches_regex: { type: 'output', operator: 'not_matches_regex' },
  output_line_count_at_least: { type: 'output_line_count', operator: 'greater_than_or_equal' },
  code_contains: { type: 'code', operator: 'contains' },
  code_does_not_contain: { type: 'code', operator: 'not_contains' },
  code_not_contains: { type: 'code', operator: 'not_contains' },
  code_equals: { type: 'code', operator: 'equals' },
  code_not_equals: { type: 'code', operator: 'not_equals' },
  code_matches_regex: { type: 'code', operator: 'matches_regex' },
  code_not_matches_regex: { type: 'code', operator: 'not_matches_regex' },
  answer_contains: { type: 'answer', operator: 'contains' },
  answer_not_contains: { type: 'answer', operator: 'not_contains' },
  answer_equals: { type: 'answer', operator: 'equals' },
  answer_matches_regex: { type: 'answer', operator: 'matches_regex' },
  answer_not_matches_regex: { type: 'answer', operator: 'not_matches_regex' },
}

export function normalizeCheckShape(check) {
  if (!check?.type) return check
  const alias = CORE_LEGACY_CHECK_ALIASES[check.type]
  if (!alias) return check
  return {
    ...check,
    legacyType: check.legacyType ?? check.type,
    ...alias,
    operator: check.operator ?? alias.operator,
  }
}

export function normalizeFeedbackChecks(taskOrChecks) {
  if (
    taskOrChecks &&
    typeof taskOrChecks === 'object' &&
    !Array.isArray(taskOrChecks) &&
    taskOrChecks.feedbackChecks == null &&
    taskOrChecks.incorrectChecks == null &&
    taskOrChecks.check !== undefined
  ) {
    return []
  }
  const raw = taskOrChecks?.feedbackChecks ?? taskOrChecks?.incorrectChecks ?? taskOrChecks
  return normalizeChecks(raw).map((check) => {
    const withDefaults = { mode: 'blocking', show: 'after_attempt', ...check }
    return { ...withDefaults, show: normalizeFeedbackShow(withDefaults.show) }
  })
}

function normalizeFeedbackShow(show) {
  return show === 'on_idle' || show === 'on_pause'
    ? FEEDBACK_TIMING.ON_IDLE
    : FEEDBACK_TIMING.AFTER_ATTEMPT
}

function feedbackCheckMatchesTiming(check, timing = FEEDBACK_TIMING.AFTER_ATTEMPT) {
  return normalizeFeedbackShow(check?.show) === normalizeFeedbackShow(timing)
}

// Generic static source-code checks, shared by every code-based module (Python, HTML,
// Arcade, Turtle, and Electronics' Micro Controller code). They never need a run.
export const CODE_CHECK_TYPES = [
  'code',
  'code_contains',
  'code_does_not_contain',
  'code_not_contains',
  'code_equals',
  'code_not_equals',
  'code_matches_regex',
  'code_not_matches_regex',
]

export function isCodeCheck(check) {
  return CODE_CHECK_TYPES.includes(check?.type)
}

function coreAliasesFor(type) {
  return Object.keys(CORE_LEGACY_CHECK_ALIASES).filter(
    (alias) => CORE_LEGACY_CHECK_ALIASES[alias].type === type
  )
}

function coreCheck(type, extra) {
  const def = CORE_CHECK_DEFINITIONS[type]
  return {
    type,
    owner: 'core',
    subject: def?.subject,
    operators: def?.operators,
    fields: def?.fields,
    aliases: coreAliasesFor(type),
    timing: def?.evaluate ?? 'on_run',
    requiresRun: false,
    submitAllowed: def?.submitAllowed === true,
    ...extra,
  }
}

// Run statuses that fail a `requireSuccess: true` run_attempted check: the run raised an error,
// or the student stopped it before it finished.
const RUN_FAILED_STATUSES = ['error', 'stopped']

export const RUN_ATTEMPTED_CHECK_TYPE = 'run_attempted'

// The run capabilities (defineModule `capabilities.run`) that give the student a Run button:
// Python / Turtle / Electronics ('runtime'), Arcade's Run game and Scratch's green flag
// ('workspace'), HTML ('preview'). Filesystem and Desktop ('none') have nothing to run.
const RUN_BUTTON_KINDS = ['runtime', 'workspace', 'preview']

export function moduleHasRunButton(moduleDefinition) {
  return RUN_BUTTON_KINDS.includes(moduleDefinition?.capabilities?.run)
}

// Whether a module's runs report an error status that `requireSuccess` can read (the
// 'runtime' modules). Arcade, HTML and Scratch runs never do.
export function moduleReportsRunStatus(moduleDefinition) {
  return moduleDefinition?.capabilities?.run === 'runtime'
}

export function isRunAttemptedCheck(check) {
  return check?.type === RUN_ATTEMPTED_CHECK_TYPE
}

/**
 * Whether a completion check passes on any run, whatever its status: every check is a
 * run_attempted without `requireSuccess`. Run paths normally fail a run that errored (or was
 * stopped) before evaluating the check; for such a check they evaluate it anyway, so a demo task
 * completes as soon as the student presses Run. Mixed with any other check the usual
 * "an error fails the run" rule still applies.
 */
export function completionToleratesRunError(check) {
  const checks = normalizeChecks(check)
  return (
    checks.length > 0 && checks.every((c) => isRunAttemptedCheck(c) && c.requireSuccess !== true)
  )
}

// Generic checks shared by every code-based module. Legacy aliases (output_contains,
// code_equals, answer_contains, ...) are rewritten to their canonical type + operator
// by normalizeCheckShape before lookup; they are listed as aliases so each id has
// exactly one owner and RUN_REQUIRED / SUBMIT_ALLOWED can be derived from the defs.
export const CORE_CHECKS = [
  coreCheck('output', {
    requiresRun: true,
    evaluate: (check, output) => {
      if (check.value == null) return false
      return (
        compareText(output, check.operator, check.value, {
          normalizeEquals: normalizeExactOutput,
          normalizeRegex: (value) => normalizeOutput(value, true),
          flags: check.flags,
        }) ?? false
      )
    },
  }),
  coreCheck('output_line_count', {
    requiresRun: true,
    evaluate: (check, output) => {
      if (check.value == null) return false
      return compareValues(countOutputLines(output), check.operator ?? 'equals', check.value)
    },
  }),
  coreCheck('output_not_empty', {
    requiresRun: true,
    evaluate: (_check, output) => normalizeOutput(output).length > 0,
  }),
  coreCheck('output_empty', {
    requiresRun: true,
    evaluate: (_check, output) => normalizeOutput(output).length === 0,
  }),
  coreCheck('code_no_error', {
    requiresRun: true,
    contextKey: 'status',
    evaluate: (_check, _output, context = {}) => context.status === 'success',
  }),
  // Demo tasks ("press Run and watch"): passes once the student ran the task — Run, Arcade's
  // Run game, HTML's Run, or Scratch's green flag (Scratch judges it in its own evaluator,
  // scratch/checks.js). Only a real run supplies `ran: true`, so every no-run context (code-change
  // grading, auto-check on leave, `lessons test-checks`, teacher views) leaves it unpassed. With
  // `requireSuccess: true` the run must also have finished without an error; modules that never
  // report a status (Arcade, HTML, Scratch) ignore it. See completionToleratesRunError for how an
  // erroring run still completes a run_attempted-only task.
  coreCheck('run_attempted', {
    requiresRun: true,
    contextKey: 'ran',
    // Core checks apply to every code module; this one only to those with a Run button
    // (`lessons capabilities` lists it per module; moduleTaskValidation.js rejects the rest).
    appliesTo: moduleHasRunButton,
    evaluate: (check, _output, context = {}) =>
      context.ran === true &&
      (check.requireSuccess !== true || !RUN_FAILED_STATUSES.includes(context.status)),
  }),
  coreCheck('code', {
    contextKey: 'code',
    evaluate: (check, _output, context = {}) => {
      // Generic `code` checks are shared across Python/HTML/Arcade/Turtle. When
      // evaluated in an electronics context (a circuit is available), route them
      // through the electronics evaluator so they run against the Micro Controller's
      // MicroPython source rather than the raw serialized circuit that `context.code`
      // holds there.
      if (context.circuit !== undefined) return evaluateElectronicsCheck(check, context.circuit)
      if (check.value == null) return false
      return evaluateCodeCheck(check, context.code)
    },
  }),
  coreCheck('answer', {
    contextKey: 'answer',
    evaluate: (check, output, context = {}) => {
      if (check.value == null) return false
      return (
        compareText(context.answer ?? output, check.operator, check.value, {
          normalizeEquals: normalizeExactOutput,
          flags: check.flags,
        }) ?? false
      )
    },
  }),
]

// One registry for every check type evaluateSingleCheck can dispatch. Scratch checks
// are evaluated inside the Scratch workspace (evaluateScratchCheck needs the live
// Blockly workspace and sprite state) and are deliberately not registered here —
// Scratch's `variable_equals` would also collide with Python's.
export const checkRegistry = createCheckRegistry([
  ...CORE_CHECKS,
  ...FS_CHECKS,
  ...DESKTOP_CHECKS,
  ...PYTHON_CHECKS,
  ...HTML_CHECKS,
  ...ELECTRONICS_CHECKS,
  ...TURTLE_CHECKS,
  // Owner 'input': "how was it done" checks against ctx.input (src/shared/input/checks.js).
  ...INPUT_CHECKS,
])

// The registered definition for a check type or alias (null when unknown).
export function getCheckDefinition(type) {
  return checkRegistry.get(type)
}

// Derived from the registry: every id (canonical + aliases) whose definition needs a
// run / is allowed in submit-mode tasks.
export const CHECK_TYPES = {
  RUN_REQUIRED: checkRegistry.typeIds((def) => def.requiresRun),
  SUBMIT_ALLOWED: checkRegistry.typeIds((def) => def.submitAllowed),
  FS: FS_CHECK_TYPES,
  ELECTRONICS: ELECTRONICS_CHECK_TYPES,
  TURTLE: TURTLE_CHECK_TYPES,
  DESKTOP: DESKTOP_CHECK_TYPES,
  INPUT: INPUT_CHECK_TYPES,
}

export function checkRequiresRun(check) {
  const normalized = normalizeCheckShape(check)
  return CHECK_TYPES.RUN_REQUIRED.includes(normalized?.type)
}

export function checkAllowedForSubmit(check) {
  const normalized = normalizeCheckShape(check)
  return CHECK_TYPES.SUBMIT_ALLOWED.includes(normalized?.type)
}

export function filterChecksForInteraction(check, interactionMode) {
  const checks = normalizeChecks(check)
  if (interactionMode !== 'submit') return checks
  return checks.filter(checkAllowedForSubmit)
}

// Normalise core legacy aliases, then look the type up in the registry and call its
// evaluator. Module-level aliases (element_*, fs_content_*, ...) resolve to their
// canonical definition, whose evaluator normalises them itself. Unknown → false.
export function evaluateSingleCheck(check, output, context = {}) {
  check = normalizeCheckShape(check)
  if (!check?.type) return false
  return checkRegistry.evaluate(check, output, context)
}

export function evaluateCheck(check, output, context = {}) {
  const checks = normalizeChecks(check)
  if (checks.length === 0) return false
  return checks.every((c) => evaluateSingleCheck(c, output, context))
}

export function evaluateCheckResults(check, output, context = {}) {
  return normalizeChecks(check).map((c) => ({
    ...c,
    passed: evaluateSingleCheck(c, output, context),
  }))
}

export function evaluateFeedbackCheckResults(taskOrChecks, output, context = {}, options = {}) {
  const timing = normalizeFeedbackShow(options.feedbackTiming ?? options.timing)
  return normalizeFeedbackChecks(taskOrChecks)
    .filter((c) => feedbackCheckMatchesTiming(c, timing))
    .map((c) => ({
      ...c,
      passed: evaluateSingleCheck(c, output, context),
    }))
}

// Feedback checks may overlap. Pick one deterministic, author-controlled match
// for the student-facing hint and optional stage offer. Older lessons without a
// priority retain their existing array order.
export function getHighestPriorityFeedbackMatch(results = []) {
  const safeResults = Array.isArray(results) ? results : []
  return (
    safeResults.reduce((best, result, index) => {
      if (!result?.passed) return best
      const priority =
        Number.isInteger(Number(result.priority)) && Number(result.priority) > 0
          ? Number(result.priority)
          : index + 1
      if (!best || priority < best.priority) return { result, priority, index }
      return best
    }, null)?.result ?? null
  )
}

export function getStageOfferMatchThreshold(stageOffer) {
  const threshold = Number(stageOffer?.afterMatches)
  return Number.isInteger(threshold) && threshold > 0 ? threshold : 2
}

// Like getFirstFailedCheckHint, but evaluates each completion check with the caller's own
// evaluator instead of the generic core-only evaluateSingleCheck — needed for module check
// types (e.g. Scratch's block_run/sprite_property_delta) that evaluateSingleCheck can't
// evaluate itself, and would otherwise unconditionally report as failed.
// `isCheckFailed` returns true only for a check that has definitively failed; a check it
// can't judge yet (e.g. a run-time check before any run) must return false so it never
// supplies the hint.
function getFirstFailedCheckHintCustom(check, isCheckFailed) {
  const failed = normalizeChecks(check).find((c) => isCheckFailed(c) && String(c.hint ?? '').trim())
  return failed ? String(failed.hint).trim() : ''
}

function buildCheckFeedbackResult(
  task,
  completionPassed,
  feedbackResults,
  output,
  context = {},
  isCompletionCheckFailed = null
) {
  const blockingMatch = getHighestPriorityFeedbackMatch(
    feedbackResults.filter((result) => (result.mode ?? 'blocking') === 'blocking')
  )
  const matchedFeedback = getHighestPriorityFeedbackMatch(feedbackResults)
  const matchedFeedbackHint =
    matchedFeedback && String(matchedFeedback.hint ?? '').trim()
      ? matchedFeedback
      : feedbackResults.find((result) => result.passed && String(result.hint ?? '').trim())
  const nudgeMatch = feedbackResults.find(
    (result) => result.passed && result.mode === 'nudge' && String(result.hint ?? '').trim()
  )
  const passed = completionPassed && !blockingMatch
  const suggestion = blockingMatch
    ? String(matchedFeedback?.hint ?? blockingMatch.hint ?? '').trim() || 'Not quite.'
    : completionPassed
      ? nudgeMatch
        ? String(nudgeMatch.hint).trim()
        : ''
      : matchedFeedbackHint
        ? String(matchedFeedbackHint.hint).trim()
        : isCompletionCheckFailed
          ? getFirstFailedCheckHintCustom(task?.check, isCompletionCheckFailed)
          : getFirstFailedCheckHint(task?.check, output, context)

  return {
    passed,
    completionPassed,
    feedbackResults,
    matchedFeedback,
    stageOffer: matchedFeedback?.stageOffer ?? null,
    blockingFeedback: blockingMatch ?? null,
    nudgeFeedback: nudgeMatch ?? null,
    suggestion,
  }
}

export function evaluateCheckWithFeedback(task, output, context = {}, options = {}) {
  const completionPassed = options.completionPassed ?? evaluateCheck(task?.check, output, context)
  const feedbackResults = evaluateFeedbackCheckResults(task, output, context, options)
  return buildCheckFeedbackResult(task, completionPassed, feedbackResults, output, context)
}

export function evaluateCheckWithCustomFeedback(
  task,
  completionPassed,
  isFeedbackCheckPassed,
  output = '',
  context = {},
  options = {}
) {
  const timing = normalizeFeedbackShow(options.feedbackTiming ?? options.timing)
  const feedbackResults = normalizeFeedbackChecks(task)
    .filter((c) => feedbackCheckMatchesTiming(c, timing))
    .map((c) => ({
      ...c,
      passed: isFeedbackCheckPassed(c),
    }))
  // Completion-check hints: by default a completion check failed when the evaluator says it
  // didn't pass. Callers that can only partly judge the checks (Scratch's after_block_placed
  // evaluation, before any run) pass `isCompletionCheckFailed` so that checks that are still
  // pending or can't be judged yet never supply the hint.
  const isCompletionCheckFailed =
    typeof options.isCompletionCheckFailed === 'function'
      ? options.isCompletionCheckFailed
      : (c) => !isFeedbackCheckPassed(c)
  return buildCheckFeedbackResult(
    task,
    completionPassed,
    feedbackResults,
    output,
    context,
    isCompletionCheckFailed
  )
}

export function getFirstFailedCheckHint(check, output, context = {}) {
  const failed = evaluateCheckResults(check, output, context).find(
    (result) => !result.passed && String(result.hint ?? '').trim()
  )
  return failed ? String(failed.hint).trim() : ''
}

// Returns the hint from the first incorrect check that passes (i.e. detects a specific mistake).
// Call this when the completion check has failed to get a targeted hint.
export function getIncorrectCheckHint(incorrectChecks, output, context = {}) {
  const checks = normalizeFeedbackChecks(incorrectChecks)
  const matched = checks.find(
    (c) => evaluateSingleCheck(c, output, context) && String(c.hint ?? '').trim()
  )
  return matched ? String(matched.hint).trim() : ''
}

// Evaluates only code-based checks (no run required). Safe to call without executing the code.
// `context` may carry extra keys (e.g. `circuit` for electronics, so generic
// `code` checks resolve against the Micro Controller's MicroPython source).
export function evaluateCheckWithCode(check, code, context = {}) {
  const checks = normalizeChecks(check)
  if (checks.length === 0) return false
  if (!checks.every((c) => checkAllowedForSubmit(c) || ELECTRONICS_CHECK_TYPES.includes(c.type)))
    return false
  return checks.every((c) => evaluateSingleCheck(c, '', { code, ...context }))
}

// ─── Grading without a run (auto-check on leave) ─────────────────────────────────────────────
// When the teacher moves a live class on, a student who never passed the task has their current
// work graded without running it (useStudentCodeState autoCheckOnLeave, logged as an attempt
// with `auto: 'leave'`). Only checks that a run cannot change are judged; no code is executed.

// The outcomes of grading without a run: every check passed, a check failed (or a blocking
// feedback check matched), or the task needs a run that never happened.
export const NO_RUN_RESULTS = Object.freeze({
  PASSED: 'passed',
  FAILED: 'failed',
  NOT_RUN: 'not_run',
})

// Context keys only a run produces: code_no_error's `status`, Python's captured `variables`,
// Turtle's drawing, HTML's rendered `iframeDoc` and run_attempted's `ran`. A check reading one
// needs a run even when its registry definition does not set `requiresRun` (Turtle's checks).
export const RUN_CONTEXT_KEYS = Object.freeze(['status', 'variables', 'turtle', 'iframeDoc', 'ran'])

/**
 * Whether a check can only be judged from a run's result: a run-required type, or one reading a
 * run-only context key. Unknown types return false (the caller decides what to do with them).
 */
export function checkNeedsRunResult(check) {
  const normalized = normalizeCheckShape(check)
  const def = normalized?.type ? getCheckDefinition(normalized.type) : null
  if (!def) return false
  return def.requiresRun === true || RUN_CONTEXT_KEYS.includes(def.contextKey)
}

/**
 * Whether one check can be judged from the work alone. False for a run-required type, a check
 * reading a run's result, a check whose context key the caller did not supply (an `answer`
 * check with no answer), and any type the registry does not know (Scratch's checks are judged
 * by the module's own `checking.evaluateWithoutRun`).
 */
export function canEvaluateCheckWithoutRun(check, context = {}) {
  const normalized = normalizeCheckShape(check)
  if (!normalized?.type) return false
  const def = getCheckDefinition(normalized.type)
  if (!def || def.requiresRun) return false
  if (def.contextKey && RUN_CONTEXT_KEYS.includes(def.contextKey)) return false
  if (def.contextKey && context?.[def.contextKey] === undefined) return false
  return true
}

// The default judge for evaluateTaskWithoutRun: true / false for a check it can judge from the
// context alone, null for one that needs a run.
function judgeCheckWithoutRun(check, context) {
  return canEvaluateCheckWithoutRun(check, context) ? evaluateSingleCheck(check, '', context) : null
}

/**
 * The tri-state verdict of a completion check without a run: 'failed' when any check that can
 * be judged fails (the task cannot pass whatever a run would show), else 'not_run' when some
 * check needs a run, else 'passed'. Null when there is no check. `judgeCheck(check)` returns
 * true / false, or null for a check it cannot judge (defaults to the registry judge above).
 */
export function evaluateCheckWithoutRun(check, context = {}, judgeCheck = null) {
  const judge = judgeCheck ?? ((c) => judgeCheckWithoutRun(c, context))
  const checks = normalizeChecks(check)
  if (checks.length === 0) return null
  let needsRun = false
  for (const c of checks) {
    const verdict = judge(c)
    if (verdict == null) needsRun = true
    else if (!verdict) return NO_RUN_RESULTS.FAILED
  }
  return needsRun ? NO_RUN_RESULTS.NOT_RUN : NO_RUN_RESULTS.PASSED
}

/**
 * Grades a task's work without running it: `{ result, suggestion }`, or null when the task has
 * nothing to grade (no `check` and no `tests`). Rules:
 * - a completion check that can be judged fails → 'failed';
 * - a blocking feedback check that can be judged matches → 'failed' (a run would fail too);
 * - otherwise any check that needs a run, or Python `tests`, → 'not_run';
 * - otherwise → 'passed'.
 * `suggestion` is the hint a run would have shown for a 'failed' result ('' otherwise); feedback
 * checks that need a run never match, so they never supply it. `options.judgeCheck` replaces
 * the registry judge (Scratch judges its block checks against the saved workspace JSON).
 */
export function evaluateTaskWithoutRun(task, context = {}, { judgeCheck = null } = {}) {
  const judge = judgeCheck ?? ((c) => judgeCheckWithoutRun(c, context))
  const hasTests = Array.isArray(task?.tests) && task.tests.length > 0
  const completion = evaluateCheckWithoutRun(task?.check, context, judge)
  if (completion == null && !hasTests) return null
  // `check: null` keeps normalizeFeedbackChecks from reading a check-less task as a check.
  const feedbackTask = { ...task, check: task?.check ?? null }
  const evaluation = evaluateCheckWithCustomFeedback(
    feedbackTask,
    completion === NO_RUN_RESULTS.PASSED,
    (c) => judge(c) === true,
    '',
    context,
    {
      feedbackTiming: FEEDBACK_TIMING.AFTER_ATTEMPT,
      isCompletionCheckFailed: (c) => judge(c) === false,
    }
  )
  let result = NO_RUN_RESULTS.PASSED
  if (completion === NO_RUN_RESULTS.FAILED || evaluation.blockingFeedback) {
    result = NO_RUN_RESULTS.FAILED
  } else if (completion === NO_RUN_RESULTS.NOT_RUN || hasTests) {
    result = NO_RUN_RESULTS.NOT_RUN
  }
  return {
    result,
    suggestion: result === NO_RUN_RESULTS.FAILED ? evaluation.suggestion : '',
  }
}
