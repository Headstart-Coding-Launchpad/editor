// Scaffolds a new activity from src/activities/_template/ (plan step 2.5, "the kit").
//
//   npm run new:activity -- <id> "<Label>" [--category computing|digital_skills|quiz|code] [--dry-run]
//
// Creates src/activities/<id>/ (definition, pure logic, UI, tests), registers it in
// registry.pure.js and registry.js, writes docs/authoring/activities/<id>.md with a valid
// example lesson, and indexes it in docs/README.md, docs/CODEBASE_MAP.md and
// docs/authoring/validation-errors.md, so `npm test`, `npm run docs:check`, lint, format and
// `vite build` pass on the untouched scaffold. It refuses to overwrite anything and writes
// nothing until every planned edit has been worked out. See docs/architecture/activities.md
// ("Adding an activity") and .claude/skills/new-activity/SKILL.md.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import * as prettier from 'prettier'

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const TEMPLATE_DIR = 'src/activities/_template'
export const CATEGORIES = ['computing', 'digital_skills', 'quiz', 'code']
const DOC_TEMPLATE = 'doc.md.tmpl'

// Placeholders used throughout src/activities/_template.
const TOKEN = {
  id: 'template_activity',
  kebab: 'template-activity',
  pascal: 'TemplateActivity',
  label: 'Template Activity',
}

// Ids that would collide with the activity resolver (quiz_<type>, code_arrange, the unknown
// fallback) or are not usable as a JS identifier in the registries.
const RESERVED_IDS = new Set(
  `unknown code_arrange activity abstract arguments await boolean break byte case catch char
  class const continue debugger default delete do double else enum eval export extends false
  final finally float for function goto if implements import in instanceof int interface let
  long native new null package private protected public return short static super switch
  synchronized this throw throws transient true try typeof var void volatile while with yield`.split(
    /\s+/
  )
)

const PATHS = {
  registryPure: 'src/activities/registry.pure.js',
  registryUi: 'src/activities/registry.js',
  docsReadme: 'docs/README.md',
  codebaseMap: 'docs/CODEBASE_MAP.md',
  validationErrors: 'docs/authoring/validation-errors.md',
  doc: (id) => `docs/authoring/activities/${id}.md`,
  folder: (id) => `src/activities/${id}`,
}

export function parseArgs(argv) {
  const options = { category: 'computing', dryRun: false, help: false }
  const positional = []
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--dry-run') options.dryRun = true
    else if (arg === '--help' || arg === '-h') options.help = true
    else if (arg === '--category') options.category = argv[++i]
    else if (arg.startsWith('--category=')) options.category = arg.slice('--category='.length)
    else if (arg.startsWith('--')) throw new Error(`Unknown option ${arg}`)
    else positional.push(arg)
  }
  const [id, label] = positional
  if (positional.length > 2) throw new Error('Too many arguments (quote the label).')
  return { ...options, id, label }
}

export function activityNames(id) {
  const words = id.split('_').filter(Boolean)
  const pascal = words.map((word) => word[0].toUpperCase() + word.slice(1)).join('')
  return {
    id,
    kebab: id.replaceAll('_', '-'),
    pascal,
    camel: pascal[0].toLowerCase() + pascal.slice(1),
  }
}

