// Number, colour and True / False literals the code editor can scrub (a task's `scrub` field; see
// ./scrubExtension.js). Pure and Node-safe: finding literals on a line, stepping and clamping
// numbers, and writing a picked colour back in the literal's own style.
//
// A line is read on its own (plus whether it sits inside an HTML <style> block), so a literal
// never spans lines. What counts as a literal depends on the editor syntax:
// - python: number literals in code (not in identifiers, strings or comments; a unary minus is
//   part of the number), the keywords True and False in code (a click flips them; not in
//   names like is_true, strings or comments), and colour strings ("red", '#ff0000': the text
//   inside the quotes).
// - markup (HTML): CSS declaration values inside <style> blocks and style="…" attributes
//   (`margin: 20px`, `color: red`), and attribute values that are a whole number (+ unit) or a
//   colour (`width="200"`, `fill="#f00"`). Text content is never scrubbed.
// - css: declaration values (`margin: 20px`, `color: red`).
import { CSS_COLOURS, parseColour } from '../stage/colours.js'

// Editor language → scrub syntax. Languages not listed (javascript) are not scrubbed.
const SYNTAX_BY_LANGUAGE = Object.freeze({ python: 'python', html: 'markup', css: 'css' })

export function scrubSyntaxFor(language) {
  return Object.hasOwn(SYNTAX_BY_LANGUAGE, language ?? '') ? SYNTAX_BY_LANGUAGE[language] : null
}

// CSS length / angle / time units kept after a scrubbed number.
const CSS_UNITS = [
  'px',
  'em',
  'rem',
  '%',
  'vh',
  'vw',
  'vmin',
  'vmax',
  'deg',
  'turn',
  'rad',
  'ms',
  's',
  'pt',
  'fr',
  'ch',
  'ex',
]
const UNIT_PATTERN = `(?:${CSS_UNITS.map((unit) => unit.replace('%', '\\%')).join('|')})`

// Python words after which a `-` is a sign, not a subtraction (`return -5`).
const PY_SIGN_KEYWORDS = new Set([
  'return',
  'in',
  'and',
  'or',
  'not',
  'if',
  'elif',
  'else',
  'while',
  'lambda',
  'yield',
  'is',
  'assert',
])

// Attributes whose values are never colours or numbers to scrub (links, ids, classes).
const NON_VALUE_ATTRIBUTES = new Set(['href', 'src', 'action', 'id', 'class', 'for', 'name'])

const isWordChar = (ch) => !!ch && /[\w]/.test(ch)

/** A colour string as `{ hex, style: 'name' | 'hex', upper, short }`, or null. */
export function readColourText(text) {
  const raw = String(text ?? '')
  if (!raw || raw !== raw.trim()) return null
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) {
    const digits = raw.slice(1)
    return {
      hex: parseColour(raw),
      style: 'hex',
      upper: /[A-F]/.test(digits) && !/[a-f]/.test(digits),
      short: digits.length === 3,
    }
  }
  const lower = raw.toLowerCase()
  if (!Object.hasOwn(CSS_COLOURS, lower)) return null
  return { hex: CSS_COLOURS[lower], style: 'name', upper: false, short: false }
}

function numberLiteral(from, raw, unit = '') {
  const value = Number(raw)
  if (!Number.isFinite(value)) return null
  const dot = raw.indexOf('.')
  return {
    kind: 'number',
    from,
    to: from + raw.length + unit.length,
    text: raw + unit,
    value,
    decimals: dot === -1 ? 0 : raw.length - dot - 1,
    unit,
  }
}

function colourLiteral(from, text) {
  const colour = readColourText(text)
  if (!colour) return null
  return { kind: 'colour', from, to: from + text.length, text, ...colour }
}

// ── Python ──────────────────────────────────────────────────────────────────────────────────

