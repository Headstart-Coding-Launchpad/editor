// Scaffolds a new built-in live badge (docs/architecture/live-badges-plan.md, "Adding a new badge").
//
//   npm run new:badge -- <id> --emoji <emoji> [--title "<Title>"] [--blurb "<Blurb>"] [--tutor-only] [--dry-run]
//
// Creates src/badges/definitions/<id>.js (a rule stub with two examples, or a tutor-only badge
// with --tutor-only), registers it in src/badges/registry.pure.js (registry.js re-exports it), and
// adds a TODO row to the badge table in docs/authoring/badges.md and the file to
// docs/CODEBASE_MAP.md, so `npm test` (the generic
// examples test runs the stub's examples), `npm run docs:check`, lint and format pass on the
// untouched scaffold. It refuses a taken id or emoji and writes nothing until every planned edit has
// been worked out. A manual-only badge needs no code: add it in Admin Portal → Badges. See
// .claude/skills/new-badge/SKILL.md.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  applyPlan,
  describePlan,
  formatCode,
  freeIdentifier,
  insertAt,
  lastMatchEnd,
  requireAnchor as requireAnchorFor,
  withLineEndingsOf,
} from './scaffold-utils.mjs'

export { applyPlan, describePlan }

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const PATHS = {
  definitions: 'src/badges/definitions',
  definition: (id) => `src/badges/definitions/${id}.js`,
  registryPure: 'src/badges/registry.pure.js',
  badgesDoc: 'docs/authoring/badges.md',
  codebaseMap: 'docs/CODEBASE_MAP.md',
}

const RESERVED_IDS = new Set(['badge', 'badges', 'unknown', 'catalogue'])

export function parseArgs(argv) {
  const options = { tutorOnly: false, dryRun: false, help: false }
  const positional = []
  const valueOf = (arg, name, i) => {
    if (arg === `--${name}`) return { value: argv[i + 1], skip: 1 }
    return { value: arg.slice(`--${name}=`.length), skip: 0 }
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const named = /^--(emoji|title|blurb)(=|$)/.exec(arg)
    if (arg === '--dry-run') options.dryRun = true
    else if (arg === '--tutor-only') options.tutorOnly = true
    else if (arg === '--help' || arg === '-h') options.help = true
    else if (named) {
      const { value, skip } = valueOf(arg, named[1], i)
      options[named[1]] = value
      i += skip
    } else if (arg.startsWith('--')) throw new Error(`Unknown option ${arg}`)
    else positional.push(arg)
  }
  if (positional.length > 1) throw new Error('Too many arguments (quote the title and blurb).')
  return { ...options, id: positional[0] }
}

export function badgeNames(id) {
  const words = id.split('_').filter(Boolean)
  const pascal = words.map((word) => word[0].toUpperCase() + word.slice(1)).join('')
  return {
    id,
    camel: pascal[0].toLowerCase() + pascal.slice(1),
    title: words.map((word) => word[0].toUpperCase() + word.slice(1)).join(' '),
  }
}

// Same comparison as src/badges/catalogue.js emojiKey: variation selectors don't count.
const emojiKey = (emoji) =>
  String(emoji ?? '')
    .trim()
    .replace(/[︎️]/g, '')

