import {
  getVariableEntry,
  parseCheckValue,
  valueEquals,
  isPlainObject,
  normalizeTypeName,
} from '../../shared/checkHelpers.js'

export const PYTHON_CHECK_TYPES = [
  'variable_exists',
  'variable_type',
  'variable_equals',
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

  if (check.type === 'variable_dict_contains') {
    const variable = getVariableEntry(context.variables, check.name)
    if (!variable.exists || !isPlainObject(variable.value)) return false
    const expected = parseCheckValue(check.value)
    return Object.values(variable.value).some(value => valueEquals(value, expected))
  }

  if (check.type === 'variable_dict_equals') {
    const variable = getVariableEntry(context.variables, check.name)
    return variable.exists && isPlainObject(variable.value) && valueEquals(variable.value, parseCheckValue(check.value))
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
    return variable.value.some(item => valueEquals(item, expected))
  }

  if (check.type === 'variable_array_equals') {
    const variable = getVariableEntry(context.variables, check.name)
    return variable.exists && Array.isArray(variable.value) && valueEquals(variable.value, parseCheckValue(check.value))
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