// Every reason the request can't be scaffolded, checked before anything is written.
export function validateRequest(root, { id, label, category }) {
  const errors = []
  if (!id) errors.push('Missing <id>, e.g. npm run new:activity -- morse "Morse Code"')
  else if (!/^[a-z][a-z0-9_]*$/.test(id) || id.endsWith('_') || id.includes('__')) {
    errors.push(
      `Activity id "${id}" must be a lowercase identifier (letters, digits, single underscores).`
    )
  } else if (RESERVED_IDS.has(id) || id.startsWith('quiz_')) {
    errors.push(`Activity id "${id}" is reserved.`)
  } else if (id === TOKEN.id || id.length > 32) {
    errors.push(`Activity id "${id}" is not allowed (at most 32 characters, not the template id).`)
  }
  if (!label) errors.push('Missing "<Label>" (the name teachers and students see).')
  else if (!/^[A-Za-z0-9][A-Za-z0-9 '&()+,.!?-]{0,39}$/.test(label)) {
    errors.push(
      `Label "${label}" must start with a letter or digit and use only letters, digits, spaces and ' & ( ) + , . ! ? - (at most 40 characters).`
    )
  }
  if (!CATEGORIES.includes(category)) {
    errors.push(`Category "${category}" must be one of ${CATEGORIES.join(', ')}.`)
  }
  if (errors.length || !id) return errors

  if (existsSync(path.join(root, PATHS.folder(id)))) {
    errors.push(`${PATHS.folder(id)}/ already exists. Refusing to overwrite.`)
  }
  if (existsSync(path.join(root, PATHS.doc(id)))) {
    errors.push(`${PATHS.doc(id)} already exists. Refusing to overwrite.`)
  }
  const activitiesDir = path.join(root, 'src/activities')
  for (const entry of readdirSync(activitiesDir, { withFileTypes: true })) {
    const file = path.join(activitiesDir, entry.name, 'definition.js')
    if (!entry.isDirectory() || entry.name === '_template' || !existsSync(file)) continue
    if (new RegExp(`\\bid:\\s*['"]${id}['"]`).test(readFileSync(file, 'utf8'))) {
      errors.push(`src/activities/${entry.name}/definition.js already defines id "${id}".`)
    }
  }
  for (const file of [PATHS.registryPure, PATHS.registryUi]) {
    if (readFileSync(path.join(root, file), 'utf8').includes(`'./${id}/`)) {
      errors.push(`${file} already imports ./${id}/.`)
    }
  }
  return errors
}

function listTemplateFiles(dir, prefix = '') {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) return listTemplateFiles(path.join(dir, entry.name), rel)
    return rel === DOC_TEMPLATE ? [] : [rel]
  })
}

// Replaces the template placeholders. In JS, string literals holding the label are re-quoted
// with JSON.stringify (a label may contain an apostrophe); prettier restores the house quotes.
function fillPlaceholders(text, names, label, { js }) {
  let out = text
  if (js) {
    out = out.replace(/'([^'\n]*)Template Activity([^'\n]*)'/g, (_, before, after) =>
      JSON.stringify(`${before}${label}${after}`)
    )
  }
  return out
    .replaceAll(TOKEN.id, names.id)
    .replaceAll(TOKEN.kebab, names.kebab)
    .replaceAll(TOKEN.pascal, names.pascal)
    .replaceAll(TOKEN.label, label)
}

async function formatCode(root, relPath, source) {
  const filepath = path.join(root, relPath)
  const config = (await prettier.resolveConfig(filepath)) ?? {}
  return prettier.format(source, { ...config, filepath })
}

function lastMatchEnd(text, pattern) {
  let end = -1
  for (const match of text.matchAll(pattern)) end = match.index + match[0].length
  return end
}

function insertAt(text, index, insertion) {
  return text.slice(0, index) + insertion + text.slice(index)
}

function freeIdentifier(source, base, suffix) {
  return new RegExp(`\\b${base}\\b`).test(source) ? `${base}${suffix}` : base
}

function requireAnchor(found, file, what) {
  if (!found) throw new Error(`${file}: could not find ${what}. Add the activity by hand.`)
}

export function editPureRegistry(source, names) {
  const variable = freeIdentifier(source, names.camel, 'Activity')
  const importEnd = lastMatchEnd(source, /^import \w+ from '\.\/[a-z0-9_]+\/definition\.js'\r?\n/gm)
  requireAnchor(importEnd >= 0, PATHS.registryPure, 'the definition imports')
  let out = insertAt(source, importEnd, `import ${variable} from './${names.id}/definition.js'\n`)
  const list = /const ACTIVITIES = \[([^\]]*)\]/.exec(out)
  requireAnchor(list, PATHS.registryPure, 'const ACTIVITIES = [...]')
  const entries = list[1]
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
  const fallback = entries.indexOf('unknown')
  entries.splice(fallback === -1 ? entries.length : fallback, 0, variable)
  // Keep the list's existing layout: one entry per line once it has outgrown a single line.
  const listed = list[1].includes('\n')
    ? `const ACTIVITIES = [\n${entries.map((entry) => `  ${entry},`).join('\n')}\n]`
    : `const ACTIVITIES = [${entries.join(', ')}]`
  out = out.replace(list[0], listed)
  return out
}

