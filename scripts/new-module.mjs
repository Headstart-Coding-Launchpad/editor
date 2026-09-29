// Scaffolds a new workspace module (lesson type) from src/modules/_template/ (plan step 4.8, "the
// module kit").
//
//   npm run new:module -- <type> "<Label>" [--dry-run]
//
// Creates src/modules/<type>/ (definition, UI half, check list, tests), registers it in
// src/modules/definitions.js, registry.js and checks.js, writes docs/authoring/<type>.md with a
// valid example lesson, and indexes it everywhere the registry-driven tests and the docs check
// look: docs/README.md, docs/CODEBASE_MAP.md, docs/authoring/validation-errors.md, AGENTS.md, the
// module lists in lesson-schema.md / task-types.md / MODULE_FEATURE_MATRIX.md, the type-branch
// ratchet and ESLint rule, moduleTypeParity's KNOWN_GAPS (the scaffold's deliberate defaults)
// and StudentViewModules' click-through. `npm test`, lint, format, `docs:check` and `vite build`
// pass on the untouched scaffold. It refuses to overwrite anything and writes nothing until every
// planned edit has been worked out. See docs/architecture/lesson-type-modules.md ("Adding a
// module") and .claude/skills/new-module/SKILL.md.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  applyPlan,
  describePlan,
  formatCode,
  freeIdentifier,
  insertAt,
  lastMatchEnd,
  listTemplateFiles,
  requireAnchor as requireAnchorFor,
  withLineEndingsOf,
} from './scaffold-utils.mjs'

export { applyPlan, describePlan }

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const TEMPLATE_DIR = 'src/modules/_template'
const DOC_TEMPLATE = 'doc.md.tmpl'

// Placeholders used throughout src/modules/_template.
const TOKEN = {
  type: 'template_module',
  kebab: 'template-module',
  pascal: 'TemplateModule',
  camel: 'templateModule',
  label: 'Template Module',
}

// Names a lesson `type` must not take: other task/lesson kinds the app and the YAML converter
// already give a meaning, plus words that are not usable as a JS identifier in the registries.
const RESERVED_TYPES = new Set(
  `composed information draft quiz activity code_arrange group unknown module modules lesson
  task tasks playground sandbox abstract arguments await boolean break byte case catch char
  class const continue debugger default delete do double else enum eval export extends false
  final finally float for function goto if implements import in instanceof int interface let
  long native new null package private protected public return short static super switch
  synchronized this throw throws transient true try typeof var void volatile while with yield`.split(
    /\s+/
  )
)

export const PATHS = {
  definitions: 'src/modules/definitions.js',
  registry: 'src/modules/registry.js',
  checks: 'src/modules/checks.js',
  ratchet: 'src/modules/__tests__/typeBranchRatchet.test.js',
  parity: 'src/modules/__tests__/moduleTypeParity.test.js',
  clickThrough: 'src/app/views/__tests__/StudentViewModules.test.jsx',
  eslint: 'eslint.config.js',
  docsReadme: 'docs/README.md',
  codebaseMap: 'docs/CODEBASE_MAP.md',
  validationErrors: 'docs/authoring/validation-errors.md',
  lessonSchema: 'docs/authoring/lesson-schema.md',
  taskTypes: 'docs/authoring/task-types.md',
  featureMatrix: 'docs/MODULE_FEATURE_MATRIX.md',
  agents: 'AGENTS.md',
  doc: (type) => `docs/authoring/${type}.md`,
  folder: (type) => `src/modules/${type}`,
}

export function parseArgs(argv) {
  const options = { dryRun: false, help: false }
  const positional = []
  for (const arg of argv) {
    if (arg === '--dry-run') options.dryRun = true
    else if (arg === '--help' || arg === '-h') options.help = true
    else if (arg.startsWith('--')) throw new Error(`Unknown option ${arg}`)
    else positional.push(arg)
  }
  if (positional.length > 2) throw new Error('Too many arguments (quote the label).')
  const [type, label] = positional
  return { ...options, type, label }
}

