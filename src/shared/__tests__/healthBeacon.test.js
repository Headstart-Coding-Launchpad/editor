import { describe, expect, it } from 'vitest'
import {
  classHealth,
  createHealthBeaconState,
  errorMessageOf,
  formatAgo,
  HEALTH_BEACON_MESSAGE_MAX,
  HEALTH_RECENT_MS,
  HEALTH_BEACON_VERSION_MAX,
  normalizeHealthBeacon,
  isIgnoredError,
  reportScreenHealth,
  sanitizeErrorMessage,
  studentHealthStatus,
} from '../healthBeacon'

describe('sanitizeErrorMessage', () => {
  it('keeps the first line, takes out quoted text and links, and cuts it short', () => {
    expect(sanitizeErrorMessage('Bad "Mia" and \'42\' and `x = 1`\n  at foo (bar.js:1)')).toBe(
      'Bad "…" and \'…\' and `…`'
    )
    expect(sanitizeErrorMessage('Failed https://example.com/a?b=c here')).toBe('Failed <link> here')
    expect(sanitizeErrorMessage('x'.repeat(500))).toHaveLength(HEALTH_BEACON_MESSAGE_MAX)
    expect(sanitizeErrorMessage('')).toBe('Unknown error')
  })
})

describe('errorMessageOf / isIgnoredError', () => {
  it('reads errors, strings and events', () => {
    expect(errorMessageOf(new Error('a'))).toBe('a')
    expect(errorMessageOf('b')).toBe('b')
    expect(errorMessageOf({ message: 'c' })).toBe('c')
    expect(errorMessageOf(null)).toBe('Unknown error')
    expect(errorMessageOf({})).toBe('Unknown error')
  })

  it('ignores the ResizeObserver loop warning only', () => {
    expect(isIgnoredError('ResizeObserver loop limit exceeded')).toBe(true)
    expect(isIgnoredError('TypeError: x')).toBe(false)
  })
})

describe('createHealthBeaconState', () => {
  it('counts errors, Python load time and drops after the first connection', () => {
    let t = 1000
    const beacon = createHealthBeaconState({ appVersion: '1.2.3', now: () => t })
    expect(beacon.setConnected(false)).toBe(false) // never connected yet: not a drop
    beacon.setConnected(true)
    beacon.setPythonStatus('loading')
    t = 2500
    beacon.setPythonStatus('ready')
    expect(beacon.setPythonStatus('ready')).toBe(false)
    expect(beacon.setConnected(false)).toBe(true)
    expect(beacon.recordError('ResizeObserver loop completed')).toBe(false)
    beacon.recordError('boom')
    expect(beacon.summary()).toEqual({
      appVersion: '1.2.3',
      pythonStatus: 'ready',
      pythonLoadMs: 1500,
      errorCount: 1,
      lastError: 'boom',
      lastErrorAt: 2500,
      connectionDrops: 1,
      lastDropAt: 2500,
    })
  })

  it('treats an unknown Python status as idle', () => {
    const beacon = createHealthBeaconState()
    beacon.setPythonStatus('weird')
    expect(beacon.summary().pythonStatus).toBe('idle')
  })
})

describe('studentHealthStatus / classHealth', () => {
  const now = 10 * HEALTH_RECENT_MS
  const online = (healthBeacon, extra = {}) => ({ online: true, healthBeacon, ...extra })

  it('reads red, amber and fine', () => {
    expect(studentHealthStatus(online({ pythonStatus: 'stuck' }), { now }).level).toBe('red')
    expect(studentHealthStatus(online(undefined, { health: 'screen_error' }), { now }).level).toBe(
      'amber'
    )
    expect(
      studentHealthStatus(online({ connectionDrops: 3, lastDropAt: now - 1000 }), { now }).level
    ).toBe('amber')
    expect(
      studentHealthStatus(online({ connectionDrops: 2, lastDropAt: now - 1000 }), { now }).level
    ).toBe('ok')
    expect(studentHealthStatus({ online: false, healthBeacon: { pythonStatus: 'error' } })).toBe(
      null
    )
  })

  it('names the older version on a row', () => {
    const status = studentHealthStatus(
      online({ appVersion: '1.0.1', errorCount: 1, lastErrorAt: now - 5000 }),
      { now, appVersion: '1.0.2' }
    )
    expect(status.detail).toBe('Last error 5 s ago · v1.0.1 (older version)')
  })

  it('has no rows and level ok for an empty class', () => {
    expect(classHealth([], { now })).toMatchObject({ level: 'ok', rows: [], total: 0 })
  })
})

