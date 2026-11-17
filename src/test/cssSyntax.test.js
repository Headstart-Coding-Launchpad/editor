// Guards against lost or extra braces in the app's CSS (a missing brace once reached main
// with CI and the build green, 8a597fde). Brace balance only; no new dependency.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function findCss(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) findCss(p, out)
    else if (name.endsWith('.css')) out.push(p)
  }
  return out
}

// Returns the first problem found, or null. Ignores comments, strings and url(...).
export function checkBraces(css) {
  let depth = 0
  let line = 1
  for (let i = 0; i < css.length; i++) {
    const c = css[i]
    if (c === '\n') line++
    else if (c === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2)
      if (end === -1) return `unterminated comment at line ${line}`
      line += css.slice(i, end).split('\n').length - 1
      i = end + 1
    } else if (c === '"' || c === "'") {
      let j = i + 1
      while (j < css.length && css[j] !== c && css[j] !== '\n') j += css[j] === '\\' ? 2 : 1
      i = j
    } else if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth < 0) return `extra "}" at line ${line}`
    }
  }
  return depth === 0 ? null : `${depth} unclosed "{" at end of file`
}

describe('CSS syntax', () => {
  it('detects bad braces', () => {
    expect(checkBraces('a { b: c; }')).toBeNull()
    expect(checkBraces('a { /* } */ content: "}"; }')).toBeNull()
    expect(checkBraces('a { b: c;')).toMatch(/unclosed/)
    expect(checkBraces('a { } }')).toMatch(/extra/)
  })

  for (const file of findCss('src')) {
    it(`${file} has balanced braces`, () => {
      expect(checkBraces(readFileSync(file, 'utf8'))).toBeNull()
    })
  }
})