export function moduleNames(type) {
  const words = type.split('_').filter(Boolean)
  const pascal = words.map((word) => word[0].toUpperCase() + word.slice(1)).join('')
  return {
    type,
    kebab: type.replaceAll('_', '-'),
    pascal,
    camel: pascal[0].toLowerCase() + pascal.slice(1),
    upper: type.toUpperCase(),
  }
}

// Source files (outside the plugin folders and tests) that already compare against `type` as a
// string literal: the new type would join the ratchet and the ESLint rule, which would then flag
// them. Same patterns as typeBranchRatchet.test.js.
function existingTypeComparisons(root, type) {
  const comparison = new RegExp(
    `[!=]==\\s*['"]${type}['"]|['"]${type}['"]\\s*[!=]==|case\\s+['"]${type}['"]\\s*:`
  )
  const excluded = new Set(['node_modules', '__tests__', 'test', 'modules', 'activities'])
  const hits = []
  const walk = (dir) => {
    if (!existsSync(dir)) return
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name)
      if (statSync(full).isDirectory()) {
        if (!excluded.has(name)) walk(full)
      } else if (/\.(js|jsx|mjs)$/.test(name) && !/\.test\.(js|jsx|mjs)$/.test(name)) {
        if (comparison.test(readFileSync(full, 'utf8'))) {
          hits.push(path.relative(root, full).split(path.sep).join('/'))
        }
      }
    }
  }
  for (const dir of ['src', 'cli']) walk(path.join(root, dir))
  return hits
}

// Every reason the request can't be scaffolded, checked before anything is written.
export function validateRequest(root, { type, label }) {
  const errors = []
  if (!type) errors.push('Missing <type>, e.g. npm run new:module -- morse "Morse Code"')
  else if (!/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/.test(type)) {
    errors.push(
      `Module type "${type}" must be a lowercase identifier (letters, digits, single underscores).`
    )
  } else if (RESERVED_TYPES.has(type) || type.startsWith('quiz_')) {
    errors.push(`Module type "${type}" is reserved.`)
  } else if (type === TOKEN.type || type.length > 24) {
    errors.push(`Module type "${type}" is not allowed (at most 24 characters, not the template).`)
  }
  if (!label) errors.push('Missing "<Label>" (the name teachers and students see).')
  else if (!/^[A-Za-z0-9][A-Za-z0-9 '&()+,.!?-]{0,39}$/.test(label)) {
    errors.push(
      `Label "${label}" must start with a letter or digit and use only letters, digits, spaces and ' & ( ) + , . ! ? - (at most 40 characters).`
    )
  }
  if (errors.length || !type) return errors

  if (existsSync(path.join(root, PATHS.folder(type)))) {
    errors.push(`${PATHS.folder(type)}/ already exists. Refusing to overwrite.`)
  }
  if (existsSync(path.join(root, PATHS.doc(type)))) {
    errors.push(`${PATHS.doc(type)} already exists. Refusing to overwrite.`)
  }
  if (existsSync(path.join(root, 'src/activities', type))) {
    errors.push(`src/activities/${type}/ is an activity: a module type can't share its name.`)
  }
  for (const file of [PATHS.definitions, PATHS.registry]) {
    if (readFileSync(path.join(root, file), 'utf8').includes(`'./${type}/`)) {
      errors.push(`${file} already imports ./${type}/.`)
    }
  }
  const comparisons = existingTypeComparisons(root, type)
  if (comparisons.length) {
    errors.push(
      `"${type}" is already compared against as a string in ${comparisons.join(', ')}; pick another type (the type-branch ratchet and ESLint rule would flag those lines).`
    )
  }
  return errors
}

// The next free registry position (meta.order): after every existing module.
function nextOrder(root) {
  const modulesDir = path.join(root, 'src/modules')
  let max = -1
  for (const entry of readdirSync(modulesDir, { withFileTypes: true })) {
    const file = path.join(modulesDir, entry.name, 'definition.js')
    if (!entry.isDirectory() || entry.name.startsWith('_') || !existsSync(file)) continue
    const match = /\border:\s*(\d+)/.exec(readFileSync(file, 'utf8'))
    if (match) max = Math.max(max, Number(match[1]))
  }
  return max + 1
}

// Replaces the template placeholders. In JS, string literals holding the label are re-quoted with
// JSON.stringify (a label may contain an apostrophe); prettier restores the house quotes.
function fillPlaceholders(text, names, label, { js }) {
  let out = text
  if (js) {
    out = out.replace(/'([^'\n]*)Template Module([^'\n]*)'/g, (_, before, after) =>
      JSON.stringify(`${before}${label}${after}`)
    )
  }
  return out
    .replaceAll(TOKEN.type, names.type)
    .replaceAll(TOKEN.kebab, names.kebab)
    .replaceAll(TOKEN.pascal, names.pascal)
    .replaceAll(TOKEN.camel, names.camel)
    .replaceAll(TOKEN.label, label)
}

function requireAnchor(found, file, what) {
  requireAnchorFor(found, file, what, 'the module')
}

// ── Registration ─────────────────────────────────────────────────────────────

export function editDefinitions(source, names) {
  const variable = freeIdentifier(source, `${names.camel}Definition`, 'Module')
  const importEnd = lastMatchEnd(source, /^import \w+ from '\.\/[a-z0-9_]+\/definition\.js'\r?\n/gm)
  requireAnchor(importEnd >= 0, PATHS.definitions, 'the definition imports')
  let out = insertAt(source, importEnd, `import ${variable} from './${names.type}/definition.js'\n`)
  const list = /const DEFINITIONS = \[([^\]]*)\]/.exec(out)
  requireAnchor(list, PATHS.definitions, 'const DEFINITIONS = [...]')
  const entries = list[1]
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
  entries.push(variable)
  out = out.replace(
    list[0],
    `const DEFINITIONS = [\n${entries.map((entry) => `  ${entry},`).join('\n')}\n]`
  )
  return out
}

