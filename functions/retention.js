// Data retention sweep (Hub #303, Ryan 2026-10-27; docs/architecture/data-retention-plan.md).
// DRY RUN: it only counts what is past its limit and writes the counts (no names) to
// retentionLog/{date}. Deleting needs Ryan's second OK, after two weeks of counts; until then
// DELETE stays false.

const DELETE = false

const DAY = 24 * 60 * 60 * 1000
const YEAR = 365 * DAY

const LIMITS = Object.freeze({
  reportMs: 2 * YEAR,
  // Reports from before this date may hold first names (before "Student N" labels).
  namedReportsBefore: Date.UTC(2026, 6, 1),
  namedReportMs: YEAR,
  classIdleMs: YEAR,
  archivedClassMs: 90 * DAY,
  shareAfterExpiryMs: 30 * DAY,
})

// A Firestore Timestamp, a Date, a number of ms or a numeric string, as ms; else null.
function toMs(value) {
  if (value == null) return null
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (value instanceof Date) return value.getTime()
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

// When a session report was made: its doc id is the session's startedAt (ms).
function reportTime(id, data) {
  return toMs(id) ?? toMs(data?.endedAt) ?? toMs(data?.startedAt)
}

function reportIsPastLimit(at, now, limits = LIMITS) {
  if (at == null) return false
  const limit = at < limits.namedReportsBefore ? limits.namedReportMs : limits.reportMs
  return now - at > limit
}

// A class's roster goes 1 year after its last activity, or 90 days after it was archived
// (the class doc's updatedAt is when it was archived).
function classIsPastLimit({ archived, updatedAt, lastActivity }, now, limits = LIMITS) {
  if (archived && updatedAt != null && now - updatedAt > limits.archivedClassMs) return true
  const last = Math.max(updatedAt ?? 0, lastActivity ?? 0)
  return last > 0 && now - last > limits.classIdleMs
}

function shareIsPastLimit(expiresAt, now, limits = LIMITS) {
  return expiresAt != null && now - expiresAt > limits.shareAfterExpiryMs
}

// Counts (and, once DELETE is on, removes) what is past its limit. `db` is a Firestore Admin
// instance. Returns { reports, classes, rosterEntries, shares }.
async function sweep(db, now = Date.now()) {
  const counts = { reports: 0, classes: 0, rosterEntries: 0, shares: 0 }

  const reports = await db.collectionGroup('sessionReports').get()
  for (const snap of reports.docs) {
    if (!reportIsPastLimit(reportTime(snap.id, snap.data()), now)) continue
    counts.reports++
    if (DELETE) await snap.ref.delete()
  }

  const classes = await db.collection('classes').get()
  for (const cls of classes.docs) {
    const data = cls.data()
    const roster = await cls.ref.collection('roster').get()
    let lastActivity = 0
    for (const entry of roster.docs) {
      lastActivity = Math.max(lastActivity, toMs(entry.data().createdAt) ?? 0)
      const work = await entry.ref.collection('work').get()
      for (const w of work.docs) lastActivity = Math.max(lastActivity, toMs(w.data().savedAt) ?? 0)
    }
    const info = { archived: !!data.archived, updatedAt: toMs(data.updatedAt), lastActivity }
    if (!classIsPastLimit(info, now)) continue
    counts.classes++
    counts.rosterEntries += roster.size
    if (DELETE) {
      for (const entry of roster.docs) await db.recursiveDelete(entry.ref)
    }
  }

  const shares = await db.collection('sharedWork').get()
  for (const snap of shares.docs) {
    if (!shareIsPastLimit(toMs(snap.data().expiresAt), now)) continue
    counts.shares++
    if (DELETE) await snap.ref.delete()
  }

  return counts
}

module.exports = {
  DELETE,
  LIMITS,
  toMs,
  reportTime,
  reportIsPastLimit,
  classIsPastLimit,
  shareIsPastLimit,
  sweep,
}
