#!/usr/bin/env node
// Writes LaunchPad Dev's feed for the HSC Board (`hsc board`): authoring requests, features and
// bugs in flight, and recent merges grouped by release day. Format:
// HSC Hub\Plans\Tracker Feed Format.md. Run with `npm run board:feed` after merging, pushing or
// changing a request's status.
//
//   node scripts/board-feed.mjs [--out <file>] [--dry-run]
//
// The default output is ../../HSC Hub/Feeds/LaunchPad Dev.json from the repo root, written
// atomically (.tmp, then rename). --dry-run prints the feed instead.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readAuthoringRequests } from '../cli/authoring-requests.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const AGENT = 'LaunchPad Dev'
const AREA = 'launchpad'
const DAY_MS = 24 * 60 * 60 * 1000
export const RECENT_DONE_DAYS = 14
// An unmerged branch with no commit for this long is treated as abandoned, not in flight.
export const STALE_BRANCH_DAYS = 30
// One with a commit this recent is in progress; older ones show as paused.
export const ACTIVE_BRANCH_DAYS = 7
const BRANCH_KINDS = { feature: 'feature', refactor: 'feature', test: 'feature', fix: 'bug' }
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const REQUEST_STATES = {
  open: 'queued',
  proposed: 'queued',
  approved: 'queued',
  planned: 'in_progress',
  shipped: 'done',
  declined: 'done',
  'needs-info': 'blocked',
}

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim()
}

function isoDay(iso) {
  return iso.slice(0, 10)
}

function prettyDay(day) {
  const [y, m, d] = day.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]} ${y}`
}

function isRecent(iso, now, days) {
  return now - new Date(iso).getTime() <= days * DAY_MS
}

// The word before the first `/` decides the kind; other branches (archive/…) are ignored.
export function branchKind(branch) {
  return BRANCH_KINDS[branch.split('/')[0]] ?? null
}

// "feature/scratch-svg-export" → "Scratch svg export"
export function branchTitle(branch) {
  const words = branch.split('/').slice(1).join(' ').replace(/[-_]+/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function requestState(status) {
  return REQUEST_STATES[String(status ?? '').toLowerCase()] ?? 'queued'
}

// One item per request: not-done ones always, done ones only if they changed recently.
export function requestItems(requests, { now, releaseDays = new Set(), linkFor = (r) => r.file }) {
  const items = []
  for (const request of requests) {
    const state = requestState(request.status)
    if (state === 'done' && !isRecent(request.updated, now, RECENT_DONE_DAYS)) continue
    const day = isoDay(request.updated)
    items.push({
      id: `request:${request.file.split('/').pop().replace(/\.md$/, '')}`,
      area: AREA,
      ...(state === 'done' && releaseDays.has(day) ? { group: `release:${day}` } : {}),
      title: request.title || request.file,
      stage: request.status || 'open',
      state,
      updated: request.updated,
      link: linkFor(request),
      ...(request.kind ? { note: `Request · ${request.kind}` } : {}),
      ...(state === 'blocked' ? { needsRyan: true } : {}),
    })
  }
  return items
}

// A merge commit's subject → { branch?, title?, kind? }. Handles:
//   Merge branch 'feature/x'              → branch only (title from the branch name)
//   Merge fix/x: what it fixes            → branch plus title
//   Merge peer help and the roster        → title only; starting with "fix" makes it a bug
export function parseMergeSubject(subject) {
  const quoted = /^Merge branch '([^']+)'/.exec(subject)
  if (quoted) return { branch: quoted[1] }
  const named = /^Merge ([\w.-]+\/[\w./-]+)(?::\s*(.+))?$/.exec(subject)
  if (named) return { branch: named[1], ...(named[2] ? { title: capitalise(named[2]) } : {}) }
  const text = /^Merge (.+)$/.exec(subject)?.[1]
  if (!text) return {}
  return { title: capitalise(text), kind: /^fix/i.test(text) ? 'bug' : 'feature' }
}

function capitalise(text) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

// merges: [{ branch?, title?, kind?, sha, date }] from main's first-parent merge commits.
export function mergeItems(merges, { now, commitUrl = () => undefined }) {
  const seen = new Set()
  const items = []
  for (const merge of merges) {
    const kind = merge.branch ? branchKind(merge.branch) : merge.kind
    if (!kind || !isRecent(merge.date, now, RECENT_DONE_DAYS)) continue
    const id = `${kind}:${merge.branch ?? merge.sha.slice(0, 7)}`
    if (seen.has(id)) continue
    seen.add(id)
    const link = commitUrl(merge.sha)
    items.push({
      id,
      area: AREA,
      group: `release:${isoDay(merge.date)}`,
      title: merge.title ?? branchTitle(merge.branch),
      stage: 'shipped',
      state: 'done',
      updated: merge.date,
      ...(link ? { link } : {}),
      note: `Merged ${merge.sha.slice(0, 7)}`,
    })
  }
  return items
}

// branches: [{ branch, date, ahead, landed }]. `landed` means its work already reached main by
// another route (its tip commit's subject is on main), so it isn't in flight.
export function branchItems(branches, { now, skip = new Set() }) {
  const items = []
  for (const b of branches) {
    const kind = branchKind(b.branch)
    if (!kind || b.landed || b.ahead === 0 || skip.has(`${kind}:${b.branch}`)) continue
    if (!isRecent(b.date, now, STALE_BRANCH_DAYS)) continue
    const active = isRecent(b.date, now, ACTIVE_BRANCH_DAYS)
    items.push({
      id: `${kind}:${b.branch}`,
      area: AREA,
      title: branchTitle(b.branch),
      stage: active ? 'in development' : 'paused',
      state: active ? 'in_progress' : 'queued',
      updated: b.date,
      note: `${b.ahead} commit${b.ahead === 1 ? '' : 's'} on ${b.branch}, not merged`,
    })
  }
  return items
}

// releases: [{ day, build }] newest first; counts come from the items in each group.
export function releaseGroups(releases, items, version) {
  return releases
    .map(({ day, build }) => {
      const count = items.filter((item) => item.group === `release:${day}`).length
      return {
        id: `release:${day}`,
        area: AREA,
        title: `Release ${prettyDay(day)} · v${version}.${build}`,
        summary: `${count} change${count === 1 ? '' : 's'} shipped`,
        count,
      }
    })
    .filter((group) => group.count > 0)
    .map(({ count: _count, ...group }) => group)
}

export function buildFeed({
  requests,
  merges,
  branches,
  releases,
  version,
  now,
  commitUrl,
  linkFor,
}) {
  const releaseDays = new Set(releases.map((r) => r.day))
  const merged = mergeItems(merges, { now, commitUrl })
  const items = [
    ...branchItems(branches, { now, skip: new Set(merged.map((i) => i.id)) }),
    ...requestItems(requests, { now, releaseDays, linkFor }),
    ...merged,
  ]
  items.sort((a, b) => b.updated.localeCompare(a.updated))
  return {
    agent: AGENT,
    updated: new Date(now).toISOString(),
    groups: releaseGroups(releases, items, version),
    items,
  }
}

// ── Reading the repo ────────────────────────────────────────────────────────

function readMerges(now) {
  const since = new Date(now - RECENT_DONE_DAYS * DAY_MS).toISOString()
  const out = git([
    'log',
    'main',
    '--first-parent',
    '--merges',
    `--since=${since}`,
    '--format=%H%x09%cI%x09%s',
  ])
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [sha, date, subject] = line.split('\t')
      return { ...parseMergeSubject(subject), sha, date }
    })
}

function readBranches() {
  const mainSubjects = new Set(git(['log', 'main', '--format=%s', '-n', '3000']).split('\n'))
  const out = git([
    'branch',
    '--no-merged',
    'main',
    '--format=%(refname:short)%09%(committerdate:iso-strict)%09%(subject)',
  ])
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [branch, date, subject] = line.split('\t')
      const ahead = git(['cherry', 'main', branch])
        .split('\n')
        .filter((l) => l.startsWith('+')).length
      return { branch, date, ahead, landed: mainSubjects.has(subject) }
    })
}

// The last merge of each release day, with the build number (commit count) the app shows.
function readReleases(merges) {
  const byDay = new Map()
  for (const merge of merges) {
    const day = isoDay(merge.date)
    if (!byDay.has(day)) byDay.set(day, merge.sha)
  }
  return [...byDay].map(([day, sha]) => ({ day, build: Number(git(['rev-list', '--count', sha])) }))
}

function readRequests() {
  return readAuthoringRequests().map((request) => {
    const path = resolve(ROOT, request.file)
    const committed = git(['log', '-1', '--format=%cI', '--', path])
    const modified = statSync(path).mtime.toISOString()
    const dirty = git(['status', '--porcelain', '--', path]) !== ''
    return { ...request, updated: dirty || !committed ? modified : committed }
  })
}

function githubCommitUrl() {
  const remote = git(['remote', 'get-url', 'origin'])
  const match = /github\.com[:/](.+?)(?:\.git)?$/.exec(remote)
  return match ? (sha) => `https://github.com/${match[1]}/commit/${sha}` : () => undefined
}

