// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

// Returns a list of problems ({ line, message }) found in a CSS source string.
// Comments and quoted strings are skipped; braces must balance and never go negative.
export function checkCssSyntax(css) {
  const problems = []
  let depth = 0
  let line = 1
  const open = [] // lines of unclosed '{'
  for (let i = 0; i < css.length; i++) {
    const ch = css[i]
    if (ch === '\n') line++
    else if (ch === '/' && css[i + 1] === '*') {
      const startLine = line
      const end = css.indexOf('*/', i + 2)
      if (end === -1) {
        problems.push({ line: startLine, message: 'unterminated comment' })
        return problems
      }
      for (let j = i; j < end; j++) if (css[j] === '\n') line++
      i = end + 1
    } else if (ch === '"' || ch === "'") {
      for (i++; i < css.length && css[i] !== ch && css[i] !== '\n'; i++) {
        if (css[i] === String.fromCharCode(92)) i++
      }
      if (css[i] === '\n') line++
    } else if (ch === '{') {
      depth++
      open.push(line)
    } else if (ch === '}') {
      depth--
      open.pop()
      if (depth < 0) {
        problems.push({ line, message: 'unmatched closing brace' })
        return problems
      }
    }
  }
  if (depth > 0) problems.push({ line: open[open.length - 1], message: 'unclosed brace' })
  return problems
}

function cssFiles(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...cssFiles(p))
    else if (name.endsWith('.css')) out.push(p)
  }
  return out
}

describe('checkCssSyntax', () => {
  it('accepts balanced CSS, ignoring braces in comments and strings', () => {
    const css = '/* { */ a::after { content: "}"; }\n@media (x) { b { c: d } }'
    expect(checkCssSyntax(css)).toEqual([])
  })
  it('reports an extra closing brace with its line', () => {
    expect(checkCssSyntax('a { b: c }\n}\nd { }')).toEqual([
      { line: 2, message: 'unmatched closing brace' },
    ])
  })
  it('reports an unclosed brace at the line it opened', () => {
    expect(checkCssSyntax('a { b: c }\nd {\n e: f')).toEqual([
      { line: 2, message: 'unclosed brace' },
    ])
  })
  it('reports an unterminated comment', () => {
    expect(checkCssSyntax('a { }\n/* never ends')).toEqual([
      { line: 2, message: 'unterminated comment' },
    ])
  })
})

describe('real CSS files', () => {
  const root = join(process.cwd(), 'src')
  for (const file of cssFiles(root)) {
    const name = relative(process.cwd(), file).split(sep).join('/')
    it(`${name} has balanced braces and closed comments`, () => {
      const problems = checkCssSyntax(readFileSync(file, 'utf8'))
      expect(problems.map((p) => `${name}:${p.line} ${p.message}`)).toEqual([])
    })
  }
})
