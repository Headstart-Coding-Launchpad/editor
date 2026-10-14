// "See example" fences (docs/authoring/markdown-renderer.md, "Worked examples"). Pure and
// Node-safe: MarkdownRenderer splits them out of the Markdown before rendering, and lesson
// validation (src/shared/lessonValidation.js) reports badly written ones.
//
//   ```example python label="See an example"
//   Here's the same Check → Do → Otherwise shape with different weather.
//   ---
//   weather = "sunny"
//   if weather == "rainy":
//       print("Grab your wellies!")
//   ```
//
// - The info string starts with `example`, then an optional language and an optional
//   `label="…"` (the button text, default "See an example").
// - The body's lines before the first line that is just `---` are the intro (Markdown); the
//   rest is the code. With no `---` line the whole body is code.
// - Only top-level fences count (not ones inside a list or blockquote). A fence inside another
//   fence (e.g. a ```` block showing the syntax) is left alone.

import { parseMarkdownTables } from './tableParser.js'

export const DEFAULT_EXAMPLE_LABEL = 'See an example'

// The languages an example's code can be shown in. `text` is plain, unhighlighted code.
export const EXAMPLE_LANGUAGES = Object.freeze(['python', 'html', 'css', 'js', 'scratch', 'text'])
const LANGUAGE_ALIASES = { javascript: 'js', py: 'python', plain: 'text', plaintext: 'text' }

// The most examples one Markdown text can log opens for (exampleOpenLog's index rule, 0-9).
export const MAX_LOGGED_EXAMPLES = 10

export const MAX_EXAMPLE_LABEL_LENGTH = 40

const FENCE_OPEN = /^( {0,3})(`{3,}|~{3,})(.*)$/
const LABEL_OPTION = /\blabel\s*=\s*(?:"([^"]*)"|'([^']*)')/

function isFenceClose(line, char, length) {
  const match = line.match(/^ {0,3}(`{3,}|~{3,})\s*$/)
  return !!match && match[1][0] === char && match[1].length >= length
}

function stripIndent(line, indent) {
  if (!indent) return line
  let i = 0
  while (i < indent && line[i] === ' ') i++
  return line.slice(i)
}

/** Whether a fence info string opens an example fence (its first word is `example`). */
export function isExampleInfo(info) {
  return (
    String(info ?? '')
      .trim()
      .split(/\s+/)[0]
      .toLowerCase() === 'example'
  )
}

/**
 * Reads an example fence's info string: `example [language] [label="…"]`. Returns
 * `{ language, label, unknownLanguage, extra }`: `language` is one of EXAMPLE_LANGUAGES
 * (`text` when none or unknown), `unknownLanguage` the unrecognised word if any, and `extra`
 * any further words that mean nothing.
 */
export function parseExampleInfo(info) {
  let rest = String(info ?? '')
    .trim()
    .replace(/^example\b/i, '')
  let label = DEFAULT_EXAMPLE_LABEL
  const labelMatch = rest.match(LABEL_OPTION)
  if (labelMatch) {
    const value = (labelMatch[1] ?? labelMatch[2] ?? '').trim()
    if (value) label = value.slice(0, MAX_EXAMPLE_LABEL_LENGTH)
    rest = rest.replace(LABEL_OPTION, ' ')
  }
  const words = rest.trim().split(/\s+/).filter(Boolean)
  const word = (words[0] ?? '').toLowerCase()
  const normalised = LANGUAGE_ALIASES[word] ?? word
  const known = !word || EXAMPLE_LANGUAGES.includes(normalised)
  return {
    language: word && known ? normalised : 'text',
    label,
    unknownLanguage: known ? null : words[0],
    extra: words.slice(1),
  }
}

