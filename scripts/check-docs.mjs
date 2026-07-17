import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const failures = []

const ignoredDirs = new Set(['.git', 'node_modules', 'dist', 'playwright-report', 'test-results'])

function walk(dir, predicate = () => true) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full, predicate))
    else if (predicate(full)) out.push(full)
  }
  return out
}

function rel(file) {
  return path.relative(root, file).replaceAll(path.sep, '/')
}

function read(file) {
  return readFileSync(file, 'utf8')
}

function fail(message) {
  failures.push(message)
}

function isCodebaseMapMentioned(mapText, normalized) {
  const parts = normalized.split('/')
  const suffixes = [
    normalized,
    parts.slice(1).join('/'),
    parts.slice(2).join('/'),
    path.basename(normalized),
  ].filter(Boolean)

  return suffixes.some(suffix => mapText.includes(suffix) || mapText.includes(`\`${suffix}\``))
}

const markdownFiles = walk(path.join(root, 'docs'), file => file.endsWith('.md'))
const rootMarkdownFiles = ['AGENTS.md', 'README.md']
  .map(file => path.join(root, file))
  .filter(file => existsSync(file))
const checkedMarkdownFiles = [...markdownFiles, ...rootMarkdownFiles]

for (const file of checkedMarkdownFiles) {
  const text = read(file)
  const linkPattern = /(?<!!)\[[^\]]+\]\(([^)]+)\)/g
  for (const match of text.matchAll(linkPattern)) {
    const rawTarget = match[1].trim()
    if (!rawTarget || rawTarget.startsWith('#')) continue
    if (/^[a-z]+:/i.test(rawTarget)) continue
    const target = rawTarget.split('#')[0]
    if (!target || target.startsWith('mailto:')) continue
    const resolved = path.resolve(path.dirname(file), decodeURIComponent(target))
    if (!existsSync(resolved)) {
      fail(`${rel(file)} links to missing target: ${rawTarget}`)
    }
  }
}

const docsReadme = path.join(root, 'docs', 'README.md')
if (existsSync(docsReadme)) {
  const indexText = read(docsReadme)
  for (const file of markdownFiles) {
    const relativeToDocs = path.relative(path.join(root, 'docs'), file).replaceAll(path.sep, '/')
    if (relativeToDocs === 'README.md') continue
    if (!indexText.includes(relativeToDocs)) {
      fail(`docs/README.md does not index ${relativeToDocs}`)
    }
  }
}

const codebaseMap = path.join(root, 'docs', 'CODEBASE_MAP.md')
if (existsSync(codebaseMap)) {
  const mapText = read(codebaseMap)
  const sourceRoots = ['src', 'cli', 'functions', 'scripts']
  const sourceFiles = sourceRoots
    .map(dir => path.join(root, dir))
    .filter(dir => existsSync(dir) && statSync(dir).isDirectory())
    .flatMap(dir => walk(dir, file => {
      const normalized = rel(file)
      if (normalized.includes('/__tests__/')) return false
      if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(normalized)) return false
      if (normalized.endsWith('package-lock.json')) return false
      if (/firebase-adminsdk|service-account|credentials/i.test(normalized)) return false
      return /\.(js|jsx|mjs|json)$/.test(normalized)
    }))

  for (const file of sourceFiles) {
    const normalized = rel(file)
    if (!isCodebaseMapMentioned(mapText, normalized)) {
      fail(`docs/CODEBASE_MAP.md does not mention ${normalized}`)
    }
  }
}

if (failures.length) {
  console.error('Documentation checks failed:')
  for (const message of failures) console.error(`- ${message}`)
  process.exit(1)
}

console.log(`Documentation checks passed (${checkedMarkdownFiles.length} markdown files checked).`)