// Every registered definition: { id, variable, file, emoji, ruleBacked }, in registry order.
export function readRegistry(root) {
  const source = readFileSync(path.join(root, PATHS.registryPure), 'utf8')
  const imports = new Map(
    [...source.matchAll(/^import (\w+) from '\.\/definitions\/([a-z0-9_]+)\.js'/gm)].map((m) => [
      m[1],
      m[2],
    ])
  )
  const list = /const BADGES = \[([^\]]*)\]/.exec(source)
  const variables = (list?.[1] ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
  return variables.map((variable) => {
    const id = imports.get(variable)
    const file = path.join(root, PATHS.definition(id))
    const text = existsSync(file) ? readFileSync(file, 'utf8') : ''
    return {
      id,
      variable,
      emoji: /\bemoji:\s*(['"])(.*?)\1/.exec(text)?.[2] ?? null,
      title: /\btitle:\s*(['"])(.*?)\1/.exec(text)?.[2] ?? id,
      ruleBacked: /^\s*rule:/m.test(text),
    }
  })
}

// Every reason the request can't be scaffolded, checked before anything is written.
export function validateRequest(root, { id, emoji, title, blurb }) {
  const errors = []
  if (!id) errors.push('Missing <id>, e.g. npm run new:badge -- tidy_coder --emoji 🧹')
  else if (!/^[a-z][a-z0-9_]*$/.test(id) || id.endsWith('_') || id.includes('__')) {
    errors.push(
      `Badge id "${id}" must be a lowercase identifier (letters, digits, single underscores).`
    )
  } else if (RESERVED_IDS.has(id) || id.length > 32) {
    errors.push(`Badge id "${id}" is not allowed (reserved, or longer than 32 characters).`)
  }
  if (!emoji) errors.push('Missing --emoji (unique across every badge, e.g. --emoji 🧹).')
  else if (/\s/.test(emoji) || emoji.length > 16 || !/\p{Extended_Pictographic}/u.test(emoji)) {
    errors.push(`--emoji "${emoji}" must be a single emoji.`)
  }
  if (title != null && !/^[A-Za-z0-9][A-Za-z0-9 '&()+,.!?-]{0,39}$/.test(title)) {
    errors.push(
      `Title "${title}" must start with a letter or digit and use only letters, digits, spaces and ' & ( ) + , . ! ? - (at most 40 characters).`
    )
  }
  if (blurb != null && (!blurb.trim() || blurb.length > 120 || /[\r\n`]/.test(blurb))) {
    errors.push('--blurb must be one line of at most 120 characters (no backticks).')
  }
  if (errors.length || !id) return errors

  if (existsSync(path.join(root, PATHS.definition(id)))) {
    errors.push(`${PATHS.definition(id)} already exists. Refusing to overwrite.`)
  }
  const registry = readRegistry(root)
  if (registry.some((badge) => badge.id === id)) {
    errors.push(`${PATHS.registryPure} already registers "${id}".`)
  }
  for (const file of readdirSync(path.join(root, PATHS.definitions))) {
    if (!file.endsWith('.js') || file === `${id}.js`) continue
    const text = readFileSync(path.join(root, PATHS.definitions, file), 'utf8')
    if (new RegExp(`\\bid:\\s*['"]${id}['"]`).test(text)) {
      errors.push(`${PATHS.definitions}/${file} already defines id "${id}".`)
    }
  }
  const clash = emoji && registry.find((badge) => emojiKey(badge.emoji) === emojiKey(emoji))
  if (clash) errors.push(`${emoji} is already the ${clash.title} badge (${clash.id}).`)
  return errors
}

const TODO_BLURB = 'TODO(new-badge): one short line for the student card.'

function definitionSource({ id, emoji, title, blurb, tutorOnly }) {
  const q = (value) => JSON.stringify(value)
  if (tutorOnly) {
    return `import { defineBadge } from '../defineBadge.js'

// Tutor-only: awarded by hand, never suggested.
export default defineBadge({
  id: ${q(id)},
  emoji: ${q(emoji)},
  title: ${q(title)},
  blurb: ${q(blurb ?? TODO_BLURB)},
})
`
  }
  return `import { defineBadge } from '../defineBadge.js'
import { anySignal } from '../rules.js'
import { shortcutEvent } from '../timeline.js'

// TODO(new-badge): the rule below is a stub that never fires in a real lesson (it waits for a
// shortcut id nothing records). Swap in a src/badges/rules.js helper (firstInClassOnPattern,
// realPassOnPattern, errorThenPass, uniqueFailsThenPass, anySignal, firstEditWithin,
// quizGroupFirstTry) or add one there, then rewrite ruleText, reasonText and the examples. A rule
// may only read timeline events (src/badges/timeline.js); a new signal needs its own data-model
// sign-off.
const STUB_SIGNAL = 'new_badge_stub'

export default defineBadge({
  id: ${q(id)},
  emoji: ${q(emoji)},
  title: ${q(title)},
  blurb: ${q(blurb ?? TODO_BLURB)},
  ruleText: 'TODO(new-badge): the exact rule, shown when a tutor hovers the badge.',
  rule: anySignal('shortcut', { filter: (event) => event.shortcutId === STUB_SIGNAL }),
  reasonText: ({ taskTitle }) => \`TODO(new-badge): the reason, e.g. “\${taskTitle}”\`,
  // Only badges whose rule is high-confidence should be auto-awardable.
  autoAwardable: false,
  examples: [
    {
      name: 'the signal on a task suggests the badge',
      timelines: { alex: [shortcutEvent({ shortcutId: STUB_SIGNAL, taskId: 't4', at: 10 })] },
      expect: [['alex', 't4']],
    },
    {
      name: 'another signal does not',
      timelines: { alex: [shortcutEvent({ shortcutId: 'run', taskId: 't4', at: 10 })] },
      expect: [],
    },
  ],
})
`
}

function requireAnchor(found, file, what) {
  requireAnchorFor(found, file, what, 'the badge')
}

// Adds the import and the list entry: a rule-backed badge after the last rule-backed one, a
// tutor-only badge at the end (the picker lists rule-backed badges first).
export function editPureRegistry(source, names, { tutorOnly, registry }) {
  const variable = freeIdentifier(source, names.camel, 'Badge')
  const importEnd = lastMatchEnd(
    source,
    /^import \w+ from '\.\/definitions\/[a-z0-9_]+\.js'\r?\n/gm
  )
  requireAnchor(importEnd >= 0, PATHS.registryPure, 'the definition imports')
  let out = insertAt(source, importEnd, `import ${variable} from './definitions/${names.id}.js'\n`)
  const list = /const BADGES = \[([^\]]*)\]/.exec(out)
  requireAnchor(list, PATHS.registryPure, 'const BADGES = [...]')
  const entries = list[1]
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
  const lastRuleBacked = registry.map((badge) => badge.ruleBacked).lastIndexOf(true)
  const at = tutorOnly || lastRuleBacked === -1 ? entries.length : lastRuleBacked + 1
  entries.splice(at, 0, variable)
  out = out.replace(list[0], `const BADGES = [\n${entries.map((e) => `  ${e},`).join('\n')}\n]`)
  return out
}

// A TODO row in the "## The badges" table: before the tutor-only row for a rule-backed badge,
// at the end of the table for a tutor-only one.
export function editBadgesDoc(source, { id, emoji, title, tutorOnly }) {
  const section = source.indexOf('\n## The badges')
  requireAnchor(section >= 0, PATHS.badgesDoc, 'the "## The badges" section')
  const header = source.indexOf('\n| Badge | id |', section)
  requireAnchor(header >= 0, PATHS.badgesDoc, 'the badge table')
  const rest = source.slice(header + 1)
  const tableLength = /\n(?!\|)/.exec(rest)?.index ?? rest.length
  const table = rest.slice(0, tableLength + 1)
  const row = tutorOnly
    ? `| ${emoji} ${title} | \`${id}\` | Tutor-only: never suggested | – |\n`
    : `| ${emoji} ${title} | \`${id}\` | TODO(new-badge): when it is suggested | – |\n`
  const tutorRow = /^\|[^\n]*\| Tutor-only: never suggested \|/m.exec(table)
  const at = header + 1 + (!tutorOnly && tutorRow ? tutorRow.index : tableLength + 1)
  return insertAt(source, at, row)
}

// Names the new file in the CODEBASE_MAP "definitions/*.js" row (npm run docs:check needs every
// source file mentioned): with the rule-backed files, or at the end of the tutor-only ones.
export function editCodebaseMap(source, { id, tutorOnly }) {
  const row = /^\| `definitions\/\*\.js` \|[^\n]*$/m.exec(source)
  requireAnchor(row, PATHS.codebaseMap, 'the "| `definitions/*.js` |" row')
  const file = `\`${id}.js\``
  let line = row[0]
  if (tutorOnly) {
    requireAnchor(/`\) \|\s*$/.test(line), PATHS.codebaseMap, 'the end of the definitions list')
    line = line.replace(/`\) \|(\s*)$/, `\`, ${file}) |$1`)
  } else {
    requireAnchor(line.includes(', and tutor-only '), PATHS.codebaseMap, '", and tutor-only"')
    line = line.replace(', and tutor-only ', `, ${file}, and tutor-only `)
  }
  return source.replace(row[0], line)
}

// Works out every file to create or update, without writing anything.
export async function planNewBadge({ root = REPO_ROOT, id, emoji, title, blurb, tutorOnly }) {
  const errors = validateRequest(root, { id, emoji, title, blurb })
  if (errors.length) {
    const error = new Error(errors.join('\n'))
    error.errors = errors
    throw error
  }
  const names = badgeNames(id)
  const finalTitle = title ?? names.title
  const registry = readRegistry(root)
  const files = []

  const target = PATHS.definition(id)
  const definition = definitionSource({ id, emoji, title: finalTitle, blurb, tutorOnly })
  files.push({
    path: target,
    action: 'create',
    content: await formatCode(root, target, definition),
  })

  const read = (rel) => readFileSync(path.join(root, rel), 'utf8')
  const updates = [
    [PATHS.registryPure, (s) => editPureRegistry(s, names, { tutorOnly, registry }), true],
    [PATHS.badgesDoc, (s) => editBadgesDoc(s, { id, emoji, title: finalTitle, tutorOnly }), false],
    [PATHS.codebaseMap, (s) => editCodebaseMap(s, { id, tutorOnly }), false],
  ]
  for (const [rel, edit, js] of updates) {
    const before = read(rel)
    let content = edit(before)
    if (js) content = await formatCode(root, rel, content)
    content = withLineEndingsOf(before, content)
    files.push({ path: rel, action: 'update', before, content })
  }

  return {
    id,
    emoji,
    title: finalTitle,
    tutorOnly: !!tutorOnly,
    files,
    checklist: nextSteps(id, { tutorOnly }),
  }
}

function nextSteps(id, { tutorOnly }) {
  const steps = tutorOnly
    ? [`Write the blurb in src/badges/definitions/${id}.js if it still says TODO(new-badge).`]
    : [
        `Replace the stub rule, ruleText, reasonText and examples in src/badges/definitions/${id}.js (search TODO(new-badge)).`,
        'Give the examples the edge cases: a pass that is not real, a removed task, a sandbox event if the rule reads one.',
        'Decide autoAwardable (high-confidence rules only) and, for a pattern rule, whether badgeHints.suggest may name it.',
      ]
  return [
    ...steps,
    `Fill in the ${id} row in docs/authoring/badges.md (and the pattern and module tables if they change).`,
    'Update the hard-coded lists in src/badges/__tests__/badgeRegistry.test.js if the badge joins them (tutor-only, auto-awardable, hintable).',
    'Add a docs/authoring/CHANGELOG.md entry if lessons can now tune or hint the badge.',
    'Run: npm test, npm run lint, npm run format:check, npm run docs:check, npx vite build, node cli/cli.mjs lessons capabilities.',
    'Check the suggestion, award, celebration and class toast in a real browser with a teacher and student tab.',
  ]
}

const USAGE = `Usage: npm run new:badge -- <id> --emoji <emoji> [--title "<Title>"] [--blurb "<Blurb>"] [--tutor-only] [--dry-run]

  <id>          lowercase identifier stored in decisions and reports, e.g. tidy_coder
  --emoji       the badge's emoji, unique across every badge
  --title       the name students and tutors see (default: from the id, e.g. "Tidy Coder")
  --blurb       one line for the student's card (default: a TODO)
  --tutor-only  no rule: the tutor awards it by hand and it is never suggested
  --dry-run     print the planned edits without writing anything

A manual-only badge needs no code or deploy: add it in Admin Portal → Badges.`

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
    plan = await planNewBadge({ root, ...options })
  } catch (error) {
    console.error(`Cannot scaffold badge:\n${error.message}\n\n${USAGE}`)
    return 1
  }
  console.log(
    `${options.dryRun ? 'Would scaffold' : 'Scaffolding'} ${plan.tutorOnly ? 'tutor-only' : 'rule-backed'} badge ${plan.emoji} ${plan.title} (${plan.id}):`
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
