import { evaluateFsCheck, FS_CHECK_TYPES } from './filesystem/checks.js'
import { evaluatePythonCheck, PYTHON_CHECK_TYPES } from './python/checks.js'
import { evaluateHtmlCheck, HTML_CHECK_TYPES } from './html/checks.js'
import { ELECTRONICS_CHECK_TYPES, evaluateElectronicsCheck } from './electronics/circuit.js'
import {
  wildcardContains,
  wildcardEquals,
  normalizeOutput,
  normalizeExactOutput,
  normalizeCode,
  countOutputLines,
  matchesContainValue,
  matchesRegex,
  compareValues,
} from '../shared/checkHelpers.js'

export function substituteTestInputs(value, inputs) {
  if (typeof value !== 'string' || !inputs?.length) return value
  return inputs.reduce(
    (v, { name, value: val }) => {
      if (!name) return v
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return v.replace(new RegExp(`\\{${escapedName}\\}`, 'g'), () => val ?? '')
    },
    value,
  )
}

export function resolveTestCheck(check, inputs) {
  if (!check || !inputs?.length) return check
  if (Array.isArray(check)) return check.map(c => resolveTestCheck(c, inputs))
  if (typeof check.value === 'string') return { ...check, value: substituteTestInputs(check.value, inputs) }
  return check
}

export function normalizeChecks(check) {
  if (!check) return []
  if (Array.isArray(check)) return check.filter(c => c?.type)
  return [check]
}

export const FEEDBACK_TIMING = {
  AFTER_ATTEMPT: 'after_attempt',
  ON_IDLE: 'on_idle',
}