export function editRegistry(source, names) {
  const variable = freeIdentifier(source, `${names.camel}Module`, 'Ui')
  const importEnd = lastMatchEnd(source, /^import \w+ from '\.\/[a-z0-9_]+\/index\.js'\r?\n/gm)
  requireAnchor(importEnd >= 0, PATHS.registry, 'the module index.js imports')
  let out = insertAt(source, importEnd, `import ${variable} from './${names.type}/index.js'\n`)
  const map = /(const MODULES = \{)([\s\S]*?)(\r?\n\})/.exec(out)
  requireAnchor(map, PATHS.registry, 'const MODULES = { ... }')
  const body = map[2].replace(/,?\s*$/, ',')
  out = out.replace(map[0], `${map[1]}${body}\n  ${names.type}: ${variable},${map[3]}`)
  return out
}

export function editChecks(source, names) {
  const variable = `${names.upper}_CHECKS`
  const importEnd = lastMatchEnd(
    source,
    /^import \{ CHECKS as \w+(?:, \w+)* \} from '\.\/[a-z0-9_]+\/checks\.js'\r?\n/gm
  )
  requireAnchor(importEnd >= 0, PATHS.checks, 'the module `import { CHECKS as … }` lines')
  let out = insertAt(
    source,
    importEnd,
    `import { CHECKS as ${variable} } from './${names.type}/checks.js'\n`
  )
  const registry = /export const checkRegistry = createCheckRegistry\(\[([\s\S]*?)\r?\n\]\)/.exec(
    out
  )
  requireAnchor(registry, PATHS.checks, 'export const checkRegistry = createCheckRegistry([...])')
  const at = registry.index + registry[0].lastIndexOf('\n]')
  out = insertAt(out, at, `\n  ...${variable},`)
  return out
}

