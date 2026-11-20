// The health beacon (R1, OK'd by Ryan 20 Nov 2026): students/{id}/healthBeacon, written by
// useHealthBeacon.js, read by ClassHealthChip and the report. See docs/agents/runtime-model.md.
import { STUDENT_HEALTH } from './studentHealth.js'
import { formatVersionNumber, getAppBuildInfo } from './appVersion.js'

export const APP_VERSION = formatVersionNumber(getAppBuildInfo())
export const HEALTH_BEACON_MIN_INTERVAL_MS = 30_000
export const HEALTH_BEACON_MESSAGE_MAX = 120
export const HEALTH_BEACON_VERSION_MAX = 40
export const HEALTH_RECENT_MS = 10 * 60_000 // errors and drops older than this are not amber
export const HEALTH_DROPS_AMBER = 3
export const PYTHON_STATUSES = Object.freeze(['idle', 'loading', 'ready', 'error', 'stuck'])
export const isIgnoredError = (message) => /^ResizeObserver loop/i.test(String(message ?? ''))
// First line, quoted text (or an unterminated quote's tail) and links removed, 120 chars at most.
export function sanitizeErrorMessage(message) {
  const max = HEALTH_BEACON_MESSAGE_MAX
  const text = String(message ?? '')
    .slice(0, max * 4)
    .split(/\r?\n/)[0]
    .replace(/https?:\/\/\S+/gi, '<link>')
    .replace(/(['"`])(?:(?!\1).)*(\1|$)/g, (_m, open, close) => `${open}…${close}`)
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return 'Unknown error'
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}
export function errorMessageOf(e) {
  if (typeof e === 'string') return e
  if (e instanceof Error) return e.message || e.name
  if (typeof e?.message === 'string' && e.message) return e.message
  return e?.error instanceof Error ? e.error.message : 'Unknown error'
}
/** One screen's counts and the summary to write. `now` stamps times (server time). */
export function createHealthBeaconState({ appVersion = 'dev', now = () => Date.now() } = {}) {
  const st = { appVersion, pythonStatus: 'idle', errorCount: 0, connectionDrops: 0 }
  let loadStartedAt = null
  let connected = null
  return {
    recordError(message) {
      if (isIgnoredError(message)) return false
      st.errorCount += 1
      st.lastError = sanitizeErrorMessage(message)
      st.lastErrorAt = now()
      return true
    },
    setPythonStatus(status) {
      const next = PYTHON_STATUSES.includes(status) ? status : 'idle'
      if (next === st.pythonStatus) return false
      // A load (or a retry after an error) starts the clock; a measured load time stays.
      if (next === 'loading' && st.pythonLoadMs == null) loadStartedAt = now()
      if (next === 'ready' && loadStartedAt != null && st.pythonLoadMs == null) {
        st.pythonLoadMs = Math.max(0, now() - loadStartedAt)
      }
      st.pythonStatus = next
      return true
    },
    // A drop is a connected → not connected change.
    setConnected(value) {
      const drop = value != null && !value && connected === true
      if (value != null) connected = !!value
      if (drop) st.lastDropAt = now()
      if (drop) st.connectionDrops += 1
      return drop
    },
    summary: () => ({ ...st }),
  }
}
const finite = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const wholeCount = (v) => Math.min(1_000_000, Math.max(0, Math.floor(finite(v) ?? 0)))

// A beacon read from the database, clamped before use: the rules do not check its shape yet (a
// `.validate` block is a follow-up needing a rules deploy). Null when it is not an object.
export function normalizeHealthBeacon(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const v = typeof raw.appVersion === 'string' && raw.appVersion ? raw.appVersion : null
  const out = {
    appVersion: v && v.slice(0, HEALTH_BEACON_VERSION_MAX),
    pythonStatus: PYTHON_STATUSES.includes(raw.pythonStatus) ? raw.pythonStatus : 'idle',
    errorCount: wholeCount(raw.errorCount),
    connectionDrops: wholeCount(raw.connectionDrops),
  }
  if ((finite(raw.pythonLoadMs) ?? -1) >= 0) out.pythonLoadMs = raw.pythonLoadMs
  if (typeof raw.lastError === 'string') out.lastError = sanitizeErrorMessage(raw.lastError)
  for (const k of ['lastErrorAt', 'lastDropAt', 'updatedAt'])
    if (finite(raw[k]) != null) out[k] = raw[k]
  return out
}
export function formatAgo(ms) {
  const secs = Math.max(0, Math.round(ms / 1000))
  const mins = Math.round(secs / 60)
  if (secs < 60) return `${secs} s ago`
  return mins < 60 ? `${mins} min ago` : `${Math.round(mins / 60)} h ago`
}
const isRecent = (at, now) => finite(at) != null && now - at <= HEALTH_RECENT_MS
/** One online student's { level: 'ok' | 'amber' | 'red', headline?, detail }, else null. */
export function studentHealthStatus(student, { now = Date.now(), appVersion = null } = {}) {
  if (!student?.online) return null
  const b = normalizeHealthBeacon(student.healthBeacon)
  const v = b?.appVersion
  const versionNote = v && (appVersion && v !== appVersion ? `v${v} (older version)` : `v${v}`)
  const detail = (text) => [text, versionNote].filter(Boolean).join(' · ')
  const status = (level, headline, text) => ({ level, headline, detail: detail(text) })
  if (b?.pythonStatus === 'error') return status('red', 'Python failed to load')
  if (b?.pythonStatus === 'stuck' || student.health === STUDENT_HEALTH.pythonStuck) {
    return status('red', 'Python stuck', 'Ask them to tap Reload')
  }
  // errorCount covers the whole page load, so the headline says only that one was recent.
  if (b?.errorCount > 0 && isRecent(b.lastErrorAt, now)) {
    const row = status('amber', 'Recent error', `Last error ${formatAgo(now - b.lastErrorAt)}`)
    return { ...row, message: b.lastError ?? null }
  }
  if (student.health === STUDENT_HEALTH.screenError) {
    return status('amber', 'Part of their screen hit an error', 'They see a Try again button')
  }
  if (b?.connectionDrops >= HEALTH_DROPS_AMBER && isRecent(b.lastDropAt, now)) {
    const ago = `Last drop ${formatAgo(now - b.lastDropAt)}`
    return status('amber', `Connection dropped ${b.connectionDrops} times`, ago)
  }
  return status('ok')
}
const RANK = { ok: 0, amber: 1, red: 2 }
/** The chip's { level, rows (red first, then by name), fineCount, total, checkedAt, versions }. */
export function classHealth(students, { now = Date.now(), appVersion = null } = {}) {
  const h = { rows: [], fineCount: 0, total: 0, checkedAt: null, versionTotal: 0, versionMatch: 0 }
  for (const student of students ?? []) {
    const s = studentHealthStatus(student, { now, appVersion })
    if (!s) continue
    h.total += 1
    const b = normalizeHealthBeacon(student.healthBeacon)
    if (b?.updatedAt != null) h.checkedAt = Math.max(h.checkedAt ?? 0, b.updatedAt)
    if (b?.appVersion) h.versionTotal += 1
    if (b?.appVersion && (!appVersion || b.appVersion === appVersion)) h.versionMatch += 1
    if (s.level === 'ok') h.fineCount += 1
    else h.rows.push({ id: student.anonymousId, name: student.displayName || 'A student', ...s })
  }
  h.rows.sort((a, b) => RANK[b.level] - RANK[a.level] || String(a.name).localeCompare(b.name))
  h.level = h.rows.some((r) => r.level === 'red') ? 'red' : h.rows.length ? 'amber' : 'ok'
  return h
}
/** The report's per-student `screenHealth` (no times), or null without a beacon. */
export function reportScreenHealth(studentNode) {
  const b = normalizeHealthBeacon(studentNode?.healthBeacon)
  if (b) for (const k of ['lastErrorAt', 'lastDropAt', 'updatedAt']) delete b[k]
  return b
}
export const screenHealthFields = (node) =>
  reportScreenHealth(node) ? { screenHealth: reportScreenHealth(node) } : {}