export function editUiRegistry(source, names) {
  const variable = freeIdentifier(source, `${names.camel}Ui`, 'Activity')
  const importEnd = lastMatchEnd(source, /^import \w+ from '\.\/[a-z0-9_]+\/ui\.jsx'\r?\n/gm)
  requireAnchor(importEnd >= 0, PATHS.registryUi, 'the ui.jsx imports')
  let out = insertAt(source, importEnd, `import ${variable} from './${names.id}/ui.jsx'\n`)
  const map = /(export const ACTIVITY_UIS = Object\.freeze\(\{)([\s\S]*?)(\r?\n\}\))/.exec(out)
  requireAnchor(map, PATHS.registryUi, 'export const ACTIVITY_UIS = Object.freeze({ ... })')
  const body = map[2].replace(/,?\s*$/, ',')
  out = out.replace(map[0], `${map[1]}${body}\n  ${names.id}: ${variable},${map[3]}`)
  return out
}

export function editDocsReadme(source, names, label) {
  const headings = [...source.matchAll(/^### \[authoring\/activities\/[^\]]+\]/gm)]
  requireAnchor(headings.length, PATHS.docsReadme, 'an "### [authoring/activities/…]" entry')
  const last = headings.at(-1)
  const next = /^#{2,3} /m.exec(source.slice(last.index + last[0].length))
  const at = next ? last.index + last[0].length + next.index : source.length
  const docPath = `authoring/activities/${names.id}.md`
  const block =
    `### [${docPath}](${docPath})\n` +
    `${label} activity reference: task and item fields, marking and hints, teacher tools, and a complete validated example lesson.\n\n` +
    `**Load when:** authoring or editing a ${label} activity task.\n\n`
  return insertAt(source, at, block)
}

export function editCodebaseMap(source, names, label) {
  const section = source.indexOf('## Activities (`src/activities/`)')
  requireAnchor(section >= 0, PATHS.codebaseMap, 'the "## Activities (`src/activities/`)" section')
  const header = source.indexOf('\n| File | Role |', section)
  requireAnchor(header >= 0, PATHS.codebaseMap, 'the Activities table')
  const tableEnd = /\n(?!\|)/.exec(source.slice(header + 1))
  const at = header + 1 + (tableEnd ? tableEnd.index + 1 : source.length)
  const { id } = names
  const rows =
    `| \`${id}/${id}.js\` | Pure ${label} activity logic: shared authoring validation, solutions, per-item grading with child-friendly hints, whole-task progress |\n` +
    `| \`${id}/definition.js\` | ${label} activity definition wrapping \`${id}.js\`: default task, validation, state, change classification, grading, progress, card summary, print |\n` +
    `| \`${id}/ui.jsx\` | ${label} StudentView (controlled by \`ActivityHost\`) |\n`
  return insertAt(source, at, rows)
}

export function editValidationErrors(source, names, label) {
  const section = source.indexOf('\n## Activity tasks')
  requireAnchor(section >= 0, PATHS.validationErrors, 'the "## Activity tasks" section')
  const next = source.indexOf('\n## ', section + 1)
  const at = next === -1 ? source.length : next + 1
  const block =
    `### ${label} ([activities/${names.id}.md](activities/${names.id}.md))\n\n` +
    `| Message | Meaning | Fix |\n|---|---|---|\n` +
    `| \`Task …: ${names.id} task needs at least one item.\` | \`items\` is empty. | Add at least one item. |\n` +
    `| \`Task … item …: prompt is required.\` | An item has no \`prompt\`. | Add the question to show the student. |\n` +
    `| \`Task … item …: answer is required.\` | An item has no \`answer\`. | Add the expected answer. |\n\n`
  return insertAt(source, at, block)
}

// Works out every file to create or update, without writing anything.
export async function planNewActivity({ root = REPO_ROOT, id, label, category = 'computing' }) {
  const errors = validateRequest(root, { id, label, category })
  if (errors.length) {
    const error = new Error(errors.join('\n'))
    error.errors = errors
    throw error
  }
  const names = activityNames(id)
  const templateDir = path.join(root, TEMPLATE_DIR)
  const files = []

  for (const rel of listTemplateFiles(templateDir)) {
    const target = `${PATHS.folder(id)}/${rel.replaceAll(TOKEN.id, id)}`
    const js = /\.(js|jsx|mjs)$/.test(rel)
    const source = readFileSync(path.join(templateDir, rel), 'utf8')
    let content = fillPlaceholders(source, names, label, { js })
    if (rel === 'definition.js') {
      content = content.replace(/category: 'computing'/, `category: '${category}'`)
    }
    if (js) content = await formatCode(root, target, content)
    files.push({ path: target, action: 'create', content })
  }

  const docSource = readFileSync(path.join(templateDir, DOC_TEMPLATE), 'utf8')
  const doc = fillPlaceholders(docSource, names, label, { js: false })
  files.push({ path: PATHS.doc(id), action: 'create', content: doc })

  const read = (rel) => readFileSync(path.join(root, rel), 'utf8')
  const updates = [
    [PATHS.registryPure, (s) => editPureRegistry(s, names), true],
    [PATHS.registryUi, (s) => editUiRegistry(s, names), true],
    [PATHS.docsReadme, (s) => editDocsReadme(s, names, label), false],
    [PATHS.codebaseMap, (s) => editCodebaseMap(s, names, label), false],
    [PATHS.validationErrors, (s) => editValidationErrors(s, names, label), false],
  ]
  for (const [rel, edit, js] of updates) {
    const before = read(rel)
    let content = edit(before)
    if (js) content = await formatCode(root, rel, content)
    // Keep the file's own line endings (a Windows checkout may have CRLF).
    content = content.replace(/\r?\n/g, before.includes('\r\n') ? '\r\n' : '\n')
    files.push({ path: rel, action: 'update', before, content })
  }

  return { id, label, category, names, files, checklist: nextSteps(id, label) }
}

export function applyPlan(root, plan) {
  // Re-check just before writing so a second run can never overwrite the first.
  for (const file of plan.files) {
    if (file.action === 'create' && existsSync(path.join(root, file.path))) {
      throw new Error(`${file.path} already exists. Refusing to overwrite.`)
    }
    if (
      file.action === 'update' &&
      readFileSync(path.join(root, file.path), 'utf8') !== file.before
    ) {
      throw new Error(`${file.path} changed while planning. Run the command again.`)
    }
  }
  for (const file of plan.files) {
    const target = path.join(root, file.path)
    mkdirSync(path.dirname(target), { recursive: true })
    writeFileSync(target, file.content)
  }
}

function addedLines(before, after) {
  const old = new Set(before.split(/\r?\n/))
  return after.split(/\r?\n/).filter((line) => line.trim() && !old.has(line))
}

export function describePlan(plan) {
  const lines = []
  for (const file of plan.files) {
    if (file.action === 'create') {
      lines.push(`  create  ${file.path} (${file.content.split('\n').length} lines)`)
    } else {
      lines.push(`  update  ${file.path}`)
      for (const line of addedLines(file.before, file.content)) {
        lines.push(`            + ${line.length > 110 ? `${line.slice(0, 107)}...` : line}`)
      }
    }
  }
  return lines.join('\n')
}

function nextSteps(id, label) {
  return [
    `Search src/activities/${id}/ and docs/authoring/activities/${id}.md for TODO(new-activity).`,
    `Replace the starter logic in src/activities/${id}/${id}.js (fields, validateTask, grading, hints for ages 8-14).`,
    `Set requires / touchFallback, icon and description in src/activities/${id}/definition.js; classify per-keystroke/pointer changes as 'continuous'.`,
    `Build the real StudentView in src/activities/${id}/ui.jsx (>= 44px controls, keyboard access, act- CSS, docs/UI_STYLE_GUIDE.md).`,
    `Update the tests in src/activities/${id}/__tests__/, including the StudentView click-through (studentView.test.jsx).`,
    `Rewrite docs/authoring/activities/${id}.md (keep a complete, valid example) and the ${label} rows in docs/authoring/validation-errors.md.`,
    'Add a docs/authoring/CHANGELOG.md entry and update the CODEBASE_MAP / docs/README.md descriptions if they changed.',
    'Run: npm test, npm run lint, npm run format:check, npm run docs:check, npx vite build, node cli/cli.mjs lessons capabilities.',
    'Check pointer, drag, keyboard and touch behaviour, teacher view/edit/reset and Go Live in a real browser.',
  ]
}

const USAGE = `Usage: npm run new:activity -- <id> "<Label>" [--category ${CATEGORIES.join('|')}] [--dry-run]

  <id>        lowercase identifier used as activityType, e.g. morse or pixel_art
  "<Label>"   name shown to teachers and students, e.g. "Morse Code"
  --category  activity gallery group (default computing)
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
    plan = await planNewActivity({ root, ...options })
  } catch (error) {
    console.error(`Cannot scaffold activity:\n${error.message}\n\n${USAGE}`)
    return 1
  }
  console.log(
    `${options.dryRun ? 'Would scaffold' : 'Scaffolding'} activity "${plan.id}" (${plan.label}, ${plan.category}):`
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