describe('formatAgo', () => {
  it('reads seconds, minutes and hours', () => {
    expect(formatAgo(40_000)).toBe('40 s ago')
    expect(formatAgo(3 * 60_000)).toBe('3 min ago')
    expect(formatAgo(2 * 3_600_000)).toBe('2 h ago')
  })
})

describe('reportScreenHealth', () => {
  it('is null without a beacon and fills safe defaults', () => {
    expect(reportScreenHealth({})).toBe(null)
    expect(reportScreenHealth({ healthBeacon: { pythonStatus: 'odd' } })).toEqual({
      appVersion: null,
      pythonStatus: 'idle',
      errorCount: 0,
      connectionDrops: 0,
    })
  })
})

describe('review fixes (R1 code review)', () => {
  it('strips an unterminated quote and everything after it', () => {
    expect(sanitizeErrorMessage("Unexpected token 'secret answer here")).toBe("Unexpected token '…")
    expect(sanitizeErrorMessage('Bad "Mia" then "open tail')).toBe('Bad "…" then "…')
  })

  it('clamps a hostile beacon on read: 1 MB lastError, long version, junk enum and counts', () => {
    const beacon = normalizeHealthBeacon({
      appVersion: 'v'.repeat(10_000),
      pythonStatus: 'pwned',
      errorCount: 1e12,
      connectionDrops: 'many',
      pythonLoadMs: -5,
      lastError: 'y'.repeat(1_000_000),
      lastErrorAt: 'yesterday',
      updatedAt: 99,
    })
    expect(beacon.appVersion).toHaveLength(HEALTH_BEACON_VERSION_MAX)
    expect(beacon.pythonStatus).toBe('idle')
    expect(beacon.errorCount).toBe(1_000_000)
    expect(beacon.connectionDrops).toBe(0)
    expect(beacon).not.toHaveProperty('pythonLoadMs')
    expect(beacon.lastError.length).toBeLessThanOrEqual(HEALTH_BEACON_MESSAGE_MAX)
    expect(beacon).not.toHaveProperty('lastErrorAt')
    expect(beacon.updatedAt).toBe(99)
    expect(normalizeHealthBeacon('nope')).toBe(null)
    expect(normalizeHealthBeacon([1])).toBe(null)
    expect(
      reportScreenHealth({ healthBeacon: { lastError: 'z'.repeat(1_000_000) } }).lastError.length
    ).toBeLessThanOrEqual(HEALTH_BEACON_MESSAGE_MAX)
  })

  it('times a retry after a failed load, and never overwrites a measured load time', () => {
    let t = 0
    const failed = createHealthBeaconState({ now: () => t })
    failed.setPythonStatus('loading')
    t = 5000
    failed.setPythonStatus('error')
    failed.setPythonStatus('loading') // retry starts the clock again
    t = 7000
    failed.setPythonStatus('ready')
    expect(failed.summary().pythonLoadMs).toBe(2000)

    failed.setPythonStatus('loading') // a later reload of the runtime
    t = 60_000
    failed.setPythonStatus('ready')
    expect(failed.summary().pythonLoadMs).toBe(2000)
  })

  it('says "Recent error" rather than a lifetime count', () => {
    const status = studentHealthStatus(
      { online: true, healthBeacon: { errorCount: 40, lastErrorAt: 1000 } },
      { now: 2000 }
    )
    expect(status.headline).toBe('Recent error')
  })
})
