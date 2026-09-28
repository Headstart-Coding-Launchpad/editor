import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'
import {
  REPO_ROOT,
  activityNames,
  applyPlan,
  parseArgs,
  planNewActivity,
  validateRequest,
} from '../new-activity.mjs'

// The generator must never write anything into the repo from tests: planning reads the real
// repo, and applying happens in a temporary copy of just the files it touches.

const TEMPLATE_TOKENS = [
  'template_activity',
  'template-activity',
  'TemplateActivity',
  'Template Activity',
]

const tempRoots = []
afterEach(() => {
  for (const dir of tempRoots.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function tempRepo() {
  const root = mkdtempSync(path.join(tmpdir(), 'new-activity-'))
  tempRoots.push(root)
  for (const rel of [
    'src/activities',
    'docs/README.md',
    'docs/CODEBASE_MAP.md',
    'docs/authoring/validation-errors.md',
    'docs/authoring/activities',
    '.prettierrc.json',
  ]) {
    cpSync(path.join(REPO_ROOT, rel), path.join(root, rel), { recursive: true })
  }
  return root
}

describe('arguments', () => {
  it('parses id, label, category and --dry-run', () => {
    expect(parseArgs(['morse', 'Morse Code', '--category', 'digital_skills', '--dry-run'])).toEqual(
      {
        id: 'morse',
        label: 'Morse Code',
        category: 'digital_skills',
        dryRun: true,
        help: false,
      }
    )
    expect(parseArgs(['morse', 'Morse', '--category=quiz']).category).toBe('quiz')
    expect(() => parseArgs(['morse', 'Morse', '--force'])).toThrow(/Unknown option --force/)
  })

  it('derives the identifiers used in code', () => {
    expect(activityNames('pixel_art2')).toEqual({
      id: 'pixel_art2',
      kebab: 'pixel-art2',
      pascal: 'PixelArt2',
      camel: 'pixelArt2',
    })
  })

  it('rejects bad ids, labels, categories and existing activities', () => {
    const check = (request) =>
      validateRequest(REPO_ROOT, { label: 'Demo', category: 'computing', ...request })
    expect(check({ id: 'Bad-Id' })[0]).toMatch(/lowercase identifier/)
    expect(check({ id: 'pixel__art' })[0]).toMatch(/lowercase identifier/)
    expect(check({ id: 'class' })[0]).toMatch(/reserved/)
    expect(check({ id: 'quiz_match' })[0]).toMatch(/reserved/)
    expect(check({ id: 'unknown' })[0]).toMatch(/reserved/)
    expect(check({ id: 'template_activity' })[0]).toMatch(/not allowed/)
    expect(check({ id: 'demo', label: 'Say "hi"' })[0]).toMatch(/Label/)
    expect(check({ id: 'demo', category: 'games' })[0]).toMatch(/Category/)
    expect(check({ id: 'binary' })).toEqual(
      expect.arrayContaining([
        'src/activities/binary/ already exists. Refusing to overwrite.',
        'docs/authoring/activities/binary.md already exists. Refusing to overwrite.',
      ])
    )
    expect(check({ id: 'demo_widget' })).toEqual([])
  })
})

describe('planNewActivity', () => {
  it('plans the folder, registry lines and docs without writing anything', async () => {
    const plan = await planNewActivity({
      root: REPO_ROOT,
      id: 'demo_widget',
      label: "Pupil's Demo",
      category: 'digital_skills',
    })
    const byPath = Object.fromEntries(
      plan.files.map((file) => [
        file.path,
        { ...file, content: file.content.replace(/\r\n/g, '\n') },
      ])
    )
    expect(Object.keys(byPath).sort()).toEqual(
      [
        'docs/CODEBASE_MAP.md',
        'docs/README.md',
        'docs/authoring/activities/demo_widget.md',
        'docs/authoring/validation-errors.md',
        'src/activities/demo_widget/__tests__/demo_widget.test.js',
        'src/activities/demo_widget/__tests__/studentView.test.jsx',
        'src/activities/demo_widget/__tests__/ui.test.jsx',
        'src/activities/demo_widget/definition.js',
        'src/activities/demo_widget/demo_widget.js',
        'src/activities/demo_widget/ui.jsx',
        'src/activities/registry.js',
        'src/activities/registry.pure.js',
      ].sort()
    )
    expect(existsSync(path.join(REPO_ROOT, 'src/activities/demo_widget'))).toBe(false)

    for (const file of plan.files.filter((f) => f.action === 'create')) {
      for (const token of TEMPLATE_TOKENS) expect(file.content, file.path).not.toContain(token)
    }
    const definition = byPath['src/activities/demo_widget/definition.js'].content
    expect(definition).toContain(`id: 'demo_widget',`)
    expect(definition).toContain(`label: "Pupil's Demo",`)
    expect(definition).toContain(`category: 'digital_skills',`)
    expect(definition).toContain('validateDemoWidgetTask')
    expect(byPath['src/activities/demo_widget/ui.jsx'].content).toContain(
      'export function DemoWidgetStudentView'
    )

    const pure = byPath['src/activities/registry.pure.js'].content
    expect(pure).toContain("import demoWidget from './demo_widget/definition.js'")
    expect(pure).toMatch(/const ACTIVITIES = \[[^\]]*demoWidget, unknown\]/)
    const ui = byPath['src/activities/registry.js'].content
    expect(ui).toContain("import demoWidgetUi from './demo_widget/ui.jsx'")
    expect(ui).toMatch(/demo_widget: demoWidgetUi,\n\}\)/)

    expect(byPath['docs/README.md'].content).toContain(
      '### [authoring/activities/demo_widget.md](authoring/activities/demo_widget.md)'
    )
    expect(byPath['docs/CODEBASE_MAP.md'].content).toContain('| `demo_widget/demo_widget.js` |')
    const errorsDoc = byPath['docs/authoring/validation-errors.md'].content
    expect(errorsDoc).toContain('`Task …: demo_widget task needs at least one item.`')
    // The new section stays inside "Activity tasks", before the next top-level section.
    expect(errorsDoc.indexOf("### Pupil's Demo")).toBeLessThan(
      errorsDoc.indexOf('## Code-arrange tasks')
    )
    const doc = byPath['docs/authoring/activities/demo_widget.md'].content
    expect(doc).toContain('activityType: demo_widget')
    expect(doc).toMatch(/^id: demo-widget-example$/m)
    expect(plan.checklist.join('\n')).toMatch(/real browser/)
  })

  it('applies the plan in a copy of the repo and refuses to run twice', async () => {
    const root = tempRepo()
    const plan = await planNewActivity({ root, id: 'demo_widget', label: 'Demo Widget' })
    applyPlan(root, plan)
    expect(existsSync(path.join(root, 'src/activities/demo_widget/demo_widget.js'))).toBe(true)
    expect(readFileSync(path.join(root, 'src/activities/registry.pure.js'), 'utf8')).toContain(
      "'./demo_widget/definition.js'"
    )
    await expect(
      planNewActivity({ root, id: 'demo_widget', label: 'Demo Widget' })
    ).rejects.toThrow(/already exists\. Refusing to overwrite/)
    expect(() => applyPlan(root, plan)).toThrow(/already exists/)
  })

  it('refuses to apply a stale plan', async () => {
    const root = tempRepo()
    const plan = await planNewActivity({ root, id: 'demo_widget', label: 'Demo Widget' })
    writeFileSync(path.join(root, 'docs/README.md'), 'edited meanwhile\n')
    expect(() => applyPlan(root, plan)).toThrow(/changed while planning/)
    expect(existsSync(path.join(root, 'src/activities/demo_widget'))).toBe(false)
  })
})

describe('command line', () => {
  it('--dry-run prints the plan and writes nothing', () => {
    const result = spawnSync(
      process.execPath,
      ['scripts/new-activity.mjs', 'demo_widget', 'Demo Widget', '--dry-run'],
      { cwd: REPO_ROOT, encoding: 'utf8' }
    )
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('create  src/activities/demo_widget/definition.js')
    expect(result.stdout).toContain("+ import demoWidget from './demo_widget/definition.js'")
    expect(result.stdout).toContain('Dry run: nothing was written.')
    expect(existsSync(path.join(REPO_ROOT, 'src/activities/demo_widget'))).toBe(false)
  })

  it('exits non-zero with the reasons when the id is taken', () => {
    const result = spawnSync(process.execPath, ['scripts/new-activity.mjs', 'binary', 'Binary'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Refusing to overwrite')
  })
})