function main(argv) {
  const dryRun = argv.includes('--dry-run')
  const outIndex = argv.indexOf('--out')
  const out =
    outIndex !== -1
      ? resolve(argv[outIndex + 1])
      : resolve(ROOT, '../../HSC Hub/Feeds/LaunchPad Dev.json')
  const now = Date.now()
  const merges = readMerges(now)
  const pkg = JSON.parse(git(['show', 'main:package.json']))
  const [major = '0', minor = '0'] = String(pkg.version).split('.')
  const feed = buildFeed({
    requests: readRequests(),
    merges,
    branches: readBranches(),
    releases: readReleases(merges),
    version: `${major}.${minor}`,
    now,
    commitUrl: githubCommitUrl(),
    linkFor: (request) => resolve(ROOT, request.file),
  })
  const text = JSON.stringify(feed, null, 2) + '\n'
  if (dryRun) {
    process.stdout.write(text)
    return
  }
  if (!existsSync(dirname(dirname(out)))) {
    throw new Error(`HSC Hub not found at ${dirname(dirname(out))}; pass --out <file>`)
  }
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(`${out}.tmp`, text, 'utf8')
  renameSync(`${out}.tmp`, out)
  const counts = feed.items.reduce(
    (acc, item) => ({ ...acc, [item.state]: (acc[item.state] ?? 0) + 1 }),
    {}
  )
  console.log(
    `Wrote ${relative(process.cwd(), out) || out}: ${feed.items.length} items ${JSON.stringify(counts)}, ${feed.groups.length} releases`
  )
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2))
  } catch (e) {
    console.error(`board-feed: ${e.message}`)
    process.exit(1)
  }
}
