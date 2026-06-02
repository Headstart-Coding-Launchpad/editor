import { evaluateFsCheck, FS_CHECK_TYPES } from './filesystem.js'

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
    return evaluateFsCheck(check, context.fs)
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

  if (check.type === 'element_exists') {
    if (!context.iframeDoc || !check.selector) return false
    try { return context.iframeDoc.querySelectorAll(check.selector).length > 0 } catch { return false }
  }

  if (check.type === 'variable_exists') {
    return getVariableEntry(context.variables, check.name)?.exists === true
  }

  if (check.type === 'element_attribute') {
    if (!context.iframeDoc || !check.selector || !check.attribute) return false
    try {
      const el = context.iframeDoc.querySelector(check.selector)
      if (!el || !el.hasAttribute(check.attribute)) return false
      if (check.value == null || check.value === '') return true
      return wildcardEquals(normalizeOutput(el.getAttribute(check.attribute) ?? ''), normalizeOutput(check.value))
    } catch { return false }
  }

  if (check.type === 'element_style_property') {
    if (!context.iframeDoc || !check.selector || !check.property) return false
    try {
      const el = context.iframeDoc.querySelector(check.selector)
      if (!el) return false
      const style = context.iframeDoc.defaultView?.getComputedStyle(el)
      const raw = style?.getPropertyValue(check.property) || el.style?.getPropertyValue(check.property) || ''
      if (check.value == null || check.value === '') return String(raw).trim().length > 0
      return wildcardEquals(normalizeStyleValue(raw), normalizeStyleValue(check.value))
    } catch { return false }
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

  if (check.type === 'element_count') {
    if (!context.iframeDoc || !check.selector) return false
    try { return context.iframeDoc.querySelectorAll(check.selector).length === Number(check.value) } catch { return false }
  }

  if (check.type === 'element_value') {
    if (!context.iframeDoc || !check.selector) return false
    try {
      const el = context.iframeDoc.querySelector(check.selector)
      if (!el) return false
      const raw = getElementText(el)
      const elemOptions = parseMultipleContainOptions(check.value)
      if (elemOptions) {
        const actual = normalizeOutput(raw)
        return elemOptions.some(opt => wildcardContains(actual, normalizeOutput(opt)))
      }
      return wildcardContains(normalizeOutput(raw), normalizeOutput(check.value))
    } catch { return false }
  }

  if (check.type === 'element_value_equals') {
    if (!context.iframeDoc || !check.selector) return false
    try {
      const el = context.iframeDoc.querySelector(check.selector)
      if (!el) return false
      return wildcardEquals(normalizeOutput(getElementText(el)), normalizeOutput(check.value))
    } catch { return false }
  }

  if (check.type === 'element_value_not_contains') {
    if (!context.iframeDoc || !check.selector) return false
    try {
      const el = context.iframeDoc.querySelector(check.selector)
      if (!el) return false
      return !wildcardContains(normalizeOutput(getElementText(el)), normalizeOutput(check.value))
    } catch { return false }
  }

  if (check.type === 'element_value_not_equals') {
    if (!context.iframeDoc || !check.selector) return false
    try {
      const el = context.iframeDoc.querySelector(check.selector)
      if (!el) return false
      return !wildcardEquals(normalizeOutput(getElementText(el)), normalizeOutput(check.value))
    } catch { return false }
  }

  if (check.type === 'element_value_matches_regex') {
    if (!context.iframeDoc || !check.selector) return false
    try {
      const el = context.iframeDoc.querySelector(check.selector)
      if (!el) return false
      return new RegExp(check.value).test(normalizeRegexOutput(getElementText(el)))
    } catch { return false }
  }

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

function getElementText(el) {
  const INPUT_TAGS = ['INPUT', 'TEXTAREA', 'SELECT']
  return INPUT_TAGS.includes(el.tagName) ? el.value : (el.textContent ?? '')
}

function getVariableEntry(variables, name) {
  if (!variables || !name || !Object.prototype.hasOwnProperty.call(variables, name)) {
    return { exists: false, value: undefined, type: '' }
  }
  const entry = variables[name]
  return {
    exists: true,
    value: parseVariableJson(entry?.json, entry?.repr),
    type: entry?.type ?? '',
  }
}

function parseVariableJson(json, fallback) {
  if (json == null) return fallback
  try { return JSON.parse(json) } catch { return fallback }
}

function parseCheckValue(value) {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed) return ''
  try { return JSON.parse(trimmed) } catch {}
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed)
  if (trimmed === 'True' || trimmed === 'False') return trimmed === 'True'
  if (trimmed === 'None') return null
  return value
}