// The new type joins the ratchet's and the ESLint rule's type names, so core code can't start
// branching on it either.
export function editRatchet(source, names) {
  const list = /const TYPE_NAMES = \[([^\]]*)\]/.exec(source)
  requireAnchor(list, PATHS.ratchet, 'const TYPE_NAMES = [...]')
  const at = list.index + list[0].lastIndexOf(']')
  const body = list[1].replace(/,?\s*$/, ',')
  return (
    source.slice(0, list.index) +
    `const TYPE_NAMES = [${body}\n  '${names.type}',\n]` +
    source.slice(at + 1)
  )
}

export function editEslint(source, names) {
  const pattern = /(const TYPE_NAME_PATTERN =\s*'\/\^\([^)]*)(\)\$\/')/.exec(source)
  requireAnchor(pattern, PATHS.eslint, 'const TYPE_NAME_PATTERN')
  return source.replace(pattern[0], `${pattern[1]}|${names.type}${pattern[2]}`)
}

// The scaffold leaves these parity surfaces off on purpose; each entry is a decision to make.
export function editParityGaps(source, names) {
  const start = source.indexOf('const KNOWN_GAPS = {')
  requireAnchor(start >= 0, PATHS.parity, 'const KNOWN_GAPS = {')
  const close = source.indexOf('\n}\n', start)
  requireAnchor(close >= 0, PATHS.parity, 'the end of KNOWN_GAPS')
  const block =
    `\n  // Scaffold defaults from npm run new:module. TODO(new-module): decide each; delete an entry\n` +
    `  // once the module covers it (the stale-gap assertion tells you when).\n` +
    `  ${names.type}: {\n` +
    `    PLAYGROUND_LESSON_TYPES: 'Intentional: scaffold default, no /playground route (meta.playground).',\n` +
    `    MODULE_PANES_TYPES: 'Intentional: scaffold default, the workspace reports no panes.',\n` +
    `    CopyCodePanel: 'Intentional: scaffold default, no copy-code panel.',\n` +
    `    'editorOptions getCodeBlockOptions': 'Intentional: scaffold default, no meta.language.',\n` +
    `    deriveTaskContext:\n` +
    `      'Intentional: read deriveTaskContext().moduleType and the capabilities, not an is<Type> flag.',\n` +
    `  },`
  return insertAt(source, close, block)
}

export function editClickThrough(source, names, label) {
  const start = source.indexOf('const CLICK_THROUGH = {')
  requireAnchor(start >= 0, PATHS.clickThrough, 'const CLICK_THROUGH = {')
  const close = source.indexOf('\n}\n', start)
  requireAnchor(close >= 0, PATHS.clickThrough, 'the end of CLICK_THROUGH')
  const lesson = {
    id: `${names.kebab}-click`,
    title: `${label} click`,
    type: names.type,
  }
  const block =
    `\n\n  // Scaffolded by npm run new:module. TODO(new-module): the module's real primary action\n` +
    `  // (for a 'runtime' module: Run to completion, then Run and Stop — see runThenStop).\n` +
    `  ${names.type}: async () => {\n` +
    `    const { user, session } = renderLesson({\n` +
    `      id: ${JSON.stringify(lesson.id)},\n` +
    `      title: ${JSON.stringify(lesson.title)},\n` +
    `      type: ${JSON.stringify(lesson.type)},\n` +
    `      tasks: [\n` +
    `        {\n` +
    `          id: 1,\n` +
    `          title: 'Say hello',\n` +
    `          starterCode: 'say hello',\n` +
    `          check: { type: 'code_contains', value: 'hello' },\n` +
    `        },\n` +
    `      ],\n` +
    `    })\n` +
    `    await user.click(await screen.findByRole('button', { name: 'Check' }))\n` +
    `    await waitFor(() =>\n` +
    `      expect(session.writeStudentRun).toHaveBeenCalledWith('student-1', {\n` +
    `        code: 'say hello',\n` +
    `        output: '',\n` +
    `        status: 'success',\n` +
    `        checkPassed: true,\n` +
    `      })\n` +
    `    )\n` +
    `  },`
  return insertAt(source, close, block)
}

