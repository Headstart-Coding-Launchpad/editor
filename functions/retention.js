// Data retention sweep (Hub #303, Ryan 2026-10-27; docs/architecture/data-retention-plan.md).
// It removes session reports and share links past their limit, and writes the counts (no names)
// to retentionLog/{date}. Switched on with Ryan's second OK (26 Nov 2026) after 28 dry-run days
// that counted nothing. DELETE = false turns it back into a dry run.
//
// Class lists are only counted (DELETE_CLASSES = false): "last activity" sees only a child added,
// work saved, typing recorded or the class record edited, so a class still being taught (or an
// archived one still in use) can look idle.

const DELETE = true
const DELETE_CLASSES = false

const DAY = 24 * 60 * 60 * 1000
const YEAR = 365 * DAY

const LIMITS = Object.freeze({
  reportMs: 2 * YEAR,
  // Reports from before this date may hold first names. "Student N" labels went in during
  // 16 July 2026 (commit 0f779f4a), so the whole of that day counts as named.
  namedReportsBefore: Date.UTC(2026, 6, 17),
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

// One line for the log: the kind and the message, with any document path taken out (a share
// link's id is its secret).
function describeError(kind, err) {
  const message = String(err?.message ?? err).replace(/\S*\/\S*/g, '<path>')
  return `${kind}: ${message.slice(0, 200)}`
}

// Runs `task`; a failure is noted in `errors` and the sweep carries on.
async function attempt(errors, kind, task) {
  try {
    await task()
    return true
  } catch (err) {
    errors.push(describeError(kind, err))
    return false
  }
}

async function sweepReports(db, now, { counts, deleted, errors }) {
  const reports = await db.collectionGroup('sessionReports').get()
  for (const snap of reports.docs) {
    await attempt(errors, 'reports', async () => {
      if (!reportIsPastLimit(reportTime(snap.id, snap.data()), now)) return
      counts.reports++
      if (!DELETE) return
      await snap.ref.delete()
      deleted.reports++
    })
  }
}

async function sweepClass(db, now, { counts, deleted, errors }, cls) {
  const data = cls.data()
  const roster = await cls.ref.collection('roster').get()
  // No children, so there is no class list to remove.
  if (roster.size === 0) return
  let lastActivity = 0
  for (const entry of roster.docs) {
    lastActivity = Math.max(lastActivity, toMs(entry.data().createdAt) ?? 0)
    const work = await entry.ref.collection('work').get()
    for (const w of work.docs) lastActivity = Math.max(lastActivity, toMs(w.data().savedAt) ?? 0)
    const typing = await entry.ref.collection('typing').get()
    for (const t of typing.docs) {
      lastActivity = Math.max(lastActivity, toMs(t.data().recordedAt) ?? 0)
    }
  }
  const info = { archived: !!data.archived, updatedAt: toMs(data.updatedAt), lastActivity }
  if (!classIsPastLimit(info, now)) return
  counts.classes++
  counts.rosterEntries += roster.size
  if (!DELETE || !DELETE_CLASSES) return
  let removed = 0
  for (const entry of roster.docs) {
    if (await attempt(errors, 'classes', () => db.recursiveDelete(entry.ref))) removed++
  }
  deleted.rosterEntries += removed
  if (removed === roster.size) deleted.classes++
}

async function sweepClasses(db, now, result) {
  const classes = await db.collection('classes').get()
  for (const cls of classes.docs) {
    await attempt(result.errors, 'classes', () => sweepClass(db, now, result, cls))
  }
}

async function sweepShares(db, now, { counts, deleted, errors }) {
  const shares = await db.collection('sharedWork').get()
  for (const snap of shares.docs) {
    await attempt(errors, 'shares', async () => {
      if (!shareIsPastLimit(toMs(snap.data().expiresAt), now)) return
      counts.shares++
      if (!DELETE) return
      await snap.ref.delete()
      deleted.shares++
    })
  }
}

// Counts what is past its limit and deletes what is switched on. `db` is a Firestore Admin
// instance. Never throws. `counts` = past the limit, `deleted` = actually removed.
async function sweep(db, now = Date.now()) {
  const result = {
    counts: { reports: 0, classes: 0, rosterEntries: 0, shares: 0 },
    deleted: { reports: 0, classes: 0, rosterEntries: 0, shares: 0 },
    errors: [],
  }
  await attempt(result.errors, 'reports', () => sweepReports(db, now, result))
  await attempt(result.errors, 'classes', () => sweepClasses(db, now, result))
  await attempt(result.errors, 'shares', () => sweepShares(db, now, result))
  return result
}

// The nightly run: sweep, with a record in retentionLog/{date}. The record is written before
// anything is deleted (finished: false, which is what stays if the run is killed, e.g. by the
// timeout) and again at the end with what was done. If the first write fails, nothing is deleted.
async function runSweep(db, now, timestamp) {
  const log = db.collection('retentionLog').doc(new Date(now).toISOString().slice(0, 10))
  const entry = {
    at: timestamp,
    dryRun: !DELETE,
    // Which kinds this run really deletes.
    deletes: { reports: DELETE, classLists: DELETE && DELETE_CLASSES, shares: DELETE },
  }
  await log.set({ ...entry, finished: false })
  const { counts, deleted, errors } = await sweep(db, now)
  const error = errors.length ? errors.join('; ').slice(0, 1000) : null
  await log.set({ ...entry, finished: true, counts, deleted, error })
  return { counts, deleted, error }
}

module.exports = {
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
}
