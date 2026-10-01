import { describe, expect, it } from 'vitest'
import {
  buildClassCountdown,
  CLASS_COUNTDOWN_MAX_MINUTES,
  extendClassCountdown,
  getClassCountdownRemainingMs,
  isClassCountdown,
  MINUTE_MS,
  parseCountdownMinutes,
} from '../classCountdown'
import { formatClock } from '../timeAgo'

const NOW = 1_000_000

describe('buildClassCountdown', () => {
  it('builds a deadline from server now', () => {
    expect(buildClassCountdown(2 * MINUTE_MS, NOW)).toEqual({
      startedAt: NOW,
      endsAt: NOW + 2 * MINUTE_MS,
      durationMs: 2 * MINUTE_MS,
    })
  })

  it('rejects zero, negative and non-numeric durations', () => {
    expect(buildClassCountdown(0, NOW)).toBeNull()
    expect(buildClassCountdown(-5, NOW)).toBeNull()
    expect(buildClassCountdown('soon', NOW)).toBeNull()
    expect(buildClassCountdown(MINUTE_MS, NaN)).toBeNull()
  })

  it('caps the duration', () => {
    const countdown = buildClassCountdown(10 * 60 * MINUTE_MS, NOW)
    expect(countdown.durationMs).toBe(CLASS_COUNTDOWN_MAX_MINUTES * MINUTE_MS)
  })
})

describe('extendClassCountdown', () => {
  const running = { startedAt: NOW, endsAt: NOW + MINUTE_MS, durationMs: MINUTE_MS }

  it('pushes a running deadline back', () => {
    expect(extendClassCountdown(running, MINUTE_MS, NOW + 1000)).toEqual({
      startedAt: NOW,
      endsAt: NOW + 2 * MINUTE_MS,
      durationMs: 2 * MINUTE_MS,
    })
  })

  it('restarts from now once the deadline has passed', () => {
    const later = NOW + 5 * MINUTE_MS
    expect(extendClassCountdown(running, MINUTE_MS, later).endsAt).toBe(later + MINUTE_MS)
  })

  it('returns null without a countdown or a usable amount', () => {
    expect(extendClassCountdown(null, MINUTE_MS, NOW)).toBeNull()
    expect(extendClassCountdown(running, 0, NOW)).toBeNull()
  })
})

describe('getClassCountdownRemainingMs', () => {
  it('counts down to zero and never below', () => {
    const countdown = { startedAt: NOW, endsAt: NOW + 30_000, durationMs: 30_000 }
    expect(getClassCountdownRemainingMs(countdown, NOW + 10_000)).toBe(20_000)
    expect(getClassCountdownRemainingMs(countdown, NOW + 40_000)).toBe(0)
  })

  it('is null without a valid countdown', () => {
    expect(getClassCountdownRemainingMs(null, NOW)).toBeNull()
    expect(getClassCountdownRemainingMs({ endsAt: NOW }, NOW)).toBeNull()
  })
})

describe('isClassCountdown', () => {
  it('needs numeric fields with endsAt not before startedAt', () => {
    expect(isClassCountdown({ startedAt: 1, endsAt: 2, durationMs: 1 })).toBe(true)
    expect(isClassCountdown({ startedAt: 3, endsAt: 2, durationMs: 1 })).toBe(false)
    expect(isClassCountdown({ startedAt: 1, endsAt: 2, durationMs: 0 })).toBe(false)
    expect(isClassCountdown(null)).toBe(false)
  })
})

describe('parseCountdownMinutes', () => {
  it('parses and clamps the custom field', () => {
    expect(parseCountdownMinutes('3')).toBe(3)
    expect(parseCountdownMinutes(' 1.5 ')).toBe(1.5)
    expect(parseCountdownMinutes('500')).toBe(CLASS_COUNTDOWN_MAX_MINUTES)
    expect(parseCountdownMinutes('')).toBeNull()
    expect(parseCountdownMinutes('0')).toBeNull()
    expect(parseCountdownMinutes('abc')).toBeNull()
  })
})

describe('formatClock', () => {
  it('formats minutes and hours', () => {
    expect(formatClock(65)).toBe('1:05')
    expect(formatClock(3725)).toBe('1:02:05')
    expect(formatClock(-3)).toBe('0:00')
  })
})
