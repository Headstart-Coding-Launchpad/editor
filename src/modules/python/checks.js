import {
  getVariableEntry,
  parseCheckValue,
  valueEquals,
  isPlainObject,
  normalizeTypeName,
  CODE_STRUCTURE_OPERATORS,
  evaluateCodeStructureCheck,
} from '../../shared/checkHelpers.js'

// Messages from validateCodeStructureCheck are documented in
// docs/authoring/validation-errors.md (validationErrorsDoc.test.js scans this file).

export const PYTHON_CHECK_TYPES = [
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

export function evaluatePythonCheck(check, output, context = {}) {
  if (check.type === 'variable_exists') {
    return getVariableEntry(context.variables, check.name)?.exists === true
  }

  if (check.value == null) return false

  if (check.type === 'variable_type') {
    const variable = getVariableEntry(context.variables, check.name)
    return variable.exists && normalizeTypeName(variable.type) === normalizeTypeName(check.value)
  }

  if (check.type === 'variable_equals') {
    const variable = getVariableEntry(context.variables, check.name)
    return variable.exists && valueEquals(variable.value, parseCheckValue(check.value))
  }

  if (check.type === 'variable_not_equals') {
    const variable = getVariableEntry(context.variables, check.name)
    return variable.exists && !valueEquals(variable.value, parseCheckValue(check.value))
  }

  if (check.type === 'variable_dict_contains') {
    const variable = getVariableEntry(context.variables, check.name)
    if (!variable.exists || !isPlainObject(variable.value)) return false
    const expected = parseCheckValue(check.value)
    return Object.values(variable.value).some((value) => valueEquals(value, expected))
  }

  if (check.type === 'variable_dict_equals') {
    const variable = getVariableEntry(context.variables, check.name)
    return (
      variable.exists &&
      isPlainObject(variable.value) &&
      valueEquals(variable.value, parseCheckValue(check.value))
    )
  }

  if (check.type === 'variable_dict_key_value') {
    const variable = getVariableEntry(context.variables, check.name)
    if (!variable.exists || !isPlainObject(variable.value) || check.key == null) return false
    return valueEquals(variable.value[String(check.key)], parseCheckValue(check.value))
  }

  if (check.type === 'variable_array_contains') {
    const variable = getVariableEntry(context.variables, check.name)
    if (!variable.exists || !Array.isArray(variable.value)) return false
    const expected = parseCheckValue(check.value)
    return variable.value.some((item) => valueEquals(item, expected))
  }

  if (check.type === 'variable_array_equals') {
    const variable = getVariableEntry(context.variables, check.name)
    return (
      variable.exists &&
      Array.isArray(variable.value) &&
      valueEquals(variable.value, parseCheckValue(check.value))
    )
  }

  if (check.type === 'variable_array_nth_item') {
    const variable = getVariableEntry(context.variables, check.name)
    if (!variable.exists || !Array.isArray(variable.value)) return false
    const index = Number(check.index)
    if (!Number.isInteger(index) || index < 0 || index >= variable.value.length) return false
    return valueEquals(variable.value[index], parseCheckValue(check.value))
  }

  return false
}

// Check-type registry definitions (see ../checkRegistry.js). Evaluated against the
// variables captured after a run (`context.variables`).
export const CHECKS = [
  ...PYTHON_CHECK_TYPES.map((type) => ({
    type,
    owner: 'module:python',
    timing: 'on_run',
    requiresRun: true,
    submitAllowed: false,
    contextKey: 'variables',
    evaluate: evaluatePythonCheck,
  })),
  {
    type: 'code_structure',
    owner: 'module:python',
    subject: 'Code structure (nesting)',
    operators: CODE_STRUCTURE_OPERATORS,
    fields: ['operator', 'inner', 'outer'],
    timing: 'on_change',
    requiresRun: false,
    submitAllowed: true,
    contextKey: 'code',
    evaluate: (check, _output, context = {}) => evaluateCodeStructureCheck(check, context?.code),
    validate: validateCodeStructureCheck,
  },
]

// `code_structure` reads Python indentation, so it only works in Python tasks (including
// code_arrange tasks hosted by Python). The operator is required — there is no default.
export function validateCodeStructureCheck(check, { n, kind, moduleDefinition } = {}) {
  const label = kind === 'feedback' ? 'feedback check' : 'check'
  const errors = []
  if (moduleDefinition && moduleDefinition.type !== 'python') {
    errors.push(
      `Task ${n} has a code_structure ${label}, but code_structure checks only work in Python tasks`
    )
  }
  if (!CODE_STRUCTURE_OPERATORS.includes(check.operator)) {
    errors.push(
      `Task ${n} has a code_structure ${label} with operator "${check.operator ?? ''}" — use one of: ${CODE_STRUCTURE_OPERATORS.join(', ')}`
    )
  }
  if (typeof check.inner !== 'string' || !check.inner.trim()) {
    errors.push(`Task ${n} has a code_structure ${label} but no inner line`)
  }
  if (typeof check.outer !== 'string' || !check.outer.trim()) {
    errors.push(`Task ${n} has a code_structure ${label} but no outer line`)
  }
  return errors
}
