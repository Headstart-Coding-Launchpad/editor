// @vitest-environment node
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
//
// Plan step 4.8 took every file to zero (the baseline is empty); the ESLint rule
// `no-restricted-syntax` in eslint.config.js forbids new comparisons as you type, and this test
// keeps the regex-level guard (it also counts inline type arrays, which ESLint does not).

const root = path.resolve(__dirname, '../../..')

// Matches that are not module/task-type branching (e.g. a comparison against a name that only
// coincides with a type). Each entry removes one exact `pattern` occurrence from `file`'s count
// and must say why; a test fails once the pattern is gone so stale entries get removed. Prefer a
// named constant or a map over an entry here (codemirror.js, launchpadCodeFile.js did that).
const TYPE_BRANCH_ALLOWLIST = [
  // { file: 'src/…', pattern: "x === 'python'", reason: 'why this is not type branching' },
]

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

function countMatches(text) {
  return (text.match(COMPARISON) || []).length + (text.match(TYPE_ARRAY) || []).length
}

// Counted matches the allowlist excuses in `relPath`: each occurrence of an entry's pattern.
function allowlistedMatches(relPath, text) {
  let excused = 0
  for (const entry of TYPE_BRANCH_ALLOWLIST) {
    if (entry.file !== relPath) continue
    excused += (text.split(entry.pattern).length - 1) * countMatches(entry.pattern)
  }
  return excused
}

function countTypeBranches() {
  const counts = {}
  for (const dir of SCANNED_DIRS) {
    for (const file of walk(path.join(root, dir), [])) {
      const text = readFileSync(file, 'utf8')
      const relPath = path.relative(root, file).split(path.sep).join('/')
      const total = countMatches(text) - allowlistedMatches(relPath, text)
      if (total > 0) counts[relPath] = total
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

  it('is at zero outside the plugin folders (plan step 4.8)', () => {
    expect(
      Object.keys(current),
      'Ask the module/activity registry instead of comparing type names'
    ).toEqual([])
    expect(baseline).toEqual({})
  })

  it('keeps every allowlist entry justified and still present', () => {
    for (const entry of TYPE_BRANCH_ALLOWLIST) {
      const label = `${entry.file}: ${entry.pattern}`
      expect(typeof entry.reason === 'string' && entry.reason.trim().length > 0, label).toBe(true)
      expect(countMatches(entry.pattern), `${label} matches no counted pattern`).toBeGreaterThan(0)
      const text = readFileSync(path.join(root, entry.file), 'utf8')
      expect(text.includes(entry.pattern), `${label} is gone: remove the entry`).toBe(true)
    }
  })
})