export const CORE_CHECK_DEFINITIONS = {
  output: {
    subject: 'Output',
    operators: ['contains', 'not_contains', 'equals', 'not_equals', 'matches_regex', 'not_matches_regex'],
    fields: ['value', 'flags'],
    evaluate: 'on_run',
  },
  output_line_count: {
    subject: 'Output line count',
    operators: ['equals', 'not_equals', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal'],
    fields: ['operator', 'value'],
    evaluate: 'on_run',
  },
  code: {
    subject: 'Code',
    operators: ['contains', 'not_contains', 'equals', 'not_equals', 'matches_regex', 'not_matches_regex'],
    fields: ['value', 'flags'],
    evaluate: 'on_change',
    submitAllowed: true,
  },
  answer: {
    subject: 'Answer',
    operators: ['contains', 'not_contains', 'equals', 'not_equals', 'matches_regex', 'not_matches_regex'],
    fields: ['value', 'flags'],
    evaluate: 'on_submit',
  },
  code_no_error: {
    subject: 'Run status',
    operators: ['success'],
    fields: [],
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
  return normalizeChecks(raw).map(check => ({
    mode: 'blocking',
    show: 'after_attempt',
    ...check,
    show: normalizeFeedbackShow(check.show),
  }))
}

export function normalizeFeedbackShow(show) {
  return show === 'on_idle' || show === 'on_pause'
    ? FEEDBACK_TIMING.ON_IDLE
    : FEEDBACK_TIMING.AFTER_ATTEMPT
}

export function feedbackCheckMatchesTiming(check, timing = FEEDBACK_TIMING.AFTER_ATTEMPT) {
  return normalizeFeedbackShow(check?.show) === normalizeFeedbackShow(timing)
}

export const CHECK_TYPES = {
  RUN_REQUIRED: [
    'output',
    'code_no_error',
    'output_contains',
    'output_equals',
    'output_not_contains',
    'output_not_equals',
    'output_matches_regex',
    'output_not_matches_regex',
    'output_line_count',
    'output_line_count_at_least',
    'output_not_empty',
    'output_empty',
    'element_exists',
    'html_element',
    'html_element_value',
    'html_element_count',
    'html_element_attribute',
    'html_element_style_property',
    'element_count',
    'element_value',
    'element_value_equals',
    'element_value_not_contains',
    'element_value_not_equals',
    'element_value_matches_regex',
    'element_value_not_matches_regex',
    'element_attribute',
    'element_style_property',
    'variable_exists',
    'variable_type',
    'variable_equals',
    'variable_dict_contains',
    'variable_dict_equals',
    'variable_dict_key_value',
    'variable_array_contains',
    'variable_array_equals',
    'variable_array_nth_item',
  ],
  SUBMIT_ALLOWED: [
    'code',
    'code_contains',
    'code_does_not_contain',
    'code_equals',
    'code_not_equals',
    'code_matches_regex',
    'code_not_matches_regex',
  ],
  FS: FS_CHECK_TYPES,
  ELECTRONICS: ELECTRONICS_CHECK_TYPES,
}

export function checkRequiresRun(check) {
  const normalized = normalizeCheckShape(check)
  return CHECK_TYPES.RUN_REQUIRED.includes(normalized?.type)
}

export function checkAllowedForSubmit(check) {
  const normalized = normalizeCheckShape(check)
  return CHECK_TYPES.SUBMIT_ALLOWED.includes(normalized?.type) || CORE_CHECK_DEFINITIONS[normalized?.type]?.submitAllowed === true
}

export function filterChecksForInteraction(check, interactionMode) {
  const checks = normalizeChecks(check)
  if (interactionMode !== 'submit') return checks
  return checks.filter(checkAllowedForSubmit)
}

export function evaluateSingleCheck(check, output, context = {}) {
  check = normalizeCheckShape(check)
  if (!check?.type) return false

  if (FS_CHECK_TYPES.includes(check.type)) {
    return evaluateFsCheck(check, context.fs, context)
  }

  if (PYTHON_CHECK_TYPES.includes(check.type)) {
    return evaluatePythonCheck(check, output, context)
  }

  if (HTML_CHECK_TYPES.includes(check.type)) {
    return evaluateHtmlCheck(check, output, context)
  }

  if (ELECTRONICS_CHECK_TYPES.includes(check.type)) {
    return evaluateElectronicsCheck(check, context.circuit ?? context.code)
  }

  if (check.type === 'code_no_error') {
    return context.status === 'success'
  }

  if (check.type === 'output_not_empty') {
    return normalizeOutput(output).length > 0
  }

  if (check.type === 'output_empty') {
    return normalizeOutput(output).length === 0
  }

  if (check.value == null) return false

  if (check.type === 'answer') {
    const answer = context.answer ?? output
    if (check.operator === 'contains') return matchesContainValue(answer, check.value, normalizeOutput)
    if (check.operator === 'not_contains') return !wildcardContains(normalizeOutput(answer), normalizeOutput(check.value))
    if (check.operator === 'equals') return wildcardEquals(normalizeExactOutput(answer), normalizeExactOutput(check.value))
    if (check.operator === 'not_equals') return !wildcardEquals(normalizeExactOutput(answer), normalizeExactOutput(check.value))
    if (check.operator === 'matches_regex') return matchesRegex(answer, check.value, check.flags)
    if (check.operator === 'not_matches_regex') return !matchesRegex(answer, check.value, check.flags)
  }

  if (check.type === 'output') {
    if (check.operator === 'contains') return matchesContainValue(output, check.value, normalizeOutput)
    if (check.operator === 'not_contains') return !wildcardContains(normalizeOutput(output), normalizeOutput(check.value))
    if (check.operator === 'equals') return wildcardEquals(normalizeExactOutput(output), normalizeExactOutput(check.value))
    if (check.operator === 'not_equals') return !wildcardEquals(normalizeExactOutput(output), normalizeExactOutput(check.value))
    if (check.operator === 'matches_regex') return matchesRegex(normalizeOutput(output, true), check.value, check.flags)
    if (check.operator === 'not_matches_regex') return !matchesRegex(normalizeOutput(output, true), check.value, check.flags)
  }

  if (check.type === 'output_line_count') {
    return compareValues(countOutputLines(output), check.operator ?? 'equals', check.value)
  }

  if (check.type === 'output_line_count_at_least') {
    return countOutputLines(output) >= Number(check.value)
  }

  if (check.type === 'code') {
    if (check.operator === 'contains') return matchesContainValue(context.code ?? '', check.value, normalizeCode)
    if (check.operator === 'not_contains') return !wildcardContains(normalizeCode(context.code ?? ''), normalizeCode(check.value))
    if (check.operator === 'equals') return wildcardEquals(normalizeCode(context.code ?? ''), normalizeCode(check.value))
    if (check.operator === 'not_equals') return !wildcardEquals(normalizeCode(context.code ?? ''), normalizeCode(check.value))
    if (check.operator === 'matches_regex') return matchesRegex(normalizeCode(context.code ?? '', true), check.value, check.flags)
    if (check.operator === 'not_matches_regex') return !matchesRegex(normalizeCode(context.code ?? '', true), check.value, check.flags)
  }

  return false
}

export function evaluateCheck(check, output, context = {}) {
  const checks = normalizeChecks(check)
  if (checks.length === 0) return false
  return checks.every(c => evaluateSingleCheck(c, output, context))
}

export function evaluateCheckResults(check, output, context = {}) {
  return normalizeChecks(check).map(c => ({
    ...c,
    passed: evaluateSingleCheck(c, output, context),
  }))
}

export function evaluateFeedbackCheckResults(taskOrChecks, output, context = {}, options = {}) {
  const timing = normalizeFeedbackShow(options.feedbackTiming ?? options.timing)
  return normalizeFeedbackChecks(taskOrChecks).filter(c => feedbackCheckMatchesTiming(c, timing)).map(c => ({
    ...c,
    passed: evaluateSingleCheck(c, output, context),
  }))
}

export function buildCheckFeedbackResult(task, completionPassed, feedbackResults, output, context = {}) {
  const blockingMatch = feedbackResults.find(result => result.passed && (result.mode ?? 'blocking') === 'blocking')
  const matchedFeedbackHint = feedbackResults.find(result => result.passed && String(result.hint ?? '').trim())
  const nudgeMatch = feedbackResults.find(result => result.passed && result.mode === 'nudge' && String(result.hint ?? '').trim())
  const passed = completionPassed && !blockingMatch
  const suggestion = blockingMatch
    ? (String(blockingMatch.hint ?? '').trim() || 'Not quite.')
    : completionPassed
      ? (nudgeMatch ? String(nudgeMatch.hint).trim() : '')
      : (matchedFeedbackHint ? String(matchedFeedbackHint.hint).trim() : getFirstFailedCheckHint(task?.check, output, context))

  return {
    passed,
    completionPassed,
    feedbackResults,
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

export function evaluateCheckWithCustomFeedback(task, completionPassed, isFeedbackCheckPassed, output = '', context = {}, options = {}) {
  const timing = normalizeFeedbackShow(options.feedbackTiming ?? options.timing)
  const feedbackResults = normalizeFeedbackChecks(task)
    .filter(c => feedbackCheckMatchesTiming(c, timing))
    .map(c => ({
      ...c,
      passed: isFeedbackCheckPassed(c),
    }))
  return buildCheckFeedbackResult(task, completionPassed, feedbackResults, output, context)
}

export function getFirstFailedCheckHint(check, output, context = {}) {
  const failed = evaluateCheckResults(check, output, context)
    .find(result => !result.passed && String(result.hint ?? '').trim())
  return failed ? String(failed.hint).trim() : ''
}

// Returns the hint from the first incorrect check that passes (i.e. detects a specific mistake).
// Call this when the completion check has failed to get a targeted hint.
export function getIncorrectCheckHint(incorrectChecks, output, context = {}) {
  const checks = normalizeFeedbackChecks(incorrectChecks)
  const matched = checks.find(c => evaluateSingleCheck(c, output, context) && String(c.hint ?? '').trim())
  return matched ? String(matched.hint).trim() : ''
}

// Evaluates only code-based checks (no run required). Safe to call without executing the code.
export function evaluateCheckWithCode(check, code) {
  const checks = normalizeChecks(check)
  if (checks.length === 0) return false
  if (!checks.every(c => checkAllowedForSubmit(c) || ELECTRONICS_CHECK_TYPES.includes(c.type))) return false
  return checks.every(c => evaluateSingleCheck(c, '', { code }))
}