/** Splits an example fence's body into `{ intro, code }` at its first `---` line. */
export function parseExampleBody(body) {
  const lines = String(body ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
  const divider = lines.findIndex((line) => line.trim() === '---')
  const introLines = divider >= 0 ? lines.slice(0, divider) : []
  const codeLines = divider >= 0 ? lines.slice(divider + 1) : lines
  // Blank lines around the code go; its indentation stays.
  while (codeLines.length && !codeLines[0].trim()) codeLines.shift()
  while (codeLines.length && !codeLines[codeLines.length - 1].trim()) codeLines.pop()
  return { intro: introLines.join('\n').trim(), code: codeLines.join('\n') }
}

/**
 * Splits Markdown into segments: `{ type: 'markdown', content }` and
 * `{ type: 'example', index, language, label, intro, code, closed, unknownLanguage, extra }`.
 * `index` counts the examples in the text from 0, in order (the exampleOpenLog key).
 */
export function splitExampleFences(content) {
  const lines = String(content ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
  const segments = []
  let markdown = []
  let index = 0
  const flush = () => {
    if (markdown.length) segments.push({ type: 'markdown', content: markdown.join('\n') })
    markdown = []
  }

  let i = 0
  while (i < lines.length) {
    const open = lines[i].match(FENCE_OPEN)
    // A backtick fence's info string can't hold a backtick (CommonMark), so that's inline code.
    if (!open || (open[2][0] === '`' && open[3].includes('`'))) {
      markdown.push(lines[i])
      i++
      continue
    }
    const [, indent, marker, info] = open
    let close = i + 1
    while (close < lines.length && !isFenceClose(lines[close], marker[0], marker.length)) close++
    const closed = close < lines.length
    const end = closed ? close + 1 : lines.length
    if (!isExampleInfo(info)) {
      markdown.push(...lines.slice(i, end))
      i = end
      continue
    }
    flush()
    const body = lines
      .slice(i + 1, close)
      .map((line) => stripIndent(line, indent.length))
      .join('\n')
    segments.push({
      type: 'example',
      index: index++,
      ...parseExampleInfo(info),
      ...parseExampleBody(body),
      closed,
    })
    i = end
  }
  flush()
  return segments
}

/** Whether the text has an example fence at all (cheap pre-check). */
export function hasExampleFence(content) {
  return /^ {0,3}(`{3,}|~{3,})\s*example\b/im.test(String(content ?? ''))
}

/**
 * The problems with a Markdown text's example fences, for lesson validation:
 * `{ number, problem, detail }` with `number` counting from 1 and `problem` one of
 * `empty` (no code), `unknown-language` (`detail` the word), `unknown-option` (`detail` the
 * words), `unclosed` (no closing fence) and `too-many` (more than MAX_LOGGED_EXAMPLES).
 */
export function findExampleFenceProblems(content) {
  if (!hasExampleFence(content)) return []
  const problems = []
  const examples = splitExampleFences(content).filter((segment) => segment.type === 'example')
  for (const example of examples) {
    const number = example.index + 1
    if (!example.closed) problems.push({ number, problem: 'unclosed' })
    if (!example.code.trim()) problems.push({ number, problem: 'empty' })
    if (example.unknownLanguage) {
      problems.push({ number, problem: 'unknown-language', detail: example.unknownLanguage })
    }
    if (example.extra.length) {
      problems.push({ number, problem: 'unknown-option', detail: example.extra.join(' ') })
    }
  }
  if (examples.length > MAX_LOGGED_EXAMPLES) {
    problems.push({ number: examples.length, problem: 'too-many' })
  }
  return problems
}

// The renderer's blocks: Markdown, tables (./tableParser.js) and "See example" fences
// (this file), in order. Around an example, blank-only Markdown is dropped.
export function parseMarkdownBlocks(content) {
  if (!hasExampleFence(content)) return parseMarkdownTables(content)
  return splitExampleFences(content)
    .flatMap((segment) =>
      segment.type === 'example' ? [segment] : parseMarkdownTables(segment.content)
    )
    .filter((block) => block.type !== 'markdown' || block.content.trim())
}