// ── Docs ─────────────────────────────────────────────────────────────────────

export function editDocsReadme(source, names, label) {
  const anchor = '### [authoring/electronics.md](authoring/electronics.md)'
  const at0 = source.indexOf(anchor)
  requireAnchor(at0 >= 0, PATHS.docsReadme, `"${anchor}"`)
  const next = /^#{2,3} /m.exec(source.slice(at0 + anchor.length))
  const at = next ? at0 + anchor.length + next.index : source.length
  const docPath = `authoring/${names.type}.md`
  const block =
    `### [${docPath}](${docPath})\n` +
    `${label} module code-task authoring reference: task fields, checks, teacher tools, and a complete validated example lesson.\n\n` +
    `**Load when:** authoring or editing a ${label} module code task.\n\n`
  return insertAt(source, at, block)
}

export function editCodebaseMap(source, names, label) {
  const section = source.indexOf('## Lesson Type Modules (`src/modules/`)')
  requireAnchor(section >= 0, PATHS.codebaseMap, 'the "## Lesson Type Modules" section')
  const header = source.indexOf('\n| File | Role |', section)
  requireAnchor(header >= 0, PATHS.codebaseMap, 'the Lesson Type Modules table')
  const tableEnd = /\n(?!\|)/.exec(source.slice(header + 1))
  const at = header + 1 + (tableEnd ? tableEnd.index + 1 : source.length)
  const { type } = names
  const rows =
    `| \`${type}/definition.js\` | ${label} module definition (scaffolded by \`npm run new:module\`): meta, capabilities, lifecycle, storage, wire, checking and work slot |\n` +
    `| \`${type}/index.js\` | ${label} UI half: workspaces, check editor, teacher view, layout |\n` +
    `| \`${type}/StudentWorkspace.jsx\` | ${label} student workspace (edits and checks through \`cs\`) |\n` +
    `| \`${type}/BuilderWorkspace.jsx\` | ${label} Builder editor for the task's starting work |\n` +
    `| \`${type}/CheckEditor.jsx\` | ${label} Builder check list editor |\n` +
    `| \`${type}/TeacherLiveView.jsx\` | ${label} teacher view (TeacherView tabs and sandbox, StudentModal mirror) |\n` +
    `| \`${type}/checks.js\` | ${label} registry \`CHECKS\` (module-owned check types) |\n`
  return insertAt(source, at, rows)
}

export function editValidationErrors(source, names, label) {
  const at = source.indexOf('\n## Checks')
  requireAnchor(at >= 0, PATHS.validationErrors, 'the "## Checks" section')
  const block =
    `\n### ${label} ([${names.type}.md](${names.type}.md))\n\n` +
    `| Message | Meaning | Fix |\n|---|---|---|\n` +
    `| \`Task … has a ${label} check that is not a code check — only code checks are evaluated\` | A check type the ${label} workspace never evaluates (e.g. an output check). | Use a code check such as \`code_contains\`. |\n`
  return insertAt(source, at, block)
}

export function editAgents(source, names, label) {
  const rows = [
    ...source.matchAll(
      /^\| Authoring an? [^|]* lesson [^|]*\| `docs\/authoring\/[a-z0-9_]+\.md` \|\r?\n/gm
    ),
  ]
  requireAnchor(
    rows.length,
    PATHS.agents,
    'an "| Authoring a … lesson | `docs/authoring/<type>.md` |" row'
  )
  const last = rows.at(-1)
  const row = `| Authoring a ${label} lesson (task fields, checks, examples) | \`docs/authoring/${names.type}.md\` |\n`
  return insertAt(source, last.index + last[0].length, row)
}