// The line split into code, string and comment segments. A string's segment covers its
// contents (without quotes); triple-quoted strings are read as far as this line goes.
export function pythonSegments(line) {
  const segments = []
  let codeStart = 0
  let i = 0
  while (i < line.length) {
    const ch = line[i]
    if (ch === '#') {
      if (i > codeStart) segments.push({ kind: 'code', from: codeStart, to: i })
      segments.push({ kind: 'comment', from: i, to: line.length })
      return segments
    }
    if (ch === '"' || ch === "'") {
      if (i > codeStart) segments.push({ kind: 'code', from: codeStart, to: i })
      const quote = line.startsWith(ch.repeat(3), i) ? ch.repeat(3) : ch
      const start = i + quote.length
      let j = start
      while (j < line.length && !line.startsWith(quote, j)) j += line[j] === '\\' ? 2 : 1
      const end = Math.min(j, line.length)
      segments.push({ kind: 'string', from: start, to: end })
      i = end + quote.length
      codeStart = i
      continue
    }
    i += 1
  }
  if (codeStart < line.length) segments.push({ kind: 'code', from: codeStart, to: line.length })
  return segments
}

function pythonSignAllowed(line, minusAt) {
  let k = minusAt - 1
  while (k >= 0 && /\s/.test(line[k])) k -= 1
  if (k < 0) return true
  const ch = line[k]
  if (/[)\]}'"]/.test(ch)) return false
  if (isWordChar(ch)) {
    let start = k
    while (start > 0 && isWordChar(line[start - 1])) start -= 1
    return PY_SIGN_KEYWORDS.has(line.slice(start, k + 1))
  }
  return true
}

function pythonNumbers(line, from, to, out) {
  const pattern = /\d+\.\d+|\d+|\.\d+/g
  pattern.lastIndex = from
  let match
  while ((match = pattern.exec(line)) && match.index < to) {
    const start = match.index
    const end = start + match[0].length
    if (end > to) break
    if (isWordChar(line[start - 1]) || line[start - 1] === '.') continue
    if (isWordChar(line[end]) || line[end] === '.') continue
    let litStart = start
    if (line[start - 1] === '-' && start - 1 >= from && pythonSignAllowed(line, start - 1)) {
      litStart = start - 1
    }
    const literal = numberLiteral(litStart, line.slice(litStart, end))
    if (literal) out.push(withStageRange(line, literal))
  }
}

// The name of the call whose brackets hold column `at` on the line (`hue` in `hue(i * 9)`), or
// null when it isn't inside one.
function enclosingCallName(line, at) {
  let depth = 0
  for (let k = at - 1; k >= 0; k--) {
    const ch = line[k]
    if (ch === ')') depth += 1
    else if (ch === '(') {
      if (depth === 0) {
        const name = line.slice(0, k).match(/([A-Za-z_][\w.]*)\s*$/)
        return name ? name[1].split('.').pop() : null
      }
      depth -= 1
    }
  }
  return null
}

// Python Stage values with a natural range (docs/authoring/python.md "Stage"): a turn in
// degrees, an opacity, a hue() number and its light=.
const STAGE_KEYWORD_RANGES = {
  angle: { min: 0, max: 360 },
  opacity: { min: 0, max: 1 },
  light: { min: 0, max: 100 },
}

/**
 * A Python number literal with its Stage range (`range`) when it is the value of angle=,
 * opacity= or light=, or a number inside hue() or rgb(); the literal as it was otherwise. A whole-number
 * opacity (0 or 1) scrubs in tenths.
 */
function withStageRange(line, literal) {
  const keyword = line.slice(0, literal.from).match(/\b(angle|opacity|light)\s*=\s*$/)
  let range = keyword ? STAGE_KEYWORD_RANGES[keyword[1]] : null
  if (!range && enclosingCallName(line, literal.from) === 'hue') range = { min: 0, max: 360 }
  // Image Lab's rgb(r, g, b): each number is 0 to 255.
  if (!range && enclosingCallName(line, literal.from) === 'rgb') range = { min: 0, max: 255 }
  if (!range) return literal
  if (keyword?.[1] === 'opacity' && literal.decimals === 0) {
    return { ...literal, range, decimals: 1 }
  }
  return { ...literal, range }
}

