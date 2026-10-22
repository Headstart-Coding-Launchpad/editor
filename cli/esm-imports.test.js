// The CLI runs on plain Node ESM, which needs the file extension on every relative import.
// Vite (and so vitest) resolves `'../fileKeys'` without one, so a bundler-only import in a
// shared module passes every other test and still breaks `lessons get` (handoff #102).
// This walks the CLI's static and dynamic import graph and checks each relative import
// names a file that exists exactly as written.
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const cliDir = dirname(fileURLToPath(import.meta.url))
const IMPORT_RE =
  /(?:^|[\s;])(?:import|export)\s[^'"]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|(?:^|[\s;])import\s*['"](\.{1,2}\/[^'"]+)['"]|import\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/gm

function relativeImports(file) {
  const source = readFileSync(file, 'utf8')
  const specs = []
  for (const match of source.matchAll(IMPORT_RE)) specs.push(match[1] || match[2] || match[3])
  return specs
}

function walk(entries) {
  const seen = new Set()
  const broken = []
  const queue = [...entries]
  while (queue.length) {
    const file = queue.pop()
    if (seen.has(file)) continue
    seen.add(file)
    for (const spec of relativeImports(file)) {
      const target = resolve(dirname(file), spec)
      if (!existsSync(target) || !statSync(target).isFile()) {
        broken.push(`${file.slice(cliDir.length - 3)} imports '${spec}'`)
        continue
      }
      if (/\.(m?js)$/.test(target)) queue.push(target)
    }
  }
  return { seen, broken }
}

describe('CLI imports resolve under plain Node ESM', () => {
  it('every relative import reachable from cli/*.mjs names an existing file', () => {
    const entries = readdirSync(cliDir)
      .filter((name) => name.endsWith('.mjs'))
      .map((name) => join(cliDir, name))
    const { seen, broken } = walk(entries)
    expect(seen.size).toBeGreaterThan(entries.length)
    expect(broken).toEqual([])
  })
})