// `| \`moduleType\` | Required for composed code | … | Workspace …: \`a\`, \`b\`, or \`c\`. |`
export function editLessonSchema(source, names) {
  const row =
    /^(\| `moduleType` \| Required for composed code \|[^\n]*?: )((?:`[a-z0-9_]+`(?:, |,? or ))+`[a-z0-9_]+`)(\.[^\n]*)$/m.exec(
      source
    )
  requireAnchor(row, PATHS.lessonSchema, 'the `moduleType` row')
  const types = [...row[2].matchAll(/`([a-z0-9_]+)`/g)].map((match) => match[1])
  types.push(names.type)
  const list = `${types
    .slice(0, -1)
    .map((type) => `\`${type}\``)
    .join(', ')}, or \`${types.at(-1)}\``
  return source.replace(row[0], `${row[1]}${list}${row[3]}`)
}

// "… each code task selects a workspace module — A, B, …, or Z — but …"
export function editTaskTypes(source, label) {
  const sentence = /(selects a workspace module — )([^—\n]+?)(,? or )([^—\n]+?)( —)/.exec(source)
  requireAnchor(sentence, PATHS.taskTypes, 'the "selects a workspace module — … —" sentence')
  return source.replace(
    sentence[0],
    `${sentence[1]}${sentence[2]}, ${sentence[4]}${sentence[3]}${label}${sentence[5]}`
  )
}

export function editFeatureMatrix(source, label) {
  const header = source.indexOf('| Module | Student experience |')
  requireAnchor(header >= 0, PATHS.featureMatrix, 'the "At a glance" table')
  const tableEnd = /\n(?!\|)/.exec(source.slice(header))
  const at = header + (tableEnd ? tableEnd.index + 1 : source.length)
  // Scaffold behaviour: no playground; lesson sandbox, live view, shared sandbox, stages,
  // checks, carry-through and sharing work through the generic contract.
  const row = `| ${label} | TODO(new-module): describe the workspace | No | Yes | Yes | No | Yes | Yes | No | Yes | Yes | Yes |\n`
  return insertAt(source, at, row)
}

// Works out every file to create or update, without writing anything.
export async function planNewModule({ root = REPO_ROOT, type, label }) {
  const errors = validateRequest(root, { type, label })
  if (errors.length) {
    const error = new Error(errors.join('\n'))
    error.errors = errors
    throw error
  }
  const names = moduleNames(type)
  const templateDir = path.join(root, TEMPLATE_DIR)
  const order = nextOrder(root)
  const files = []

  for (const rel of listTemplateFiles(templateDir, [DOC_TEMPLATE])) {
    const target = `${PATHS.folder(type)}/${rel}`
    const js = /\.(js|jsx|mjs)$/.test(rel)
    const source = readFileSync(path.join(templateDir, rel), 'utf8')
    let content = fillPlaceholders(source, names, label, { js })
    if (rel === 'definition.js') content = content.replace(/\border: 99,/, `order: ${order},`)
    if (js) content = await formatCode(root, target, content)
    files.push({ path: target, action: 'create', content })
  }

  const docSource = readFileSync(path.join(templateDir, DOC_TEMPLATE), 'utf8')
  files.push({
    path: PATHS.doc(type),
    action: 'create',
    content: fillPlaceholders(docSource, names, label, { js: false }),
  })

  const updates = [
    [PATHS.definitions, (s) => editDefinitions(s, names), true],
    [PATHS.registry, (s) => editRegistry(s, names), true],
    [PATHS.checks, (s) => editChecks(s, names), true],
    [PATHS.ratchet, (s) => editRatchet(s, names), true],
    [PATHS.eslint, (s) => editEslint(s, names), true],
    [PATHS.parity, (s) => editParityGaps(s, names), true],
    [PATHS.clickThrough, (s) => editClickThrough(s, names, label), true],
    [PATHS.docsReadme, (s) => editDocsReadme(s, names, label), false],
    [PATHS.codebaseMap, (s) => editCodebaseMap(s, names, label), false],
    [PATHS.validationErrors, (s) => editValidationErrors(s, names, label), false],
    [PATHS.agents, (s) => editAgents(s, names, label), false],
    [PATHS.lessonSchema, (s) => editLessonSchema(s, names), false],
    [PATHS.taskTypes, (s) => editTaskTypes(s, label), false],
    [PATHS.featureMatrix, (s) => editFeatureMatrix(s, label), false],
  ]
  for (const [rel, edit, js] of updates) {
    const before = readFileSync(path.join(root, rel), 'utf8')
    let content = edit(before.replace(/\r\n/g, '\n'))
    if (js) content = await formatCode(root, rel, content)
    files.push({ path: rel, action: 'update', before, content: withLineEndingsOf(before, content) })
  }

  return { type, label, names, order, files, checklist: nextSteps(type, label) }
}

