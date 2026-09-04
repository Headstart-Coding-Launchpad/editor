export function wildcardContains(text, pattern) {
  if (!pattern.includes('*')) return text.includes(pattern)
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[\\s\\S]*')
  return new RegExp(escaped).test(text)
}

export function wildcardEquals(text, pattern) {
  if (!pattern.includes('*')) return text === pattern
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[\\s\\S]*')
  return new RegExp(`^${escaped}$`).test(text)
}

export function matchesRegex(value, pattern, flags = '') {
  if (pattern == null) return false
  try {
    return new RegExp(String(pattern), String(flags ?? '')).test(String(value ?? ''))
  } catch {
    return false
  }
}

export function compareValues(actual, operator = 'equals', expected) {
  const a = Number(actual)
  const e = Number(expected)
  const numeric = !Number.isNaN(a) && !Number.isNaN(e)

  if (numeric) {
    if (operator === 'equals') return a === e
    if (operator === 'not_equals') return a !== e
    if (operator === 'greater_than') return a > e
    if (operator === 'greater_than_or_equal') return a >= e
    if (operator === 'less_than') return a < e
    if (operator === 'less_than_or_equal') return a <= e
  }

  if (operator === 'equals') return String(actual) === String(expected)
  if (operator === 'not_equals') return String(actual) !== String(expected)
  return false
}

export function normalizeOutput(value, caseSensitive = false) {
  const s = String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .trim()
  return caseSensitive ? s : s.toLowerCase()
}

export function normalizeExactOutput(value) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n+$/, '')
    .toLowerCase()
}

// Normalizes CSS property values for comparison: reduces url(...) to just the
// filename so that a teacher's check value like url('cat.png') matches a
// computed value like url("https://cdn.example.com/cat.png").
export function normalizeStyleValue(value) {
  return normalizeOutput(value).replace(
    /url\(\s*['"]?([^'")\s]+)['"]?\s*\)/g,
    (_, href) => `url(${href.split('/').pop()})`
  )
}

export function normalizeCode(value, caseSensitive = false) {
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

export function countOutputLines(value) {
  const output = String(value ?? '').replace(/\r\n?/g, '\n')
  if (!output) return 0
  return output.replace(/\n$/, '').split('\n').length
}

// Parses "option1","option2" format into an array. Returns null if not in that format.
export function parseMultipleContainOptions(value) {
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

export function matchesContainValue(rawValue, checkValue, normalizeFn) {
  const opts = parseMultipleContainOptions(checkValue)
  if (opts) {
    const actual = normalizeFn(rawValue)
    return opts.some((opt) => wildcardContains(actual, normalizeFn(opt)))
  }
  return wildcardContains(normalizeFn(rawValue), normalizeFn(checkValue))
}

export function parseCheckValue(value) {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed) return ''
  try {
    return JSON.parse(trimmed)
  } catch {}
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed)
  if (trimmed === 'True' || trimmed === 'False') return trimmed === 'True'
  if (trimmed === 'None') return null
  return value
}

export function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

export function deepEqual(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((item, index) => deepEqual(item, b[index]))
  }
  if (isPlainObject(a) || isPlainObject(b)) {
    if (!isPlainObject(a) || !isPlainObject(b)) return false
    const aKeys = Object.keys(a)
    const bKeys = Object.keys(b)
    if (aKeys.length !== bKeys.length) return false
    return aKeys.every(
      (key) => Object.prototype.hasOwnProperty.call(b, key) && deepEqual(a[key], b[key])
    )
  }
  return String(a) === String(b)
}

export function valueEquals(actual, expected) {
  if (
    Array.isArray(actual) ||
    Array.isArray(expected) ||
    isPlainObject(actual) ||
    isPlainObject(expected)
  )
    return deepEqual(actual, expected)
  return String(actual) === String(expected)
}

export function getElementText(el) {
  const INPUT_TAGS = ['INPUT', 'TEXTAREA', 'SELECT']
  return INPUT_TAGS.includes(el.tagName) ? el.value : (el.textContent ?? '')
}

export function parseVariableJson(json, fallback) {
  if (json == null) return fallback
  try {
    return JSON.parse(json)
  } catch {
    return fallback
  }
}

export function getVariableEntry(variables, name) {
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

// Source-text fragments entered without quotes should still match text inside a
// quoted string. `normalizeCode` deliberately preserves whitespace inside
// strings, so use a whitespace-free fallback only for unquoted fragments.
function codeContains(code, value) {
  const options = parseMultipleContainOptions(value)
  if (options) return options.some((option) => codeContainsFragment(code, option))
  return codeContainsFragment(code, value)
}

function codeContainsFragment(code, value) {
  if (wildcardContains(normalizeCode(code), normalizeCode(value))) return true
  if (/["'`]/.test(String(value ?? ''))) return false
  return wildcardContains(stripAllCodeWhitespace(code), stripAllCodeWhitespace(value))
}

function stripAllCodeWhitespace(value) {
  return String(value ?? '')
    .replace(/\s/g, '')
    .toLowerCase()
}

const CODE_CHECK_ALIAS_OPERATORS = {
  code_contains: 'contains',
  code_does_not_contain: 'not_contains',
  code_not_contains: 'not_contains',
  code_equals: 'equals',
  code_not_equals: 'not_equals',
  code_matches_regex: 'matches_regex',
  code_not_matches_regex: 'not_matches_regex',
}

// Shared "code"-family check evaluation (contains/equals/matches_regex + negated
// variants), reused by both `modules/checks.js` (Python/HTML/Arcade, via the
// `code` check type) and `modules/electronics/circuit.js` (MicroPython source
// extracted from the circuit's Micro Controller component). Accepts either the
// normalized `{ type: 'code', operator }` shape or the legacy `code_contains`
// style alias types directly, so callers that skip `normalizeCheckShape` still work.
export function evaluateCodeCheck(check, code) {
  if (!check || check.value == null) return false
  const operator = check.type === 'code' ? check.operator : CODE_CHECK_ALIAS_OPERATORS[check.type]
  if (!operator) return false
  const source = code ?? ''
  if (operator === 'contains') return codeContains(source, check.value)
  if (operator === 'not_contains') return !codeContains(source, check.value)
  if (operator === 'equals')
    return wildcardEquals(normalizeCode(source), normalizeCode(check.value))
  if (operator === 'not_equals')
    return !wildcardEquals(normalizeCode(source), normalizeCode(check.value))
  if (operator === 'matches_regex')
    return matchesRegex(normalizeCode(source, true), check.value, check.flags)
  if (operator === 'not_matches_regex')
    return !matchesRegex(normalizeCode(source, true), check.value, check.flags)
  return false
}

export function normalizeTypeName(type) {
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