// True and False in a code segment, as whole words (not part of a name or an attribute).
function pythonBooleans(line, from, to, out) {
  const pattern = /\b(True|False)\b/g
  const code = line.slice(from, to)
  let match
  while ((match = pattern.exec(code))) {
    const start = from + match.index
    if (line[start - 1] === '.') continue
    out.push(booleanLiteral(start, match[1], line))
  }
}

// `is_tall_enough = True` → 'is_tall_enough': the name a flag is assigned to, for its label.
function assignedName(line, at) {
  const match = line.slice(0, at).match(/([A-Za-z_]\w*)\s*=\s*$/)
  return match ? match[1] : null
}

function booleanLiteral(from, text, line) {
  return {
    kind: 'boolean',
    from,
    to: from + text.length,
    text,
    value: text === 'True',
    name: assignedName(line, from),
  }
}

/** The other Python boolean keyword: 'True' ↔ 'False'. */
export function flippedBoolean(text) {
  return text === 'True' ? 'False' : 'True'
}

function pythonLiterals(line) {
  const out = []
  for (const segment of pythonSegments(line)) {
    if (segment.kind === 'code') {
      pythonNumbers(line, segment.from, segment.to, out)
      pythonBooleans(line, segment.from, segment.to, out)
    } else if (segment.kind === 'string') {
      const literal = colourLiteral(segment.from, line.slice(segment.from, segment.to))
      if (literal) out.push(literal)
    }
  }
  return out
}

// ── CSS values ──────────────────────────────────────────────────────────────────────────────

