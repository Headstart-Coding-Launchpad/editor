import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import path from 'node:path'
import baseline from './typeBranchBaseline.json'

// Ratchet for lesson-type branching outside the plugin folders. Core code should ask the module
// registry (and later the activity registry) instead of comparing against type names, because
// every inline `lesson.type === 'turtle'` is a place a new module or activity can be forgotten.
// See docs/architecture/modular-activities-plan.md (Phase 0.5, ratchet to zero in Phase 4).
//
// The counts per file may only go down. When you remove branches, lower the baseline in the
// same PR: run `UPDATE_TYPE_BRANCH_BASELINE=1 npx vitest run typeBranchRatchet` and commit
// src/modules/__tests__/typeBranchBaseline.json. Never raise a count to get a PR green: route
// the behaviour through the registry instead.

const root = path.resolve(__dirname, '../../..')

const TYPE_NAMES = [
  'python',
  'turtle',
  'html',
  'scratch',
  'filesystem',
  'desktop',
  'electronics',
  'arcade',
  'quiz',
  'code_arrange',
]
const names = TYPE_NAMES.join('|')

// `x === 'python'`, `'python' !== x`, `case 'python':`, and array literals naming two or more
// types (inline allowlists such as `['python', 'html'].includes(type)`).
const COMPARISON = new RegExp(
  `[!=]==\\s*['"](?:${names})['"]|['"](?:${names})['"]\\s*[!=]==|case\\s+['"](?:${names})['"]\\s*:`,
  'g'
)
const TYPE_ARRAY = new RegExp(
  `\\[\\s*['"](?:${names})['"]\\s*(?:,\\s*['"][\\w-]+['"]\\s*)+,?\\s*\\]`,
  'g'
)

const SCANNED_DIRS = ['src', 'cli']
const EXCLUDED_DIRS = new Set(['node_modules', '__tests__', 'test', 'modules', 'activities'])

function isSourceFile(name) {
  return /\.(js|jsx|mjs)$/.test(name) && !/\.test\.(js|jsx|mjs)$/.test(name)
}

function walk(dir, files) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) {
      // src/modules and src/activities are the plugin folders; branching there is expected.
      if (!EXCLUDED_DIRS.has(name)) walk(full, files)
    } else if (isSourceFile(name)) {
      files.push(full)
    }
  }
  return files
}

function countTypeBranches() {
  const counts = {}
  for (const dir of SCANNED_DIRS) {
    for (const file of walk(path.join(root, dir), [])) {
      const text = readFileSync(file, 'utf8')
      const total = (text.match(COMPARISON) || []).length + (text.match(TYPE_ARRAY) || []).length
      if (total > 0) counts[path.relative(root, file).split(path.sep).join('/')] = total
    }
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)))
}

describe('lesson-type branch ratchet', () => {
  const current = countTypeBranches()

  if (process.env.UPDATE_TYPE_BRANCH_BASELINE) {
    writeFileSync(
      path.join(__dirname, 'typeBranchBaseline.json'),
      `${JSON.stringify(current, null, 2)}\n`
    )
  }

  it('detects the patterns it is meant to count', () => {
    const sample = [
      "if (lesson.type === 'turtle') {}",
      "if ('desktop' !== type) {}",
      "case 'scratch':",
      "['python', 'html'].includes(type)",
      "task.taskType === 'code_arrange'",
    ].join('\n')
    expect((sample.match(COMPARISON) || []).length + (sample.match(TYPE_ARRAY) || []).length).toBe(
      5
    )
  })

  it('adds no new type branches outside the plugin folders', () => {
    const increases = Object.entries(current)
      .filter(([file, count]) => count > (baseline[file] ?? 0))
      .map(([file, count]) => `${file}: ${baseline[file] ?? 0} -> ${count}`)
    expect(increases, 'Route new behaviour through the module/activity registry instead').toEqual(
      []
    )
  })

  it('has a baseline no higher than the current counts (lower it when branches are removed)', () => {
    const stale = Object.entries(baseline)
      .filter(([file, count]) => (current[file] ?? 0) < count)
      .map(([file, count]) => `${file}: baseline ${count}, now ${current[file] ?? 0}`)
    expect(
      stale,
      'Run UPDATE_TYPE_BRANCH_BASELINE=1 npx vitest run typeBranchRatchet and commit the baseline'
    ).toEqual([])
  })
})
