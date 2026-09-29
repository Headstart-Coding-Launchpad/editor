import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'
import {
  PATHS,
  REPO_ROOT,
  applyPlan,
  editLessonSchema,
  editTaskTypes,
  moduleNames,
  parseArgs,
  planNewModule,
  validateRequest,
} from '../new-module.mjs'

// The generator must never write anything into the repo from tests: planning reads the real
// repo, and applying happens in a temporary copy of just the files it touches.

const TEMPLATE_TOKENS = [
  'template_module',
  'template-module',
  'TemplateModule',
  'templateModule',
  'Template Module',
]

const tempRoots = []
afterEach(() => {
  for (const dir of tempRoots.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function tempRepo() {
  const root = mkdtempSync(path.join(tmpdir(), 'new-module-'))
  tempRoots.push(root)
  for (const rel of [
    'src/modules',
    'src/shared',
    PATHS.clickThrough,
    PATHS.eslint,
    PATHS.docsReadme,
    PATHS.codebaseMap,
    PATHS.validationErrors,
    PATHS.lessonSchema,
    PATHS.taskTypes,
    PATHS.featureMatrix,
    PATHS.agents,
    '.prettierrc.json',
  ]) {
    cpSync(path.join(REPO_ROOT, rel), path.join(root, rel), { recursive: true })
  }
  return root
}

const read = (plan, rel) =>
  plan.files.find((file) => file.path === rel).content.replace(/\r\n/g, '\n')

describe('arguments', () => {
  it('parses type, label and --dry-run', () => {
    expect(parseArgs(['morse', 'Morse Code', '--dry-run'])).toEqual({
      type: 'morse',
      label: 'Morse Code',
      dryRun: true,
      help: false,
    })
    expect(() => parseArgs(['morse', 'Morse', '--force'])).toThrow(/Unknown option --force/)
    expect(() => parseArgs(['morse', 'Morse', 'Code'])).toThrow(/Too many arguments/)
  })

  it('derives the identifiers used in code', () => {
    expect(moduleNames('pixel_art2')).toEqual({
      type: 'pixel_art2',
      kebab: 'pixel-art2',
      pascal: 'PixelArt2',
      camel: 'pixelArt2',
      upper: 'PIXEL_ART2',
    })
  })

  it('rejects bad types, labels, taken names and names core code already compares against', () => {
    const check = (request) => validateRequest(REPO_ROOT, { label: 'Demo', ...request })
    expect(check({ type: 'Bad-Type' })[0]).toMatch(/lowercase identifier/)
    expect(check({ type: 'pixel__art' })[0]).toMatch(/lowercase identifier/)
    expect(check({ type: 'composed' })[0]).toMatch(/reserved/)
    expect(check({ type: 'quiz_match' })[0]).toMatch(/reserved/)
    expect(check({ type: 'class' })[0]).toMatch(/reserved/)
    expect(check({ type: 'template_module' })[0]).toMatch(/not allowed/)
    expect(check({ type: 'demo', label: 'Say "hi"' })[0]).toMatch(/Label/)
    expect(check({ type: 'python' })).toEqual(
      expect.arrayContaining([
        'src/modules/python/ already exists. Refusing to overwrite.',
        'docs/authoring/python.md already exists. Refusing to overwrite.',
      ])
    )
    expect(check({ type: 'binary' })).toContain(
      "src/activities/binary/ is an activity: a module type can't share its name."
    )
    // 'solo' is compared against as a phase name in core code.
    expect(check({ type: 'solo' }).join('\n')).toMatch(/already compared against/)
    expect(check({ type: 'demo_widget' })).toEqual([])
  })
})

describe('planNewModule', () => {
  it('plans the folder, registrations, tests and docs without writing anything', async () => {
    const plan = await planNewModule({
      root: REPO_ROOT,
      type: 'demo_widget',
      label: "Pupil's Demo",
    })
    expect(plan.files.map((file) => file.path).sort()).toEqual(
      [
        'AGENTS.md',
        'docs/CODEBASE_MAP.md',
        'docs/MODULE_FEATURE_MATRIX.md',
        'docs/README.md',
        'docs/authoring/demo_widget.md',
        'docs/authoring/lesson-schema.md',
        'docs/authoring/task-types.md',
        'docs/authoring/validation-errors.md',
        'eslint.config.js',
        'src/app/views/__tests__/StudentViewModules.test.jsx',
        'src/modules/__tests__/moduleTypeParity.test.js',
        'src/modules/__tests__/typeBranchRatchet.test.js',
        'src/modules/checks.js',
        'src/modules/definitions.js',
        'src/modules/demo_widget/BuilderWorkspace.jsx',
        'src/modules/demo_widget/CheckEditor.jsx',
        'src/modules/demo_widget/StudentWorkspace.jsx',
        'src/modules/demo_widget/TeacherLiveView.jsx',
        'src/modules/demo_widget/__tests__/definition.test.js',
        'src/modules/demo_widget/__tests__/studentView.test.jsx',
        'src/modules/demo_widget/__tests__/workspace.test.jsx',
        'src/modules/demo_widget/checks.js',
        'src/modules/demo_widget/definition.js',
        'src/modules/demo_widget/index.js',
        'src/modules/registry.js',
      ].sort()
    )
    expect(existsSync(path.join(REPO_ROOT, 'src/modules/demo_widget'))).toBe(false)

    for (const file of plan.files.filter((f) => f.action === 'create')) {
      for (const token of TEMPLATE_TOKENS) expect(file.content, file.path).not.toContain(token)
    }
    const definition = read(plan, 'src/modules/demo_widget/definition.js')
    expect(definition).toContain(`type: 'demo_widget',`)
    expect(definition).toContain(`label: "Pupil's Demo",`)
    expect(definition).toMatch(new RegExp(`order: ${plan.order},`))
    expect(plan.order).toBeGreaterThanOrEqual(8)
    expect(read(plan, 'src/modules/demo_widget/index.js')).toContain(
      'const demoWidgetModule = defineUiModule(definition, {'
    )

    expect(read(plan, PATHS.definitions)).toContain(
      "import demoWidgetDefinition from './demo_widget/definition.js'"
    )
    expect(read(plan, PATHS.definitions)).toMatch(/demoWidgetDefinition,\n\]\.sort/)
    expect(read(plan, PATHS.registry)).toContain(
      "import demoWidgetModule from './demo_widget/index.js'"
    )
    expect(read(plan, PATHS.registry)).toMatch(/ {2}demo_widget: demoWidgetModule,\n\}/)
    expect(read(plan, PATHS.checks)).toContain(
      "import { CHECKS as DEMO_WIDGET_CHECKS } from './demo_widget/checks.js'"
    )
    expect(read(plan, PATHS.checks)).toMatch(/\.\.\.DEMO_WIDGET_CHECKS,\n\]\)/)
    expect(read(plan, PATHS.ratchet)).toMatch(/\n {2}'demo_widget',\n\]/)
    expect(read(plan, PATHS.eslint)).toContain('|demo_widget)$/')
    expect(read(plan, PATHS.parity)).toMatch(/ {2}demo_widget: \{\n {4}PLAYGROUND_LESSON_TYPES:/)
    expect(read(plan, PATHS.clickThrough)).toMatch(/ {2}demo_widget: async \(\) => \{/)

    expect(read(plan, PATHS.docsReadme)).toContain(
      '### [authoring/demo_widget.md](authoring/demo_widget.md)'
    )
    expect(read(plan, PATHS.codebaseMap)).toContain('| `demo_widget/definition.js` |')
    const errorsDoc = read(plan, PATHS.validationErrors)
    expect(errorsDoc).toContain(
      "`Task … has a Pupil's Demo check that is not a code check — only code checks are evaluated`"
    )
    expect(errorsDoc.indexOf("### Pupil's Demo")).toBeLessThan(errorsDoc.indexOf('## Checks'))
    expect(read(plan, PATHS.agents)).toContain('`docs/authoring/demo_widget.md`')
    expect(read(plan, PATHS.lessonSchema)).toMatch(/`electronics`, (.*, )?or `demo_widget`./)
    expect(read(plan, PATHS.taskTypes)).toMatch(/Electronics, (.*, )?or Pupil's Demo — but/)
    expect(read(plan, PATHS.featureMatrix)).toContain("| Pupil's Demo | TODO(new-module)")
    const doc = read(plan, 'docs/authoring/demo_widget.md')
    expect(doc).toMatch(/^type: demo_widget$/m)
    expect(doc).toMatch(/^id: demo-widget-example$/m)
    expect(plan.checklist.join('\n')).toMatch(/real browser/)
  })

  it('keeps the lesson-schema and task-types lists grammatical', () => {
    const names = moduleNames('morse')
    expect(
      editLessonSchema(
        '| `moduleType` | Required for composed code | string | Workspace: `python`, or `html`. |',
        names
      )
    ).toBe(
      '| `moduleType` | Required for composed code | string | Workspace: `python`, `html`, or `morse`. |'
    )
    expect(editTaskTypes('selects a workspace module — Python, or HTML — but', 'Morse')).toBe(
      'selects a workspace module — Python, HTML, or Morse — but'
    )
  })

  it('applies the plan in a copy of the repo and refuses to run twice', async () => {
    const root = tempRepo()
    const plan = await planNewModule({ root, type: 'demo_widget', label: 'Demo Widget' })
    applyPlan(root, plan)
    expect(existsSync(path.join(root, 'src/modules/demo_widget/definition.js'))).toBe(true)
    expect(existsSync(path.join(root, 'docs/authoring/demo_widget.md'))).toBe(true)
    expect(readFileSync(path.join(root, PATHS.definitions), 'utf8')).toContain(
      "'./demo_widget/definition.js'"
    )
    // The generated definition passes defineModule (it runs on import) in a real Node process.
    const url = pathToFileURL(path.join(root, 'src/modules/demo_widget/definition.js')).href
    const loaded = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `const { default: d } = await import(${JSON.stringify(url)}); console.log(d.type + '|' + d.meta.label)`,
      ],
      { encoding: 'utf8' }
    )
    expect(loaded.stderr).toBe('')
    expect(loaded.stdout.trim()).toBe('demo_widget|Demo Widget')
    await expect(
      planNewModule({ root, type: 'demo_widget', label: 'Demo Widget' })
    ).rejects.toThrow(/already exists\. Refusing to overwrite/)
    expect(() => applyPlan(root, plan)).toThrow(/already exists/)
  })

  it('refuses to apply a stale plan', async () => {
    const root = tempRepo()
    const plan = await planNewModule({ root, type: 'demo_widget', label: 'Demo Widget' })
    writeFileSync(path.join(root, PATHS.docsReadme), 'edited meanwhile\n')
    expect(() => applyPlan(root, plan)).toThrow(/changed while planning/)
    expect(existsSync(path.join(root, 'src/modules/demo_widget'))).toBe(false)
  })
})

describe('command line', () => {
  it('--dry-run prints the plan and writes nothing', () => {
    const result = spawnSync(
      process.execPath,
      ['scripts/new-module.mjs', 'demo_widget', 'Demo Widget', '--dry-run'],
      { cwd: REPO_ROOT, encoding: 'utf8' }
    )
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('create  src/modules/demo_widget/definition.js')
    expect(result.stdout).toContain(
      "+ import demoWidgetDefinition from './demo_widget/definition.js'"
    )
    expect(result.stdout).toContain('Dry run: nothing was written.')
    expect(existsSync(path.join(REPO_ROOT, 'src/modules/demo_widget'))).toBe(false)
  })

  it('exits non-zero with the reasons when the type is taken', () => {
    const result = spawnSync(process.execPath, ['scripts/new-module.mjs', 'python', 'Python'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Refusing to overwrite')
  })
})