// Literals in one CSS declaration value (`20px solid red`), offset to the line.
function cssValueLiterals(line, from, to, out) {
  const value = line.slice(from, to)
  const taken = []
  const hexPattern = /#[0-9a-f]{3}(?:[0-9a-f]{3})?(?![0-9a-z])/gi
  let match
  while ((match = hexPattern.exec(value))) {
    const literal = colourLiteral(from + match.index, match[0])
    if (literal) {
      out.push(literal)
      taken.push([match.index, match.index + match[0].length])
    }
  }
  const inTaken = (index) => taken.some(([a, b]) => index >= a && index < b)
  const numberPattern = new RegExp(`-?(?:\\d+\\.\\d+|\\d+|\\.\\d+)(${UNIT_PATTERN})?`, 'g')
  while ((match = numberPattern.exec(value))) {
    const start = match.index
    const end = start + match[0].length
    if (inTaken(start)) continue
    const before = value[start - 1]
    if (isWordChar(before) || before === '.' || before === '#' || before === '-') continue
    if (isWordChar(value[end]) || value[end] === '.') continue
    const unit = match[1] ?? ''
    const literal = numberLiteral(
      from + start,
      match[0].slice(0, match[0].length - unit.length),
      unit
    )
    if (literal) out.push(literal)
  }
  const wordPattern = /[a-z]+/gi
  while ((match = wordPattern.exec(value))) {
    const start = match.index
    const end = start + match[0].length
    if (inTaken(start)) continue
    if (/[\w#-]/.test(value[start - 1] ?? '') || /[\w-]/.test(value[end] ?? '')) continue
    const literal = colourLiteral(from + start, match[0])
    if (literal) out.push(literal)
  }
}

// Every declaration in a stretch of CSS (`a: 1px; b: red`), from `from` to `to` on the line.
function cssDeclarations(line, from, to, out) {
  const pattern = /([a-z-]+)\s*:([^;{}]*)/gi
  const text = line.slice(from, to)
  let match
  while ((match = pattern.exec(text))) {
    const valueFrom = from + match.index + match[0].length - match[2].length
    // `a:hover {` is a selector, not a declaration: the value runs into `{`.
    if (text[match.index + match[0].length] === '{') continue
    cssValueLiterals(line, valueFrom, valueFrom + match[2].length, out)
  }
}

function cssLiterals(line) {
  const out = []
  // A comment-free view of the line: /* … */ is blanked so nothing inside it is scrubbed.
  const blanked = line.replace(/\/\*.*?(\*\/|$)/g, (m) => ' '.repeat(m.length))
  cssDeclarations(blanked, 0, blanked.length, out)
  return out.map((literal) => ({ ...literal, text: line.slice(literal.from, literal.to) }))
}

// ── HTML ────────────────────────────────────────────────────────────────────────────────────

function attributeValueLiterals(line, name, from, to, out) {
  const lower = name.toLowerCase()
  if (lower === 'style') {
    cssDeclarations(line, from, to, out)
    return
  }
  if (NON_VALUE_ATTRIBUTES.has(lower) || lower.startsWith('on')) return
  const value = line.slice(from, to)
  const colour = colourLiteral(from, value)
  if (colour) {
    out.push(colour)
    return
  }
  const whole = value.match(new RegExp(`^(-?(?:\\d+\\.\\d+|\\d+|\\.\\d+))(${UNIT_PATTERN})?$`))
  if (whole) {
    const literal = numberLiteral(from, whole[1], whole[2] ?? '')
    if (literal) out.push(literal)
  }
}

function markupLiterals(line, { inStyle = false } = {}) {
  const out = []
  let style = inStyle
  let i = 0
  let textStart = 0
  const flushText = (end) => {
    if (style && end > textStart) cssDeclarations(line, textStart, end, out)
  }
  while (i < line.length) {
    if (line[i] !== '<') {
      i += 1
      continue
    }
    flushText(i)
    const close = line.indexOf('>', i)
    const tagEnd = close === -1 ? line.length : close
    const tag = line.slice(i, tagEnd)
    const nameMatch = tag.match(/^<\/?\s*([a-z][\w-]*)/i)
    const tagName = nameMatch ? nameMatch[1].toLowerCase() : ''
    const closing = /^<\s*\//.test(tag)
    // Attributes: name="value", name='value' or name=value.
    const attrPattern = /([^\s"'<>/=]+)\s*=\s*("([^"]*)"?|'([^']*)'?|([^\s"'>]+))/g
    attrPattern.lastIndex = nameMatch ? nameMatch[0].length : 1
    let attr
    while ((attr = attrPattern.exec(tag))) {
      const raw = attr[3] ?? attr[4] ?? attr[5] ?? ''
      const quoted = attr[3] != null || attr[4] != null
      const valueFrom = i + attr.index + attr[0].length - attr[2].length + (quoted ? 1 : 0)
      attributeValueLiterals(line, attr[1], valueFrom, valueFrom + raw.length, out)
    }
    if (tagName === 'style') style = !closing
    i = tagEnd + 1
    textStart = i
  }
  flushText(line.length)
  return out
}

/**
 * Every scrubbable literal on one line, sorted by position: numbers `{ kind: 'number', from, to,
 * text, value, decimals, unit }`, colours `{ kind: 'colour', from, to, text, hex, style,
 * upper, short }` and (python) booleans `{ kind: 'boolean', from, to, text, value, name }` (name:
 * the variable it is assigned to, or null). from / to are offsets in the line. `inStyle` (markup only) is whether the
 * line starts inside a <style> block.
 */
export function findScrubLiterals(line, syntax, { inStyle = false } = {}) {
  const text = String(line ?? '')
  let found
  if (syntax === SYNTAX_BY_LANGUAGE.python) found = pythonLiterals(text)
  else if (syntax === SYNTAX_BY_LANGUAGE.css) found = cssLiterals(text)
  else if (syntax === SYNTAX_BY_LANGUAGE.html) found = markupLiterals(text, { inStyle })
  else return []
  return found.sort((a, b) => a.from - b.from)
}

/** The literal at column `col` of the line (its start up to and including its end), or null. */
export function literalAtColumn(literals, col) {
  return literals.find((literal) => col >= literal.from && col <= literal.to) ?? null
}

/** Whether a markup document position follows an unclosed <style> tag (`textBefore` is the
 * document up to the line). */
export function startsInsideStyle(textBefore) {
  const lower = String(textBefore ?? '').toLowerCase()
  const open = lower.lastIndexOf('<style')
  return open !== -1 && open > lower.lastIndexOf('</style')
}

// ── Numbers ─────────────────────────────────────────────────────────────────────────────────

/** The scrub step for a number: 1 for whole numbers, else its last decimal place (0.1, 0.05 → 0.01). */
export function numberStep(literal) {
  const decimals = Math.max(0, literal?.decimals ?? 0)
  return decimals === 0 ? 1 : Number((10 ** -decimals).toFixed(decimals))
}

/** A scrubbed value written with the literal's decimals and unit ('-0' is written '0'). */
export function formatScrubNumber(value, literal) {
  const decimals = Math.max(0, literal?.decimals ?? 0)
  let text = Number(value).toFixed(decimals)
  if (/^-0(\.0+)?$/.test(text)) text = text.slice(1)
  return text + (literal?.unit ?? '')
}

/**
 * The range a number scrubs over when the task gives none: the literal's own `range` when it has
 * one (a Stage angle=, opacity=, light= or hue() number; widened to take in the value), else
 * from 0 to twice the value (at least 100 for whole numbers, 1 for decimals); a negative value
 * scrubs over the same span either side of 0.
 */
export function defaultScrubRange(literal) {
  const value = Number(literal?.value ?? 0)
  if (literal?.range) {
    return { min: Math.min(literal.range.min, value), max: Math.max(literal.range.max, value) }
  }
  const floor = (literal?.decimals ?? 0) > 0 ? 1 : 100
  const span = Math.max(Math.abs(value) * 2, floor)
  return value < 0 ? { min: -span, max: span } : { min: 0, max: span }
}

/**
 * The range for a literal on (1-based) `line`: the task's range for that line when it has one
 * (widened to take in a current value outside it, so grabbing a number never jumps it), else
 * defaultScrubRange.
 */
export function scrubRangeFor(literal, line, ranges = []) {
  const authored = (ranges ?? []).find((range) => range.line === line)
  if (!authored) return defaultScrubRange(literal)
  const value = Number(literal?.value ?? 0)
  return { min: Math.min(authored.min, value), max: Math.max(authored.max, value) }
}

/** `value` rounded to the step and clamped into the range. */
export function clampScrubValue(value, range, step) {
  const decimals = step >= 1 ? 0 : Math.round(-Math.log10(step))
  const stepped = Math.round(Number(value) / step) * step
  const clamped = Math.min(Math.max(stepped, range.min), range.max)
  return Number(clamped.toFixed(decimals))
}

/** Pixels of horizontal drag that cover a whole scrub range. */
export const SCRUB_DRAG_PX = 300

/** The value after dragging `dx` pixels from `startValue` (a whole range per SCRUB_DRAG_PX). */
export function valueForDrag(startValue, dx, range, step) {
  const span = range.max - range.min
  // Never finer than one step per 2 px, so a short range still moves in visible steps.
  const perPx = Math.max(span / SCRUB_DRAG_PX, step / 2)
  return clampScrubValue(Number(startValue) + dx * perPx, range, step)
}

/** The next value for a keyboard nudge (`direction` +1 / -1) within the range. */
export function nudgeValue(value, direction, range, step) {
  return clampScrubValue(Number(value) + direction * step, range, step)
}

// ── Colours ─────────────────────────────────────────────────────────────────────────────────

// Okabe & Ito's palette, chosen to stay distinct for the common kinds of colour blindness.
// Offered first in the picker; their names are labels (only black is also a CSS name).
export const SCRUB_SAFE_COLOURS = Object.freeze([
  { label: 'Black', hex: '#000000', name: 'black' },
  { label: 'Orange', hex: '#e69f00', name: null },
  { label: 'Sky blue', hex: '#56b4e9', name: null },
  { label: 'Bluish green', hex: '#009e73', name: null },
  { label: 'Yellow', hex: '#f0e442', name: null },
  { label: 'Blue', hex: '#0072b2', name: null },
  { label: 'Vermilion', hex: '#d55e00', name: null },
  { label: 'Reddish purple', hex: '#cc79a7', name: null },
])

// The safe palette under its nearest CSS colour names (by RGB distance, kept distinct and
// readable), offered first when the picker writes names only (`scrub.colourNames`, the default).
export const SCRUB_SAFE_COLOUR_NAMES = Object.freeze(
  [
    'black',
    'orange',
    'cornflowerblue',
    'teal',
    'gold',
    'steelblue',
    'orangered',
    'palevioletred',
  ].map((name) => ({ label: name, hex: CSS_COLOURS[name], name }))
)

// Common CSS colour names, offered after the safe palette (written as names).
export const SCRUB_COMMON_COLOURS = Object.freeze(
  ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'brown', 'grey', 'white'].map(
    (name) => ({ label: name[0].toUpperCase() + name.slice(1), hex: CSS_COLOURS[name], name })
  )
)

