import { describe, expect, it } from 'vitest'
import {
  branchItems,
  branchTitle,
  buildFeed,
  mergeItems,
  parseMergeSubject,
  requestItems,
  requestState,
} from '../board-feed.mjs'

const NOW = new Date('2026-10-07T18:00:00Z').getTime()
const daysAgo = (n) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString()

describe('parseMergeSubject', () => {
  it('reads the three merge subject styles used on main', () => {
    expect(parseMergeSubject("Merge branch 'fix/editor-code-font'")).toEqual({
      branch: 'fix/editor-code-font',
    })
    expect(parseMergeSubject('Merge feature/motion-system: unified motion')).toEqual({
      branch: 'feature/motion-system',
      title: 'Unified motion',
    })
    expect(parseMergeSubject('Merge peer help and the roster')).toEqual({
      title: 'Peer help and the roster',
      kind: 'feature',
    })
    expect(parseMergeSubject('Merge fixes for the roster').kind).toBe('bug')
    expect(parseMergeSubject('Bump version')).toEqual({})
  })
})

describe('items', () => {
  it('maps request statuses to board states', () => {
    expect(requestState('open')).toBe('queued')
    expect(requestState('planned')).toBe('in_progress')
    expect(requestState('Shipped')).toBe('done')
    expect(requestState('needs-info')).toBe('blocked')
  })

  it('keeps open requests, and done ones only from the last 14 days', () => {
    const items = requestItems(
      [
        { file: 'docs/a/2026-10-06-new.md', title: 'New', status: 'open', updated: daysAgo(40) },
        { file: 'docs/a/old.md', title: 'Old', status: 'shipped', updated: daysAgo(20) },
        { file: 'docs/a/recent.md', title: 'Recent', status: 'shipped', updated: daysAgo(1) },
        { file: 'docs/a/ask.md', title: 'Ask', status: 'needs-info', updated: daysAgo(1) },
      ],
      { now: NOW, releaseDays: new Set([daysAgo(1).slice(0, 10)]) }
    )
    expect(items.map((i) => i.id)).toEqual([
      'request:2026-10-06-new',
      'request:recent',
      'request:ask',
    ])
    expect(items[1].group).toBe(`release:${daysAgo(1).slice(0, 10)}`)
    expect(items[2]).toMatchObject({ state: 'blocked', needsRyan: true })
  })

  it('lists recent merges once each, grouped by day', () => {
    const items = mergeItems(
      [
        { branch: 'fix/a', sha: 'aaaaaaa111', date: daysAgo(0) },
        { branch: 'fix/a', sha: 'bbbbbbb222', date: daysAgo(1) },
        { title: 'Peer help', kind: 'feature', sha: 'ccccccc333', date: daysAgo(2) },
        { branch: 'archive/x', sha: 'ddddddd444', date: daysAgo(0) },
        { branch: 'feature/old', sha: 'eeeeeee555', date: daysAgo(30) },
      ],
      { now: NOW, commitUrl: (sha) => `https://example/${sha}` }
    )
    expect(items.map((i) => i.id)).toEqual(['bug:fix/a', 'feature:ccccccc'])
    expect(items[0]).toMatchObject({
      title: 'A',
      state: 'done',
      link: 'https://example/aaaaaaa111',
    })
  })

  it('shows unmerged branches as in progress or paused, skipping landed and stale ones', () => {
    const items = branchItems(
      [
        { branch: 'feature/new-thing', date: daysAgo(1), ahead: 2, landed: false },
        { branch: 'fix/quiet', date: daysAgo(10), ahead: 1, landed: false },
        { branch: 'feature/landed', date: daysAgo(1), ahead: 1, landed: true },
        { branch: 'feature/stale', date: daysAgo(60), ahead: 1, landed: false },
      ],
      { now: NOW }
    )
    expect(items.map((i) => [i.id, i.state])).toEqual([
      ['feature:feature/new-thing', 'in_progress'],
      ['bug:fix/quiet', 'queued'],
    ])
    expect(branchTitle('feature/scratch-svg-export')).toBe('Scratch svg export')
  })
})

describe('buildFeed', () => {
  it('writes the board format with release groups that have items', () => {
    const day = daysAgo(0).slice(0, 10)
    const feed = buildFeed({
      requests: [],
      merges: [{ branch: 'feature/x', sha: 'abcdef0123', date: daysAgo(0) }],
      branches: [],
      releases: [
        { day, build: 1190 },
        { day: '2026-01-01', build: 5 },
      ],
      version: '1.0',
      now: NOW,
    })
    expect(feed).toMatchObject({ agent: 'LaunchPad Dev', updated: new Date(NOW).toISOString() })
    expect(feed.groups).toEqual([
      {
        id: `release:${day}`,
        area: 'launchpad',
        title: 'Release 7 Oct 2026 · v1.0.1190',
        summary: '1 change shipped',
      },
    ])
    expect(feed.items[0]).toMatchObject({ id: 'feature:feature/x', group: `release:${day}` })
  })
})
