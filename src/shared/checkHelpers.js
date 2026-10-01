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

export function isValidRegex(pattern, flags = '') {
  if (pattern == null) return false
  try {
    new RegExp(String(pattern), String(flags ?? ''))
    return true
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

export function countOutputLines(value) {
  const output = String(value ?? '').replace(/\r\n?/g, '\n')
  if (!output) return 0
  return output.replace(/\n$/, '').split('\n').length
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

export function matchesContainValue(rawValue, checkValue, normalizeFn) {
  const opts = parseMultipleContainOptions(checkValue)
  if (opts) {
    const actual = normalizeFn(rawValue)
    return opts.some((opt) => wildcardContains(actual, normalizeFn(opt)))
  }
  return wildcardContains(normalizeFn(rawValue), normalizeFn(checkValue))
}

// The one definition of the text comparison operators used by checks, so every module
// means the same thing by them:
//   contains      any of the options is found (`"a","b"` lists), `*` matches anything
//   not_contains  none of the options is found
//   equals        whole value matches, `*` matches anything
//   not_equals    whole value doesn't match
//   matches_regex / not_matches_regex   JavaScript regex with optional `flags`
// Modules pass their own normalisers because "the same text" differs by subject: output
// ignores case and surrounding whitespace, CSS values reduce url(...) to a filename, and so
// on. `normalize` is used for contains; `normalizeEquals` (default: normalize) for equals;
// `normalizeRegex` (default: leave untouched) for the regex operators. Returns null for an
// operator this helper doesn't handle, so callers can fall through to their own.
export function compareText(actual, operator, expected, options = {}) {
  const normalize = options.normalize ?? normalizeOutput
  const normalizeEquals = options.normalizeEquals ?? normalize
  const normalizeRegex = options.normalizeRegex ?? ((value) => String(value ?? ''))
  switch (operator) {
    case 'contains':
      return matchesContainValue(actual, expected, normalize)
    case 'not_contains':
      return !matchesContainValue(actual, expected, normalize)
    case 'equals':
      return wildcardEquals(normalizeEquals(actual), normalizeEquals(expected))
    case 'not_equals':
      return !wildcardEquals(normalizeEquals(actual), normalizeEquals(expected))
    case 'matches_regex':
    case 'not_matches_regex': {
      // An invalid pattern is an authoring mistake: fail both operators rather than
      // letting "does not match" pass for every student.
      if (!isValidRegex(expected, options.flags)) return false
      const matched = matchesRegex(normalizeRegex(actual), expected, options.flags)
      return operator === 'matches_regex' ? matched : !matched
    }
    default:
      return null
  }
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

function parseVariableJson(json, fallback) {
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

// ── Python block structure (`code_structure` checks) ─────────────────────────
// normalizeCode drops all whitespace, so code checks can't see indentation. These helpers
// read Python's block nesting from indentation instead (no Pyodide, no full parser).

export const CODE_STRUCTURE_OPERATORS = ['nested_in', 'directly_nested_in', 'not_nested_in']

const PY_OPEN_BRACKETS = '([{'
const PY_CLOSE_BRACKETS = ')]}'

// Scans one physical line, carrying open brackets and triple-quoted strings over in `state`
// ({ depth, triple }). Returns the line's code with any trailing `#` comment removed, and
// whether it ends in a backslash line continuation.
function scanPythonLine(line, state) {
  let code = ''
  let quote = null
  let i = 0
  while (i < line.length) {
    const character = line[i]
    if (state.triple || quote) {
      if (character === '\\') {
        code += line.slice(i, i + 2)
        i += 2
        continue
      }
      if (state.triple && line.startsWith(state.triple, i)) {
        code += state.triple
        i += 3
        state.triple = null
        continue
      }
      if (quote && character === quote) quote = null
      code += character
      i += 1
      continue
    }
    if (character === '#') break
    const three = line.slice(i, i + 3)
    if (three === '"""' || three === "'''") {
      state.triple = three
      code += three
      i += 3
      continue
    }
    if (character === '"' || character === "'") quote = character
    else if (PY_OPEN_BRACKETS.includes(character)) state.depth += 1
    else if (PY_CLOSE_BRACKETS.includes(character)) state.depth = Math.max(0, state.depth - 1)
    code += character
    i += 1
  }
  const trimmed = code.trimEnd()
  const backslash = !state.triple && !quote && trimmed.endsWith('\\')
  return { code: backslash ? trimmed.slice(0, -1) : trimmed, backslash }
}

// The logical lines of a Python program with their indentation: [{ line, indent, text,
// opensBlock }]. `line` is the 1-based physical line the statement starts on; `indent` counts
// leading spaces with tabs expanded to 4; `text` is the statement without its trailing comment,
// with any continuation lines (open brackets, triple-quoted strings, backslashes) joined on.
// Blank and comment-only lines are skipped. `opensBlock` is true when the statement ends with
// `:` (if / elif / else / for / while / def / class / try / with ...).
export function parsePythonBlockLines(code) {
  const physical = String(code ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
  const state = { depth: 0, triple: null }
  const lines = []
  let current = null
  let continues = false
  physical.forEach((raw, index) => {
    const expanded = raw.replace(/\t/g, '    ')
    const startsInside = continues && current
    const { code: text, backslash } = scanPythonLine(expanded, state)
    if (startsInside) {
      const more = text.trim()
      if (more) current.text = `${current.text} ${more}`
    } else if (text.trim()) {
      current = {
        line: index + 1,
        indent: expanded.length - expanded.trimStart().length,
        text: text.trim(),
      }
      lines.push(current)
    } else {
      current = null
    }
    continues = state.depth > 0 || state.triple !== null || backslash
  })
  return lines.map((entry) => ({ ...entry, opensBlock: entry.text.endsWith(':') }))
}

// The block openers a logical line sits inside, nearest first: walking upward, each line with
// less indentation than any seen so far closes off a level, and counts when it ends with `:`.
export function pythonBlockAncestors(lines, index) {
  const ancestors = []
  let minIndent = lines[index]?.indent ?? 0
  for (let j = index - 1; j >= 0 && minIndent > 0; j -= 1) {
    if (lines[j].indent < minIndent) {
      if (lines[j].opensBlock) ancestors.push(lines[j])
      minIndent = lines[j].indent
    }
  }
  return ancestors
}

// A whole logical line against an authored line: whitespace-normalised and case-insensitive
// like the `code` equals check, with `*` wildcards.
function pythonLineMatches(line, pattern) {
  return wildcardEquals(normalizeCode(line.text), normalizeCode(pattern))
}

// `code_structure`: is a line (`inner`) inside a block opened by another line (`outer`)?
//   nested_in          — some inner line has outer as an enclosing block, at any depth
//   directly_nested_in — some inner line has outer as its nearest enclosing block
//   not_nested_in      — the inner line is present and no inner line is inside outer
// Every operator fails when no line matches `inner`.
export function evaluateCodeStructureCheck(check, code) {
  const { operator, inner, outer } = check ?? {}
  if (!CODE_STRUCTURE_OPERATORS.includes(operator)) return false
  if (typeof inner !== 'string' || !inner.trim()) return false
  if (typeof outer !== 'string' || !outer.trim()) return false
  const lines = parsePythonBlockLines(code)
  const innerIndexes = lines
    .map((line, index) => (pythonLineMatches(line, inner) ? index : -1))
    .filter((index) => index >= 0)
  if (innerIndexes.length === 0) return false
  const insideOuter = (index) =>
    pythonBlockAncestors(lines, index).some((ancestor) => pythonLineMatches(ancestor, outer))
  if (operator === 'nested_in') return innerIndexes.some(insideOuter)
  if (operator === 'not_nested_in') return !innerIndexes.some(insideOuter)
  return innerIndexes.some((index) => {
    const [nearest] = pythonBlockAncestors(lines, index)
    return !!nearest && pythonLineMatches(nearest, outer)
  })
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
