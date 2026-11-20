/**
 * The health beacon (deep review 2026-11-10, R1; sketch and build OK'd by Ryan 20 Nov 2026).
 *
 * Each student's own screen keeps a small summary of how the app is running for them and writes
 * it to students/{anonymousId}/healthBeacon (src/app/hooks/useHealthBeacon.js):
 *   { appVersion, pythonStatus, pythonLoadMs?, errorCount, lastError?, lastErrorAt?,
 *     connectionDrops, lastDropAt?, updatedAt }
 * Throttled: once on joining, then only when the summary changes and at most once every
 * HEALTH_BEACON_MIN_INTERVAL_MS. The error line is kept short and stripped: first line only,
 * quoted text (and an unterminated quote's tail) and links removed, cut to
 * HEALTH_BEACON_MESSAGE_MAX characters. Other words in a message are not checked.
 *
 * The tutor's Class health chip (src/app/components/ClassHealthChip.jsx) reads it through
 * classHealth() below, alongside the older one-word `health` field (src/shared/studentHealth.js),
 * and the session report keeps it per student (lessonReport.js, `screenHealth`).
 */

import { STUDENT_HEALTH } from './studentHealth.js'

export const HEALTH_BEACON_MIN_INTERVAL_MS = 30_000
export const HEALTH_BEACON_MESSAGE_MAX = 120
// Errors and drops older than this no longer make a student amber.
export const HEALTH_RECENT_MS = 10 * 60_000
// This many recent connection drops make a student amber.
export const HEALTH_DROPS_AMBER = 3

export const PYTHON_STATUSES = Object.freeze(['idle', 'loading', 'ready', 'error', 'stuck'])

// Browser noise that is not a broken screen.
const IGNORED_MESSAGES = [/^ResizeObserver loop/i]

/** True when an error message is harmless browser noise the beacon does not count. */
export function isIgnoredError(message) {
  const text = String(message ?? '')
  return IGNORED_MESSAGES.some((re) => re.test(text))
}

/**
 * An error message to send: the first line, quoted text replaced by '…' (an unterminated quote
 * loses everything after it), links replaced by <link>, spaces collapsed, at most
 * HEALTH_BEACON_MESSAGE_MAX characters. Quoted text is where a name, an answer or a line of code
 * usually shows (e.g. "reading 'answer'"); unquoted words are not checked.
 */