// Every CSS colour name, one per colour (British 'grey', 'cyan' and 'magenta' over their
// aliases), greys first from dark to light, then round the colour wheel: the picker's
// "All colours" list (Ryan, 2026-10-22: offer all colours, not a selection).
const ALIAS_LOSERS = new Set(['aqua', 'fuchsia'])
function hueOrder(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const light = (max + min) / 2
  const chroma = max - min
  if (chroma < 0.08) return [0, 0, light]
  let hue
  if (max === r) hue = ((g - b) / chroma + 6) % 6
  else if (max === g) hue = (b - r) / chroma + 2
  else hue = (r - g) / chroma + 4
  return [1, Math.round(hue * 60) % 360, light]
}
export const SCRUB_ALL_COLOURS = Object.freeze(
  Object.entries(CSS_COLOURS)
    .filter(([name]) => !name.includes('gray') && !ALIAS_LOSERS.has(name))
    .map(([name, hex]) => ({ label: name, hex, name, order: hueOrder(hex) }))
    .sort((a, b) => a.order[0] - b.order[0] || a.order[1] - b.order[1] || a.order[2] - b.order[2])
    .map(({ label, hex, name }) => Object.freeze({ label, hex, name }))
)

/** A typed hex colour ('#abc', 'aabbcc') as '#rrggbb', or null. */
export function normaliseHexInput(text) {
  const raw = String(text ?? '').trim()
  const withHash = raw.startsWith('#') ? raw : `#${raw}`
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(withHash)) return null
  return parseColour(withHash)
}

