// TEST-ONLY frozen copy of the pre-registry check dispatcher from src/modules/checks.js
// (array-membership chain, before step 1.3 of the modular-activities plan). The parity
// suite runs every case through this and the registry-backed evaluateSingleCheck and
// asserts identical results. Delete together with checkRegistryParity.test.js once the
// registry has been in production for a release.
import { evaluateFsCheck, FS_CHECK_TYPES } from '../filesystem/checks.js'
import { evaluatePythonCheck, PYTHON_CHECK_TYPES } from '../python/checks.js'
import { evaluateHtmlCheck, HTML_CHECK_TYPES } from '../html/checks.js'
import { ELECTRONICS_CHECK_TYPES, evaluateElectronicsCheck } from '../electronics/circuit.js'
import { TURTLE_CHECK_TYPES, evaluateTurtleCheck } from '../turtle/checks.js'
import { DESKTOP_CHECK_TYPES, evaluateDesktopCheck } from '../desktop/checks.js'
import { normalizeCheckShape } from '../checks.js'
import {
  normalizeOutput,
  normalizeExactOutput,
  countOutputLines,
  compareValues,
  evaluateCodeCheck,
  compareText,
} from '../../shared/checkHelpers.js'

export const LEGACY_CODE_CHECK_TYPES = [
  'code',
  'code_contains',
  'code_does_not_contain',
  'code_not_contains',
  'code_equals',
  'code_not_equals',
  'code_matches_regex',
  'code_not_matches_regex',
]

export const LEGACY_RUN_REQUIRED = [
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
  'variable_not_equals',
  'variable_dict_contains',
  'variable_dict_equals',
  'variable_dict_key_value',
  'variable_array_contains',
  'variable_array_equals',
  'variable_array_nth_item',
]

export const LEGACY_SUBMIT_ALLOWED = LEGACY_CODE_CHECK_TYPES

export function legacyCheckRequiresRun(check) {
  const normalized = normalizeCheckShape(check)
  return LEGACY_RUN_REQUIRED.includes(normalized?.type)
}

export function legacyCheckAllowedForSubmit(check) {
  const normalized = normalizeCheckShape(check)
  // CORE_CHECK_DEFINITIONS[type].submitAllowed was only ever true for `code`.
  return LEGACY_SUBMIT_ALLOWED.includes(normalized?.type) || normalized?.type === 'code'
}

export function legacyEvaluateSingleCheck(check, output, context = {}) {
  check = normalizeCheckShape(check)
  if (!check?.type) return false

  if (FS_CHECK_TYPES.includes(check.type)) {
    return evaluateFsCheck(check, context.fs, context)
  }

  if (DESKTOP_CHECK_TYPES.includes(check.type)) {
    return evaluateDesktopCheck(check, context.desktop, context)
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

  if (TURTLE_CHECK_TYPES.includes(check.type)) {
    return evaluateTurtleCheck(check, context)
  }

  if (check.type === 'code' && context.circuit !== undefined) {
    return evaluateElectronicsCheck(check, context.circuit)
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
    const result = compareText(context.answer ?? output, check.operator, check.value, {
      normalizeEquals: normalizeExactOutput,
      flags: check.flags,
    })
    if (result !== null) return result
  }

  if (check.type === 'output') {
    const result = compareText(output, check.operator, check.value, {
      normalizeEquals: normalizeExactOutput,
      normalizeRegex: (value) => normalizeOutput(value, true),
      flags: check.flags,
    })
    if (result !== null) return result
  }

  if (check.type === 'output_line_count') {
    return compareValues(countOutputLines(output), check.operator ?? 'equals', check.value)
  }

  if (check.type === 'output_line_count_at_least') {
    return countOutputLines(output) >= Number(check.value)
  }

  if (check.type === 'code') {
    return evaluateCodeCheck(check, context.code)
  }

  return false
}