function nextSteps(type, label) {
  return [
    `Search src/modules/${type}/, docs/authoring/${type}.md and the edited test files for TODO(new-module).`,
    `Decide every group in src/modules/${type}/definition.js (meta, capabilities, run, authoring, lifecycle, storage, wire, checking, workSlot); see docs/architecture/lesson-type-modules.md.`,
    `Build the real StudentWorkspace, BuilderWorkspace, CheckEditor and TeacherLiveView (>= 44px controls, keyboard access, docs/UI_STYLE_GUIDE.md); never write to Firebase from them.`,
    `Add module check types to src/modules/${type}/checks.js if the core checks are not enough.`,
    `Update the tests in src/modules/${type}/__tests__/ (keep the StudentView click-through; Run then Stop for a runtime module) and the ${type} entry in ${PATHS.clickThrough}.`,
    `Resolve each ${type} entry in KNOWN_GAPS (${PATHS.parity}): implement the surface or keep an honest reason.`,
    `Rewrite docs/authoring/${type}.md (keep a complete, valid example), the ${label} rows in validation-errors.md and MODULE_FEATURE_MATRIX.md; add a docs/authoring/CHANGELOG.md entry and a docs/FEATURES.md line.`,
    'Run: npm test, npx eslint src cli scripts, npm run format:check, npm run docs:check, npx vite build, node cli/cli.mjs lessons capabilities.',
    'Check in a real browser: student solo + live lesson, teacher tabs, watch, remote reset, sandbox, carry-through, share, composed lesson, Builder preview.',
  ]
}

const USAGE = `Usage: npm run new:module -- <type> "<Label>" [--dry-run]

  <type>      lowercase identifier used as the lesson type, e.g. morse or pixel_art
  "<Label>"   name shown to teachers and students, e.g. "Morse Code"
  --dry-run   print the planned edits without writing anything`

export async function main(argv = process.argv.slice(2), root = REPO_ROOT) {
  let options
  try {
    options = parseArgs(argv)
  } catch (error) {
    console.error(`${error.message}\n\n${USAGE}`)
    return 1
  }
  if (options.help) {
    console.log(USAGE)
    return 0
  }
  let plan
  try {
    plan = await planNewModule({ root, ...options })
  } catch (error) {
    console.error(`Cannot scaffold module:\n${error.message}\n\n${USAGE}`)
    return 1
  }
  console.log(
    `${options.dryRun ? 'Would scaffold' : 'Scaffolding'} module "${plan.type}" (${plan.label}, registry order ${plan.order}):`
  )
  console.log(describePlan(plan))
  if (options.dryRun) {
    console.log('\nDry run: nothing was written.')
    return 0
  }
  try {
    applyPlan(root, plan)
  } catch (error) {
    console.error(error.message)
    return 1
  }
  console.log('\nNext steps:')
  plan.checklist.forEach((step, i) => console.log(`  ${i + 1}. ${step}`))
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().then((code) => {
    process.exitCode = code
  })
}
