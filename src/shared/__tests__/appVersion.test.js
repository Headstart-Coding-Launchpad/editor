import { describe, expect, it } from 'vitest'
import {
  formatAppVersion,
  formatBuildDate,
  formatVersionNumber,
  getAppBuildInfo,
} from '../appVersion'

const INFO = {
  version: '1.0',
  build: 985,
  commit: '7a69ce2',
  builtAt: '2026-09-29T14:30:00.000Z',
}

describe('appVersion', () => {
  it('formats the full footer label', () => {
    expect(formatAppVersion(INFO)).toBe('LaunchPad v1.0.985 · 7a69ce2 · built 29 Sep 2026')
  })

  it('drops the build number when it is unknown', () => {
    expect(formatVersionNumber({ ...INFO, build: null })).toBe('1.0')
  })

  it('falls back to a dev label without build info', () => {
    expect(formatAppVersion(null)).toBe('LaunchPad vdev')
  })

  it('ignores an invalid build date', () => {
    expect(formatBuildDate('not a date')).toBeNull()
    expect(formatAppVersion({ ...INFO, builtAt: 'nope' })).toBe('LaunchPad v1.0.985 · 7a69ce2')
  })

  it('returns null when Vite did not inject build info (as under Vitest)', () => {
    expect(getAppBuildInfo()).toBeNull()
  })
})
