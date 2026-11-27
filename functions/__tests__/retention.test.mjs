// @vitest-environment node
import { describe, it, expect } from 'vitest'
import retention from '../retention.js'

const {
  DELETE,
  DELETE_CLASSES,
  LIMITS,
  toMs,
  reportTime,
  reportIsPastLimit,
  classIsPastLimit,
  shareIsPastLimit,
  sweep,
  runSweep,
} = retention
const DAY = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2029, 0, 1)

describe('retention sweep limits (#303)', () => {
  it('deletes reports and share links (Ryan OK 26 Nov 2026), never class lists', () => {
    expect(DELETE).toBe(true)
    expect(DELETE_CLASSES).toBe(false)
  })

  it('treats every report saved on or before 16 July 2026 as one that may hold names', () => {
    const lastNamed = Date.UTC(2026, 6, 16, 23, 0)
    expect(reportIsPastLimit(lastNamed, lastNamed + 400 * DAY)).toBe(true)
    const anonymous = Date.UTC(2026, 6, 17)
    expect(reportIsPastLimit(anonymous, anonymous + 400 * DAY)).toBe(false)
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

// Just enough of the Admin SDK for sweep() and runSweep(). `deleted` collects the ids removed,
// `logs` every retentionLog write. Ids in `failing` throw on delete; collections in `unreadable`
// throw on read.
function fakeDb({ reports = [], classes = [], shares = [], failing = [], unreadable = [] } = {}) {
  const deleted = []
  const logs = []
  const remove = async (id) => {
    if (failing.includes(id)) throw new Error(`7 PERMISSION_DENIED on sharedWork/${id}`)
    deleted.push(id)
  }
  const collection = (name, docs) => ({
    get: async () => {
      if (unreadable.includes(name)) throw new Error(`cannot read ${name}`)
      return { docs, size: docs.length }
    },
  })
  const doc = ({ id, data = {}, sub = {} }) => ({
    id,
    data: () => data,
    ref: {
      id,
      collection: (name) => collection(name, (sub[name] ?? []).map(doc)),
      delete: () => remove(id),
    },
  })
  const top = { classes, sharedWork: shares }
  return {
    deleted,
    logs,
    collectionGroup: (name) => collection(name, reports.map(doc)),
    collection: (name) =>
      name === 'retentionLog'
        ? { doc: (day) => ({ set: async (value) => logs.push({ day, ...value }) }) }
        : collection(name, (top[name] ?? []).map(doc)),
    recursiveDelete: (ref) => remove(ref.id),
  }
}

// A report's doc id is its session's start time.
const report = (at) => ({ id: String(at) })
const share = (id, expiresAt) => ({ id, data: { expiresAt } })
const classOf = (id, { createdAt, typedAt, data = {} }) => ({
  id,
  data,
  sub: {
    roster: [
      {
        id: `${id}-child`,
        data: { createdAt },
        sub: { typing: typedAt == null ? [] : [{ id: 't', data: { recordedAt: typedAt } }] },
      },
    ],
  },
})

describe('retention sweep class activity (#303)', () => {
  const longAgo = NOW - 400 * DAY

  it('counts a class with no activity for a year', async () => {
    const db = fakeDb({ classes: [classOf('c', { createdAt: longAgo })] })
    const { counts } = await sweep(db, NOW)
    expect(counts).toMatchObject({ classes: 1, rosterEntries: 1 })
  })

  it('keeps a class whose only recent activity is typing practice', async () => {
    const db = fakeDb({ classes: [classOf('c', { createdAt: longAgo, typedAt: NOW - DAY })] })
    const { counts } = await sweep(db, NOW)
    expect(counts).toMatchObject({ classes: 0, rosterEntries: 0 })
  })

  it('never deletes a class list, idle or archived, and does not count an empty one', async () => {
    const archived = { archived: true, updatedAt: NOW - 100 * DAY }
    const db = fakeDb({
      classes: [
        classOf('idle', { createdAt: longAgo }),
        classOf('archived', { createdAt: longAgo, data: archived }),
        { id: 'empty', data: archived },
      ],
    })
    const { counts, deleted, errors } = await sweep(db, NOW)
    expect(counts).toMatchObject({ classes: 2, rosterEntries: 2 })
    expect(deleted).toMatchObject({ classes: 0, rosterEntries: 0 })
    expect(db.deleted).toEqual([])
    expect(errors).toEqual([])
  })
})

describe('retention sweep deletes and log (#303)', () => {
  const old = NOW - 800 * DAY
  const recent = NOW - 10 * DAY
  const expired = NOW - 40 * DAY

  it('deletes a past-limit report and share, keeps in-date ones, and logs it', async () => {
    const db = fakeDb({
      reports: [report(old), report(recent)],
      shares: [share('gone', expired), share('live', NOW + DAY)],
    })
    await runSweep(db, NOW, 'stamp')
    expect(db.deleted).toEqual([String(old), 'gone'])
    expect(db.logs.map((l) => l.finished)).toEqual([false, true])
    expect(db.logs[1]).toMatchObject({
      day: '2029-01-01',
      at: 'stamp',
      dryRun: false,
      deletes: { reports: true, classLists: false, shares: true },
      deleted: { reports: 1, shares: 1, classes: 0, rosterEntries: 0 },
      error: null,
    })
  })

  it('writes the log when a delete throws, and carries on with the rest', async () => {
    const db = fakeDb({
      reports: [report(old), report(old - DAY)],
      shares: [share('secretlink', expired), share('gone', expired)],
      failing: [String(old), 'secretlink'],
    })
    await runSweep(db, NOW, 'stamp')
    expect(db.deleted).toEqual([String(old - DAY), 'gone'])
    const log = db.logs.at(-1)
    expect(log.counts).toMatchObject({ reports: 2, shares: 2 })
    expect(log.deleted).toMatchObject({ reports: 1, shares: 1 })
    expect(log.error).toContain('reports: 7 PERMISSION_DENIED')
    expect(log.error).toContain('shares: 7 PERMISSION_DENIED')
    expect(log.error).not.toContain('secretlink')
  })

  it('writes the log, and still sweeps shares, when a whole read fails', async () => {
    const db = fakeDb({ shares: [share('gone', expired)], unreadable: ['classes'] })
    await runSweep(db, NOW, 'stamp')
    expect(db.deleted).toEqual(['gone'])
    expect(db.logs.at(-1)).toMatchObject({ finished: true, error: 'classes: cannot read classes' })
  })
})
