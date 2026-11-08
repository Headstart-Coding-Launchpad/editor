// @vitest-environment node
import { describe, it, expect } from 'vitest'
import retention from '../retention.js'

const { DELETE, LIMITS, toMs, reportTime, reportIsPastLimit, classIsPastLimit, shareIsPastLimit } =
  retention
const DAY = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2029, 0, 1)

describe('retention sweep limits (#303)', () => {
  it('is a dry run until Ryan OKs deleting', () => {
    expect(DELETE).toBe(false)
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

// A tiny in-memory Firestore Admin stand-in that records how each query was shaped, so the
// sweep can be held to reading only the fields it needs.
function fakeDb({ reports = [], classes = [], shares = [] }) {
  const reads = []
  const docSnap = (id, data, ref, fields) => ({
    id,
    ref,
    data: () =>
      fields ? Object.fromEntries(fields.filter((f) => f in data).map((f) => [f, data[f]])) : data,
  })
  function makeQuery(path, rows) {
    const ops = { select: null, orderBy: null, limit: null }
    const q = {
      select: (...fields) => ((ops.select = fields), q),
      orderBy: (field, dir = 'asc') => ((ops.orderBy = [field, dir]), q),
      limit: (n) => ((ops.limit = n), q),
      get: async () => {
        reads.push({ path, ...ops })
        let list = rows.slice()
        if (ops.orderBy) {
          const [f, dir] = ops.orderBy
          list = list.filter((r) => r.data[f] != null)
          list.sort((a, b) => (toMs(a.data[f]) - toMs(b.data[f])) * (dir === 'desc' ? -1 : 1))
        }
        if (ops.limit != null) list = list.slice(0, ops.limit)
        const docs = list.map((r) => docSnap(r.id, r.data, r.ref, ops.select))
        return { docs, size: docs.length }
      },
    }
    return q
  }
  const classRows = classes.map((cls) => {
    const rosterRows = (cls.roster ?? []).map((entry) => {
      const workRows = (entry.work ?? []).map((w, i) => ({ id: `w${i}`, data: w, ref: {} }))
      const ref = {
        collection: (name) => makeQuery(`classes/${cls.id}/roster/${entry.id}/${name}`, workRows),
      }
      return { id: entry.id, data: entry, ref }
    })
    const ref = { collection: (name) => makeQuery(`classes/${cls.id}/${name}`, rosterRows) }
    return { id: cls.id, data: cls, ref }
  })
  const db = {
    collectionGroup: (name) =>
      makeQuery(
        name,
        reports.map((r) => ({ id: r.id, data: r, ref: {} }))
      ),
    collection: (name) =>
      makeQuery(
        name,
        name === 'classes' ? classRows : shares.map((s) => ({ id: s.id, data: s, ref: {} }))
      ),
  }
  return { db, reads }
}

describe('retention sweep reads only what it needs', () => {
  const ts = (ms) => ({ toMillis: () => ms })

  it('reads only the time fields of each session report', async () => {
    const { db, reads } = fakeDb({
      reports: [
        { id: String(NOW - 800 * DAY), students: ['big'] },
        { id: 'legacy', endedAt: NOW - 800 * DAY, students: ['big'] },
        { id: String(NOW - DAY), students: ['big'] },
      ],
    })
    const counts = await retention.sweep(db, NOW)
    expect(counts.reports).toBe(2)
    const reportRead = reads.find((r) => r.path === 'sessionReports')
    expect(reportRead.select).toEqual(['endedAt', 'startedAt'])
  })

  it('skips the work reads for a class whose roster is recent, and reads one work doc otherwise', async () => {
    const { db, reads } = fakeDb({
      classes: [
        {
          id: 'busy',
          updatedAt: NOW - 400 * DAY,
          roster: [{ id: 'r1', createdAt: NOW - DAY, work: [{ savedAt: ts(NOW - DAY) }] }],
        },
        {
          id: 'quiet',
          updatedAt: NOW - 400 * DAY,
          roster: [
            {
              id: 'r2',
              createdAt: NOW - 500 * DAY,
              work: [{ savedAt: ts(NOW - 600 * DAY) }, { savedAt: ts(NOW - 10 * DAY) }],
            },
          ],
        },
        {
          id: 'gone',
          updatedAt: NOW - 400 * DAY,
          roster: [
            { id: 'r3', createdAt: NOW - 500 * DAY, work: [{ savedAt: ts(NOW - 450 * DAY) }] },
          ],
        },
      ],
    })
    const counts = await retention.sweep(db, NOW)
    // 'quiet' has recent work, so only 'gone' is past its limit (same answer as reading all work).
    expect(counts.classes).toBe(1)
    expect(counts.rosterEntries).toBe(1)
    expect(reads.some((r) => r.path.startsWith('classes/busy/roster/r1/work'))).toBe(false)
    const workReads = reads.filter((r) => r.path.endsWith('/work'))
    expect(workReads.length).toBe(2)
    for (const read of workReads) {
      expect(read.orderBy).toEqual(['savedAt', 'desc'])
      expect(read.limit).toBe(1)
      expect(read.select).toEqual(['savedAt'])
    }
    const rosterRead = reads.find((r) => r.path === 'classes/busy/roster')
    expect(rosterRead.select).toEqual(['createdAt'])
  })

  it('reads only the expiry of each share link', async () => {
    const { db, reads } = fakeDb({
      shares: [
        { id: 's1', expiresAt: NOW - 31 * DAY, work: 'big' },
        { id: 's2', expiresAt: NOW - DAY, work: 'big' },
      ],
    })
    const counts = await retention.sweep(db, NOW)
    expect(counts.shares).toBe(1)
    expect(reads.find((r) => r.path === 'sharedWork').select).toEqual(['expiresAt'])
  })
})

describe('retention sweep with archived classes', () => {
  it('reads no saved work for a class archived over 90 days ago (it goes whatever the work says)', async () => {
    const { db, reads } = fakeDb({
      classes: [
        {
          id: 'old',
          archived: true,
          updatedAt: NOW - 100 * DAY,
          roster: [
            { id: 'r1', createdAt: NOW - 500 * DAY, work: [{ savedAt: { toMillis: () => NOW } }] },
          ],
        },
      ],
    })
    const counts = await retention.sweep(db, NOW)
    expect(counts.classes).toBe(1)
    expect(reads.some((r) => r.path.endsWith('/work'))).toBe(false)
  })
})
