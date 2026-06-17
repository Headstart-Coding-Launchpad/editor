import { evaluateFsCheck, FS_CHECK_TYPES } from './filesystem/checks.js'
import { evaluatePythonCheck, PYTHON_CHECK_TYPES } from './python/checks.js'
import { evaluateHtmlCheck, HTML_CHECK_TYPES } from './html/checks.js'
import {
  wildcardContains,
  wildcardEquals,
  normalizeOutput,
  normalizeExactOutput,
  normalizeCode,
  countOutputLines,
  parseMultipleContainOptions,
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

export const CHECK_TYPES = {
  RUN_REQUIRED: [
    'code_no_error',
    'output_contains',
    'output_equals',
    'output_not_contains',
    'output_not_equals',
    'output_matches_regex',
    'output_line_count',
    'output_not_empty',
    'output_empty',
    'element_exists',
    'element_count',
    'element_value',
    'element_value_equals',
    'element_value_not_contains',
    'element_value_not_equals',
    'element_value_matches_regex',
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
    'code_contains',
    'code_does_not_contain',
    'code_equals',
    'code_not_equals',
    'code_matches_regex',
  ],
  FS: FS_CHECK_TYPES,
}

export function checkRequiresRun(check) {
  return CHECK_TYPES.RUN_REQUIRED.includes(check?.type)
}

export function checkAllowedForSubmit(check) {
  return CHECK_TYPES.SUBMIT_ALLOWED.includes(check?.type)
}

export function filterChecksForInteraction(check, interactionMode) {
  const checks = normalizeChecks(check)
  if (interactionMode !== 'submit') return checks
  return checks.filter(checkAllowedForSubmit)
}

export function evaluateSingleCheck(check, output, context = {}) {
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

  if (check.type === 'answer_equals') {
    return wildcardEquals(normalizeExactOutput(context.answer ?? output), normalizeExactOutput(check.value))
  }

  if (check.type === 'answer_contains') {
    const answerOptions = parseMultipleContainOptions(check.value)
    if (answerOptions) {
      const actual = normalizeOutput(context.answer ?? output)
      return answerOptions.some(opt => wildcardContains(actual, normalizeOutput(opt)))
    }
    return wildcardContains(normalizeOutput(context.answer ?? output), normalizeOutput(check.value))
  }

  if (check.type === 'answer_not_contains') {
    return !wildcardContains(normalizeOutput(context.answer ?? output), normalizeOutput(check.value))
  }

  if (check.type === 'answer_matches_regex') {
    try { return new RegExp(check.value).test(String(context.answer ?? output)) } catch { return false }
  }

  if (check.type === 'output_equals') {
    return wildcardEquals(normalizeExactOutput(output), normalizeExactOutput(check.value))
  }

  if (check.type === 'output_not_equals') {
    return !wildcardEquals(normalizeExactOutput(output), normalizeExactOutput(check.value))
  }

  if (check.type === 'output_not_contains') {
    return !wildcardContains(normalizeOutput(output), normalizeOutput(check.value))
  }

  if (check.type === 'output_matches_regex') {
    try { return new RegExp(check.value).test(normalizeOutput(output, true)) } catch { return false }
  }

  if (check.type === 'output_line_count') {
    return countOutputLines(output) === Number(check.value)
  }

  if (check.type === 'code_contains') {
    const codeOptions = parseMultipleContainOptions(check.value)
    if (codeOptions) {
      const actual = normalizeCode(context.code ?? '')
      return codeOptions.some(opt => wildcardContains(actual, normalizeCode(opt)))
    }
    return wildcardContains(normalizeCode(context.code ?? ''), normalizeCode(check.value))
  }

  if (check.type === 'code_does_not_contain') {
    return !wildcardContains(normalizeCode(context.code ?? ''), normalizeCode(check.value))
  }

  if (check.type === 'code_equals') {
    return wildcardEquals(normalizeCode(context.code ?? ''), normalizeCode(check.value))
  }

  if (check.type === 'code_not_equals') {
    return !wildcardEquals(normalizeCode(context.code ?? ''), normalizeCode(check.value))
  }

  if (check.type === 'code_matches_regex') {
    try { return new RegExp(check.value).test(normalizeCode(context.code ?? '', true)) } catch { return false }
  }

  const outputOptions = parseMultipleContainOptions(check.value)
  if (outputOptions) {
    const actual = normalizeOutput(output)
    return outputOptions.some(opt => wildcardContains(actual, normalizeOutput(opt)))
  }
  return wildcardContains(normalizeOutput(output), normalizeOutput(check.value))
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

export function getFirstFailedCheckHint(check, output, context = {}) {
  const failed = evaluateCheckResults(check, output, context)
    .find(result => !result.passed && String(result.hint ?? '').trim())
  return failed ? String(failed.hint).trim() : ''
}

// Returns the hint from the first incorrect check that passes (i.e. detects a specific mistake).
// Call this when the completion check has failed to get a targeted hint.
export function getIncorrectCheckHint(incorrectChecks, output, context = {}) {
  const checks = normalizeChecks(incorrectChecks)
  const matched = checks.find(c => evaluateSingleCheck(c, output, context) && String(c.hint ?? '').trim())
  return matched ? String(matched.hint).trim() : ''
}

// Evaluates only code-based checks (no run required). Safe to call without executing the code.
export function evaluateCheckWithCode(check, code) {
  const checks = normalizeChecks(check)
  if (checks.length === 0) return false
  if (!checks.every(checkAllowedForSubmit)) return false
  return checks.every(c => evaluateSingleCheck(c, '', { code }))
}
