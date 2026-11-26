// Size ratchet: the biggest source files may only get smaller, never bigger.
// Counts per file: lines, eslint/ts suppression comments, inline style={{ uses.
// To lower the baseline after a cleanup: UPDATE_SIZE_RATCHET=1 npx vitest run src/shared/__tests__/sizeRatchet.test.js
// and commit sizeRatchet.baseline.json. Never raise a number to make this pass; split the file instead.
// Project total lines raised 24 Nov by Ryan for the code_lines quiz (+318: 213320 -> 213638,
// of which +52 are the code-review fixes).
// Raised 26 Nov 09:56 (Ryan OK) for the tutor highlight note rows and Pin (+88: 213668 -> 213756,
// after trimming 13 dead lines and compacting 5 in the files touched).
// Raised again 26 Nov (same Ryan OK) for the code-review fixes (+54: 213756 -> 213810, after
// shortening the module header by 9).
// And again 26 Nov (same Ryan OK) for the browser-pass fixes (+29: 213810 -> 213839).
// And for the tutor-side fixes (+24: 213839 -> 213863), same Ryan OK.
// And for Drop pin following the student's typing (+21: 213863 -> 213884), same Ryan OK.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const SRC = path.resolve(__dirname, '..', '..')
const BASELINE = path.join(__dirname, 'sizeRatchet.baseline.json')
const TOP = 10

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name !== '__tests__' && e.name !== 'test') walk(p, out)
    } else if (/\.(js|jsx|ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p)
  }
  return out
}

function measure(file) {
  const text = fs.readFileSync(file, 'utf8')
  return {
    lines: text.split('\n').length,
    suppressions: (text.match(/eslint-disable|@ts-ignore|@ts-expect-error|@ts-nocheck/g) || [])
      .length,
    inlineStyles: (text.match(/style=\{\{/g) || []).length,
  }
}

function snapshot() {
  const all = walk(SRC).map((f) => ({
    file: path.relative(SRC, f).split(path.sep).join('/'),
    ...measure(f),
  }))
  const totals = { lines: 0, suppressions: 0, inlineStyles: 0 }
  for (const m of all) for (const k of Object.keys(totals)) totals[k] += m[k]
  const files = {}
  ;[...all]
    .sort((a, b) => b.lines - a.lines)
    .slice(0, TOP)
    .forEach(({ file, ...m }) => (files[file] = m))
  return { files, totals, all }
}

describe('size ratchet', () => {
  const snap = snapshot()
  if (process.env.UPDATE_SIZE_RATCHET) {
    fs.writeFileSync(
      BASELINE,
      JSON.stringify({ files: snap.files, totals: snap.totals }, null, 2) + '\n'
    )
  }
  const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'))
  const byFile = Object.fromEntries(snap.all.map((m) => [m.file, m]))

  for (const [file, b] of Object.entries(base.files)) {
    it(`${file} does not grow`, () => {
      const now = byFile[file] || { lines: 0, suppressions: 0, inlineStyles: 0 }
      expect(now.lines).toBeLessThanOrEqual(b.lines)
      expect(now.suppressions).toBeLessThanOrEqual(b.suppressions)
      expect(now.inlineStyles).toBeLessThanOrEqual(b.inlineStyles)
    })
  }

  it('no other file grows past the smallest tracked file', () => {
    const limit = Math.min(...Object.values(base.files).map((f) => f.lines))
    const over = snap.all.filter((m) => !base.files[m.file] && m.lines > limit).map((m) => m.file)
    expect(over).toEqual([])
  })

  it('project totals do not grow', () => {
    for (const k of Object.keys(base.totals))
      expect(snap.totals[k]).toBeLessThanOrEqual(base.totals[k])
  })
})
