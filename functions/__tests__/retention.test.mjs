// @vitest-environment node
import { describe, it, expect } from 'vitest'
import retention from '../retention.js'

const {
  DELETE,
  LIMITS,
  toMs,
  reportTime,
  reportIsPastLimit,
  classIsPastLimit,
  shareIsPastLimit,
  sweep,
} = retention
const DAY = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2029, 0, 1)

describe('retention sweep limits (#303)', () => {
  it('deletes (Ryan OK 26 Nov 2026, after 28 dry-run days)', () => {
    expect(DELETE).toBe(true)
  })

  it('reads times from Timestamps, numbers and numeric ids', () => {
    expect(toMs({ toMillis: () => 5 })).toBe(5)
    expect(toMs('1700000000000')).toBe(1700000000000)
    expect(toMs('abc')).toBeNull()
    expect(reportTime('1700000000000', {})).toBe(1700000000000)
    expect(reportTime('x', { endedAt: 7 })).toBe(7)
  })

  it('keeps reports 2 years, and older reports that may hold names 1 year', () => {
    const recentNamed = LIMITS.namedReportsBefore - DAY
    expect(reportIsPastLimit(recentNamed, recentNamed + 300 * DAY)).toBe(false)
    expect(reportIsPastLimit(recentNamed, recentNamed + 400 * DAY)).toBe(true)
    const later = Date.UTC(2027, 0, 1)
    expect(reportIsPastLimit(later, later + 400 * DAY)).toBe(false)
    expect(reportIsPastLimit(later, later + 740 * DAY)).toBe(true)
    expect(reportIsPastLimit(null, NOW)).toBe(false)
  })

  it('removes a class list 1 year after its last activity, or 90 days after archiving', () => {
    const t = NOW - 100 * DAY
    expect(classIsPastLimit({ archived: true, updatedAt: t, lastActivity: t }, NOW)).toBe(true)
    expect(classIsPastLimit({ archived: false, updatedAt: t, lastActivity: t }, NOW)).toBe(false)
    const old = NOW - 400 * DAY
    expect(classIsPastLimit({ archived: false, updatedAt: old, lastActivity: old }, NOW)).toBe(true)
    expect(
      classIsPastLimit({ archived: false, updatedAt: old, lastActivity: NOW - DAY }, NOW)
    ).toBe(false)
    expect(classIsPastLimit({ archived: false, updatedAt: null, lastActivity: 0 }, NOW)).toBe(false)
  })

  it('removes a share link 30 days after it expires', () => {
    expect(shareIsPastLimit(NOW - 31 * DAY, NOW)).toBe(true)
    expect(shareIsPastLimit(NOW - 29 * DAY, NOW)).toBe(false)
    expect(shareIsPastLimit(null, NOW)).toBe(false)
  })
})

// Just enough of the Admin SDK for sweep(): one class, one child, no reports or share links.
function classDb({ createdAt, typedAt }, deleted = []) {
  const list = (docs) => ({ docs, size: docs.length })
  const collection = (docs) => ({ get: async () => list(docs) })
  const doc = (data, subcollections = {}) => ({
    data: () => data,
    ref: {
      collection: (name) => collection(subcollections[name] ?? []),
      delete: async () => deleted.push(data),
    },
  })
  const typing = typedAt == null ? [] : [doc({ recordedAt: typedAt })]
  const child = doc({ createdAt }, { typing })
  const cls = doc({}, { roster: [child] })
  return {
    collectionGroup: () => collection([]),
    collection: (name) => collection(name === 'classes' ? [cls] : []),
    recursiveDelete: async (ref) => deleted.push(ref === child.ref ? 'child' : 'other'),
  }
}

describe('retention sweep class activity (#303)', () => {
  const longAgo = NOW - 400 * DAY

  it('counts a class with no activity for a year', async () => {
    const counts = await sweep(classDb({ createdAt: longAgo }), NOW)
    expect(counts).toMatchObject({ classes: 1, rosterEntries: 1 })
  })

  it('keeps a class whose only recent activity is typing practice', async () => {
    const counts = await sweep(classDb({ createdAt: longAgo, typedAt: NOW - DAY }), NOW)
    expect(counts).toMatchObject({ classes: 0, rosterEntries: 0 })
  })

  it('removes only the children of a class past its limit, never an active one', async () => {
    const idle = []
    await sweep(classDb({ createdAt: longAgo }, idle), NOW)
    expect(idle).toEqual(['child'])
    const active = []
    await sweep(classDb({ createdAt: longAgo, typedAt: NOW - DAY }, active), NOW)
    expect(active).toEqual([])
  })
})
