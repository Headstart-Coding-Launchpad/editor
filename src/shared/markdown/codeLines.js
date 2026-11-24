// Numbered code blocks with marked lines (docs/authoring/markdown-renderer.md, "Line numbers and
// marked lines"): ```python {lines=3}, {lines=1,4-5} or {numbered}. Pure: markdown.jsx draws
// them (MarkdownPre), lesson validation warns about bad ones. No `{…}`: a plain block.
import { eachFence } from './exampleFence.js'

const LINES_OPTION = /^lines=(\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*)$/

/** A fence's `{…}` attribute as `{ numbered, marks, unknown }`; null when it has none. */
export function parseCodeLinesMeta(meta) {
  const body = String(meta ?? '').match(/^\s*\{(.*)\}\s*$/s)?.[1]
  if (body == null) return null
  const result = { numbered: false, marks: [], unknown: [] }
  for (const word of body.split(/\s+/).filter(Boolean)) {
    const lines = word.match(LINES_OPTION)
    if (word === 'numbered' || lines) result.numbered = true
    else result.unknown.push(word)
    for (const [a, b = a] of lines?.[1].split(',').map((r) => r.split('-').map(Number)) ?? [])
      for (let n = Math.min(a, b); n <= Math.min(Math.max(a, b), a + 500); n++) result.marks.push(n)
  }
  result.marks = [...new Set(result.marks)].sort((x, y) => x - y)
  return result
}

/** `{ language, marks }` for a rendered `<code>` (className `language-python`, or
 * `language-{lines=2}` with no language) and its fence meta; null for a plain block. */
export function codeLinesForFence(className, meta) {
  const lang = String(className ?? '').match(/language-(\S+)/)?.[1] ?? ''
  const bare = lang.startsWith('{')
  const parsed = parseCodeLinesMeta(bare ? `${lang} ${meta ?? ''}` : meta)
  return parsed?.numbered ? { language: bare ? '' : lang, marks: parsed.marks } : null
}

/** Splits highlight.js HTML into one string per line, re-opening spans that cross a line. */
export function splitHighlightedLines(html) {
  const lines = []
  const open = []
  let line = ''
  for (const part of String(html).split(/(<span[^>]*>|<\/span>|\n)/)) {
    if (part === '\n') {
      lines.push(line + '</span>'.repeat(open.length))
      line = open.join('')
      continue
    }
    if (part.startsWith('<span')) open.push(part)
    else if (part === '</span>') open.pop()
    line += part
  }
  return [...lines, line]
}

/** The screen-reader words for a block's marks: "Line 3 is marked." */
export const markedLinesLabel = (marks) =>
  marks.length === 1
    ? `Line ${marks[0]} is marked.`
    : `Lines ${marks.slice(0, -1).join(', ')} and ${marks.at(-1)} are marked.`

/** Problems for lesson validation: `{ number, problem, detail }`, `number` counting every
 * top-level fence from 1, `problem` `unknown-option` or `out-of-range` (marks past the end). */
export function findCodeLineProblems(content) {
  const lines = String(content ?? '').split(/\r\n?|\n/)
  const problems = []
  ;[...eachFence(lines)].forEach(({ start, close, info }, index) => {
    const number = index + 1
    const meta = parseCodeLinesMeta(info.trim().replace(/^[^\s{]+/, ''))
    const size = close - start - 1
    const outside = meta?.marks.filter((n) => n < 1 || n > size) ?? []
    if (meta?.unknown.length)
      problems.push({ number, problem: 'unknown-option', detail: meta.unknown.join(' ') })
    const detail = `${outside.join(', ')} (the block has ${size} lines)`
    if (outside.length) problems.push({ number, problem: 'out-of-range', detail })
  })
  return problems
}