export function sanitizeErrorMessage(message) {
  // Cut first so a huge message costs nothing; a quote cut open here is removed below.
  let text = String(message ?? '')
    .slice(0, HEALTH_BEACON_MESSAGE_MAX * 4)
    .split(/\r?\n/)[0]
  text = text
    .replace(/https?:\/\/\S+/gi, '<link>')
    // A quoted stretch, or an unterminated quote and everything after it.
    .replace(/(['"`])(?:(?!\1).)*(\1|$)/g, (_m, open, close) => `${open}…${close}`)
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) text = 'Unknown error'
  return text.length > HEALTH_BEACON_MESSAGE_MAX
    ? `${text.slice(0, HEALTH_BEACON_MESSAGE_MAX - 1)}…`
    : text
}

/** The message of a window error event or an unhandled rejection's reason. */
export function errorMessageOf(eventOrReason) {
  if (eventOrReason == null) return 'Unknown error'
  if (typeof eventOrReason === 'string') return eventOrReason
  if (eventOrReason instanceof Error) return eventOrReason.message || eventOrReason.name
  if (typeof eventOrReason.message === 'string' && eventOrReason.message) {
    return eventOrReason.message
  }
  if (eventOrReason.error instanceof Error) return eventOrReason.error.message
  return 'Unknown error'
}

/**
 * The beacon's state on one screen: counts in memory, and the summary to write. `now` is the
 * clock to stamp times with (the student's screen passes server time).
 */
export function createHealthBeaconState({ appVersion = 'dev', now = () => Date.now() } = {}) {
  const state = {
    appVersion,
    pythonStatus: 'idle',
    pythonLoadMs: null,
    pythonLoadStartedAt: null,
    errorCount: 0,
    lastError: null,
    lastErrorAt: null,
    connectionDrops: 0,
    lastDropAt: null,
    everConnected: false,
    connected: null,
  }

  return {
    recordError(message) {
      if (isIgnoredError(message)) return false
      state.errorCount += 1
      state.lastError = sanitizeErrorMessage(message)
      state.lastErrorAt = now()
      return true
    },
    setPythonStatus(status) {
      const next = PYTHON_STATUSES.includes(status) ? status : 'idle'
      if (next === state.pythonStatus) return false
      // A load (or a retry after an error) starts the clock; a load time once measured stays.
      if (next === 'loading' && state.pythonLoadMs == null) state.pythonLoadStartedAt = now()
      if (next === 'ready' && state.pythonLoadStartedAt != null && state.pythonLoadMs == null) {
        state.pythonLoadMs = Math.max(0, now() - state.pythonLoadStartedAt)
      }
      state.pythonStatus = next
      return true
    },
    // A drop is a connected → not connected change after the first connection.
    setConnected(connected) {
      if (connected == null) return false
      const was = state.connected
      state.connected = !!connected
      if (connected) {
        state.everConnected = true
        return false
      }
      if (was === true && state.everConnected) {
        state.connectionDrops += 1
        state.lastDropAt = now()
        return true
      }
      return false
    },
    /** The summary to write (without `updatedAt`), only the fields that are known. */
    summary() {
      const out = {
        appVersion: state.appVersion,
        pythonStatus: state.pythonStatus,
        errorCount: state.errorCount,
        connectionDrops: state.connectionDrops,
      }
      if (state.pythonLoadMs != null) out.pythonLoadMs = state.pythonLoadMs
      if (state.lastError != null) {
        out.lastError = state.lastError
        out.lastErrorAt = state.lastErrorAt
      }
      if (state.lastDropAt != null) out.lastDropAt = state.lastDropAt
      return out
    },
  }
}

/** A stable key for "has the summary changed?". */
export function summaryKey(summary) {
  return JSON.stringify(summary ?? null)
}

// ─── Tutor side ──────────────────────────────────────────────────────────────

export const HEALTH_BEACON_VERSION_MAX = 40
const COUNT_MAX = 1_000_000

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function wholeCount(value) {
  const n = finiteNumber(value)
  return n == null ? 0 : Math.min(COUNT_MAX, Math.max(0, Math.floor(n)))
}

/**
 * A beacon read from the database, made safe before the chip or the report uses it. The rules
 * do not check this field's shape yet (a `.validate` block is a follow-up needing a rules
 * deploy), so a bad or hostile write is clamped here: appVersion capped at
 * HEALTH_BEACON_VERSION_MAX characters, lastError re-sanitised (so capped), pythonStatus one of
 * PYTHON_STATUSES, counts whole numbers 0..1,000,000, times finite numbers. Null when it is not
 * an object.
 */
export function normalizeHealthBeacon(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const out = {
    appVersion:
      typeof raw.appVersion === 'string' && raw.appVersion
        ? raw.appVersion.slice(0, HEALTH_BEACON_VERSION_MAX)
        : null,
    pythonStatus: PYTHON_STATUSES.includes(raw.pythonStatus) ? raw.pythonStatus : 'idle',
    errorCount: wholeCount(raw.errorCount),
    connectionDrops: wholeCount(raw.connectionDrops),
  }
  const loadMs = finiteNumber(raw.pythonLoadMs)
  if (loadMs != null && loadMs >= 0) out.pythonLoadMs = loadMs
  if (typeof raw.lastError === 'string') out.lastError = sanitizeErrorMessage(raw.lastError)
  for (const key of ['lastErrorAt', 'lastDropAt', 'updatedAt']) {
    const at = finiteNumber(raw[key])
    if (at != null) out[key] = at
  }
  return out
}

const LEVEL_RANK = { ok: 0, amber: 1, red: 2 }

function plural(n, one, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`
}

/** "40 s ago", "3 min ago", "1 h ago". */
export function formatAgo(ms) {
  const secs = Math.max(0, Math.round(ms / 1000))
  if (secs < 60) return `${secs} s ago`
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins} min ago`
  return `${Math.round(mins / 60)} h ago`
}

function isRecent(at, now) {
  return typeof at === 'number' && Number.isFinite(at) && now - at <= HEALTH_RECENT_MS
}

/**
 * One student's health for the tutor: { level: 'ok' | 'amber' | 'red', headline, detail } or
 * { level: 'ok' }. Offline students are left out (null): their chip is Offline.
 */
export function studentHealthStatus(student, { now = Date.now(), appVersion = null } = {}) {
  if (!student?.online) return null
  const beacon = normalizeHealthBeacon(student.healthBeacon)
  const versionNote = (() => {
    const v = beacon?.appVersion
    if (!v) return null
    return appVersion && v !== appVersion ? `v${v} (older version)` : `v${v}`
  })()
  const withVersion = (text) => [text, versionNote].filter(Boolean).join(' · ')

  if (beacon?.pythonStatus === 'error') {
    return { level: 'red', headline: 'Python failed to load', detail: withVersion(null) }
  }
  if (beacon?.pythonStatus === 'stuck' || student.health === STUDENT_HEALTH.pythonStuck) {
    return {
      level: 'red',
      headline: 'Python stuck',
      detail: withVersion('Ask them to tap Reload'),
    }
  }
  if (beacon?.errorCount > 0 && isRecent(beacon.lastErrorAt, now)) {
    // errorCount covers the screen's whole page load, so the headline only says one was recent;
    // the detail gives its age.
    return {
      level: 'amber',
      headline: 'Recent error',
      detail: withVersion(`Last error ${formatAgo(now - beacon.lastErrorAt)}`),
      message: beacon.lastError ?? null,
    }
  }
  if (student.health === STUDENT_HEALTH.screenError) {
    return {
      level: 'amber',
      headline: 'Part of their screen hit an error',
      detail: withVersion('They see a Try again button'),
    }
  }
  if (beacon?.connectionDrops >= HEALTH_DROPS_AMBER && isRecent(beacon.lastDropAt, now)) {
    return {
      level: 'amber',
      headline: `Connection dropped ${plural(beacon.connectionDrops, 'time')}`,
      detail: withVersion(`Last drop ${formatAgo(now - beacon.lastDropAt)}`),
    }
  }
  return { level: 'ok', detail: withVersion(null) }
}

/**
 * The class's health for the chip: { level, rows, fineCount, total, checkedAt, versionTotal,
 * versionMatch }. `rows` are the students who need a look, red first, then by name.
 */
export function classHealth(students, { now = Date.now(), appVersion = null } = {}) {
  const rows = []
  let fineCount = 0
  let total = 0
  let checkedAt = null
  let versionTotal = 0
  let versionMatch = 0
  for (const student of students ?? []) {
    const status = studentHealthStatus(student, { now, appVersion })
    if (!status) continue
    total += 1
    const beacon = normalizeHealthBeacon(student.healthBeacon)
    if (typeof beacon?.updatedAt === 'number') {
      checkedAt = Math.max(checkedAt ?? 0, beacon.updatedAt)
    }
    if (beacon?.appVersion) {
      versionTotal += 1
      if (!appVersion || beacon.appVersion === appVersion) versionMatch += 1
    }
    if (status.level === 'ok') {
      fineCount += 1
      continue
    }
    rows.push({
      id: student.anonymousId,
      name: student.displayName || 'A student',
      ...status,
    })
  }
  rows.sort(
    (a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level] || String(a.name).localeCompare(b.name)
  )
  const level = rows.some((r) => r.level === 'red') ? 'red' : rows.length > 0 ? 'amber' : 'ok'
  return { level, rows, fineCount, total, checkedAt, versionTotal, versionMatch }
}

/**
 * The session report's per-student field (`screenHealth`), or null when the student's screen
 * never sent a beacon.
 */
export function reportScreenHealth(studentNode) {
  const beacon = normalizeHealthBeacon(studentNode?.healthBeacon)
  if (!beacon) return null
  const out = {
    appVersion: beacon.appVersion,
    pythonStatus: beacon.pythonStatus,
    errorCount: beacon.errorCount,
    connectionDrops: beacon.connectionDrops,
  }
  if (beacon.pythonLoadMs != null) out.pythonLoadMs = beacon.pythonLoadMs
  if (beacon.lastError != null) out.lastError = beacon.lastError
  return out
}