function matchNameCase(name, original) {
  if (original && original === original.toUpperCase() && original !== original.toLowerCase()) {
    return name.toUpperCase()
  }
  if (original && original[0] === original[0].toUpperCase() && /[A-Z]/.test(original[0])) {
    return name[0].toUpperCase() + name.slice(1)
  }
  return name
}

/**
 * A picked colour (`{ hex, name }`) written in the literal's style: a name stays a name when the
 * pick has one (keeping the original's capitalisation), otherwise it is written as hex — in the
 * literal's case, and in 3-digit form when the literal was and the colour allows it.
 */
export function formatScrubColour(choice, literal, { namesOnly = false } = {}) {
  const hex = parseColour(choice?.hex ?? '') ?? '#000000'
  if (literal?.style === 'name' && choice?.name) return matchNameCase(choice.name, literal.text)
  // Names only (scrub.colourNames, the default): a named pick replaces a hex literal by name.
  if (namesOnly && choice?.name) return choice.name
  let digits = hex.slice(1)
  if (
    literal?.short &&
    digits[0] === digits[1] &&
    digits[2] === digits[3] &&
    digits[4] === digits[5]
  ) {
    digits = digits[0] + digits[2] + digits[4]
  }
  if (literal?.upper) digits = digits.toUpperCase()
  return `#${digits}`
}
