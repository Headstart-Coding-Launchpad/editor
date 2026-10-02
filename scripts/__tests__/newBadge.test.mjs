import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'
import {
  REPO_ROOT,
  applyPlan,
  badgeNames,
  parseArgs,
  planNewBadge,
  readRegistry,
  validateRequest,
} from '../new-badge.mjs'

// The generator must never write anything into the repo from tests: planning reads the real
// repo, and applying happens in a temporary copy of just the files it touches.

const tempRoots = []
afterEach(() => {
  for (const dir of tempRoots.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function tempRepo() {
  const root = mkdtempSync(path.join(tmpdir(), 'new-badge-'))
  tempRoots.push(root)
  for (const rel of [
    'src/badges/definitions',
    'src/badges/registry.pure.js',
    'docs/authoring/badges.md',
    'docs/CODEBASE_MAP.md',
    '.prettierrc.json',
  ]) {
    cpSync(path.join(REPO_ROOT, rel), path.join(root, rel), { recursive: true })
  }
  return root
}

const byPathOf = (plan) =>
  Object.fromEntries(plan.files.map((file) => [file.path, file.content.replace(/\r\n/g, '\n')]))

describe('arguments', () => {
  it('parses the id, emoji, title, blurb and flags', () => {
    expect(
      parseArgs(['tidy_coder', '--emoji', '🧹', '--title=Tidy Coder', '--tutor-only', '--dry-run'])
    ).toEqual({
      id: 'tidy_coder',
      emoji: '🧹',
      title: 'Tidy Coder',
      tutorOnly: true,
      dryRun: true,
      help: false,
    })
    expect(parseArgs(['x', '--blurb', 'Kept it tidy.']).blurb).toBe('Kept it tidy.')
    expect(() => parseArgs(['x', '--force'])).toThrow(/Unknown option --force/)
  })

  it('derives the variable and default title', () => {
    expect(badgeNames('tidy_coder2')).toEqual({
      id: 'tidy_coder2',
      camel: 'tidyCoder2',
      title: 'Tidy Coder2',
    })
  })

  it('refuses bad ids, taken ids and taken emoji', () => {
    const check = (request) => validateRequest(REPO_ROOT, { emoji: '🧹', ...request })
    expect(check({ id: 'Bad-Id' })[0]).toMatch(/lowercase identifier/)
    expect(check({ id: 'badges' })[0]).toMatch(/not allowed/)
    expect(check({ id: 'tidy', emoji: undefined })[0]).toMatch(/Missing --emoji/)
    expect(check({ id: 'tidy', emoji: 'ab' })[0]).toMatch(/single emoji/)
    expect(check({ id: 'tidy', title: 'Say "hi"' })[0]).toMatch(/Title/)
    expect(check({ id: 'bug_hunter' })).toEqual(
      expect.arrayContaining([
        'src/badges/definitions/bug_hunter.js already exists. Refusing to overwrite.',
        'src/badges/registry.pure.js already registers "bug_hunter".',
      ])
    )
    expect(check({ id: 'tidy', emoji: '🐛' })).toEqual([
      '🐛 is already the Bug Hunter badge (bug_hunter).',
    ])
    // A variation selector doesn't make a new emoji.
    expect(check({ id: 'tidy', emoji: '⌨' })[0]).toMatch(/Keyboard Wizard/)
    expect(check({ id: 'tidy_coder' })).toEqual([])
  })

  it('reads which registered badges are rule-backed', () => {
    const registry = readRegistry(REPO_ROOT)
    expect(registry.find((b) => b.id === 'bug_hunter')).toMatchObject({
      emoji: '🐛',
      ruleBacked: true,
    })
    expect(registry.find((b) => b.id === 'helpful_coder').ruleBacked).toBe(false)
  })
})

describe('planNewBadge', () => {
  it('plans a rule-backed badge with a stub rule and two examples, without writing', async () => {
    const plan = await planNewBadge({ root: REPO_ROOT, id: 'tidy_coder', emoji: '🧹' })
    const byPath = byPathOf(plan)
    expect(Object.keys(byPath).sort()).toEqual(
      [
        'docs/CODEBASE_MAP.md',
        'docs/authoring/badges.md',
        'src/badges/definitions/tidy_coder.js',
        'src/badges/registry.pure.js',
      ].sort()
    )
    expect(existsSync(path.join(REPO_ROOT, 'src/badges/definitions/tidy_coder.js'))).toBe(false)

    const definition = byPath['src/badges/definitions/tidy_coder.js']
    expect(definition).toContain("id: 'tidy_coder',")
    expect(definition).toContain("emoji: '🧹',")
    expect(definition).toContain("title: 'Tidy Coder',")
    expect(definition).toContain('rule: anySignal(')
    expect(definition.match(/name: '/g)).toHaveLength(2)
    expect(definition).toContain('TODO(new-badge)')

    // Registered after the last rule-backed badge, before the tutor-only ones.
    const pure = byPath['src/badges/registry.pure.js']
    expect(pure).toContain("import tidyCoder from './definitions/tidy_coder.js'")
    expect(pure).toMatch(/earlyBird,\n {2}tidyCoder,\n {2}problemSolver,/)
    expect(byPath['docs/authoring/badges.md']).toMatch(
      /\| 🧹 Tidy Coder \| `tidy_coder` \| TODO\(new-badge\)[^\n]*\n\| 🧠 Problem Solver/
    )
    expect(byPath['docs/CODEBASE_MAP.md']).toContain(
      '`early_bird.js`, `tidy_coder.js`, and tutor-only'
    )
    expect(plan.checklist.join('\n')).toMatch(/real browser/)
  })

  it('plans a tutor-only badge at the end of the registry', async () => {
    const plan = await planNewBadge({
      root: REPO_ROOT,
      id: 'team_player',
      emoji: '🫶',
      blurb: "Helped the team's project.",
      tutorOnly: true,
    })
    const byPath = byPathOf(plan)
    const definition = byPath['src/badges/definitions/team_player.js']
    expect(definition).toContain('blurb: "Helped the team\'s project.",')
    expect(definition).not.toContain('rule')
    expect(byPath['src/badges/registry.pure.js']).toMatch(/independentCoder,\n {2}teamPlayer,\n\]/)
    expect(byPath['docs/CODEBASE_MAP.md']).toContain('`independent_coder.js`, `team_player.js`) |')
    expect(byPath['docs/authoring/badges.md']).toContain(
      '| 🫶 Team Player | `team_player` | Tutor-only: never suggested | – |'
    )
  })

  it('applies the plan in a copy of the repo and refuses to run twice', async () => {
    const root = tempRepo()
    const plan = await planNewBadge({ root, id: 'tidy_coder', emoji: '🧹' })
    applyPlan(root, plan)
    expect(existsSync(path.join(root, 'src/badges/definitions/tidy_coder.js'))).toBe(true)
    expect(readFileSync(path.join(root, 'src/badges/registry.pure.js'), 'utf8')).toContain(
      "'./definitions/tidy_coder.js'"
    )
    await expect(planNewBadge({ root, id: 'tidy_coder', emoji: '🧽' })).rejects.toThrow(
      /already exists\. Refusing to overwrite/
    )
    await expect(planNewBadge({ root, id: 'neat_coder', emoji: '🧹' })).rejects.toThrow(
      /already the Tidy Coder badge/
    )
    expect(() => applyPlan(root, plan)).toThrow(/already exists/)
  })

  it('refuses to apply a stale plan', async () => {
    const root = tempRepo()
    const plan = await planNewBadge({ root, id: 'tidy_coder', emoji: '🧹' })
    writeFileSync(path.join(root, 'docs/authoring/badges.md'), 'edited meanwhile\n')
    expect(() => applyPlan(root, plan)).toThrow(/changed while planning/)
    expect(existsSync(path.join(root, 'src/badges/definitions/tidy_coder.js'))).toBe(false)
  })
})

describe('command line', () => {
  it('--dry-run prints the plan and writes nothing', () => {
    const result = spawnSync(
      process.execPath,
      ['scripts/new-badge.mjs', 'tidy_coder', '--emoji', '🧹', '--dry-run'],
      { cwd: REPO_ROOT, encoding: 'utf8' }
    )
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('create  src/badges/definitions/tidy_coder.js')
    expect(result.stdout).toContain("+ import tidyCoder from './definitions/tidy_coder.js'")
    expect(result.stdout).toContain('Dry run: nothing was written.')
    expect(existsSync(path.join(REPO_ROOT, 'src/badges/definitions/tidy_coder.js'))).toBe(false)
  })

  it('exits non-zero with the reasons when the id or emoji is taken', () => {
    const result = spawnSync(
      process.execPath,
      ['scripts/new-badge.mjs', 'bug_hunter', '--emoji', '🐛'],
      { cwd: REPO_ROOT, encoding: 'utf8' }
    )
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('already registers "bug_hunter"')
    expect(result.stderr).toContain('🐛 is already the Bug Hunter badge')
  })
})