function valueEquals(actual, expected) {
  if (Array.isArray(actual) || Array.isArray(expected) || isPlainObject(actual) || isPlainObject(expected)) return deepEqual(actual, expected)
  return String(actual) === String(expected)
}

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function deepEqual(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((item, index) => deepEqual(item, b[index]))
  }
  if (isPlainObject(a) || isPlainObject(b)) {
    if (!isPlainObject(a) || !isPlainObject(b)) return false
    const aKeys = Object.keys(a)
    const bKeys = Object.keys(b)
    if (aKeys.length !== bKeys.length) return false
    return aKeys.every(key => Object.prototype.hasOwnProperty.call(b, key) && deepEqual(a[key], b[key]))
  }
  return String(a) === String(b)
}

function normalizeTypeName(type) {
  const raw = normalizeOutput(type)
  const aliases = {
    str: 'string',
    string: 'string',
    int: 'number',
    float: 'number',
    number: 'number',
    bool: 'boolean',
    boolean: 'boolean',
    list: 'array',
    tuple: 'array',
    array: 'array',
    dict: 'dictionary',
    dictionary: 'dictionary',
  }
  return aliases[raw] ?? raw
}

// Parses "option1","option2" format into an array. Returns null if not in that format.
function parseMultipleContainOptions(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed.startsWith('"')) return null
  const options = []
  const regex = /"([^"]*)"/g
  let match
  while ((match = regex.exec(trimmed)) !== null) {
    options.push(match[1])
  }
  const stripped = trimmed.replace(/"[^"]*"/g, '').replace(/[\s,]/g, '')
  if (stripped !== '') return null
  return options.length > 0 ? options : null
}

function wildcardContains(text, pattern) {
  if (!pattern.includes('*')) return text.includes(pattern)
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[\\s\\S]*')
  return new RegExp(escaped).test(text)
}

function wildcardEquals(text, pattern) {
  if (!pattern.includes('*')) return text === pattern
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[\\s\\S]*')
  return new RegExp(`^${escaped}$`).test(text)
}

function normalizeOutput(value, caseSensitive = false) {
  const s = String(value ?? '').replace(/\r\n?/g, '\n').trim()
  return caseSensitive ? s : s.toLowerCase()
}

// Normalizes CSS property values for comparison: reduces url(...) to just the
// filename so that a teacher's check value like url('cat.png') matches a
// computed value like url("https://cdn.example.com/cat.png").
function normalizeStyleValue(value) {
  return normalizeOutput(value).replace(
    /url\(\s*['"]?([^'")\s]+)['"]?\s*\)/g,
    (_, href) => `url(${href.split('/').pop()})`,
  )
}

function normalizeExactOutput(value) {
  return String(value ?? '').replace(/\r\n?/g, '\n').replace(/\n+$/, '').toLowerCase()
}

function normalizeCode(value, caseSensitive = false) {
  const s = normalizeCodeWhitespace(value)
  return caseSensitive ? s : s.toLowerCase()
}

function normalizeCodeWhitespace(value) {
  const code = String(value ?? '').replace(/\r\n?/g, '\n')
  let normalized = ''
  let quote = null
  let escaped = false

  for (const character of code) {
    if (quote) {
      normalized += character
      if (escaped) {
        escaped = false
      } else if (character === '\\') {
        escaped = true
      } else if (character === quote) {
        quote = null
      }
    } else if (character === '"' || character === "'" || character === '`') {
      quote = character
      normalized += character
    } else if (!/\s/.test(character)) {
      normalized += character
    }
  }

  return normalized
}

function countOutputLines(value) {
  const output = String(value ?? '').replace(/\r\n?/g, '\n')
  if (!output) return 0
  return output.replace(/\n$/, '').split('\n').length
}
