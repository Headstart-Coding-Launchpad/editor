// Sessions a tutor never ended are recognised as stale and cleared (handoff #88, Ryan 2026-10-22).
import { describe, expect, it } from 'vitest'
import {
  STALE_AFTER_TEACHER_LEFT_MS,
  STALE_WITHOUT_MARKER_MS,
  isStaleSession,
} from '../staleSessions.js'

const NOW = 1_800_000_000_000

describe('isStaleSession', () => {
  it('is never stale while a tutor tab is on it', () => {
    const session = {
      state: 'active',
      createdAt: NOW - 3 * STALE_WITHOUT_MARKER_MS,
      teacherLeftAt: NOW - 2 * STALE_AFTER_TEACHER_LEFT_MS,
      teacherPresence: { tababc: true },
    }
    expect(isStaleSession(session, NOW)).toBe(false)
  })

  it('goes stale once the last tutor tab left long enough ago', () => {
    const base = { state: 'active', createdAt: NOW - 1000 }
    expect(isStaleSession({ ...base, teacherLeftAt: NOW - 60_000 }, NOW)).toBe(false)
    expect(
      isStaleSession({ ...base, teacherLeftAt: NOW - STALE_AFTER_TEACHER_LEFT_MS - 1 }, NOW)
    ).toBe(true)
  })

  it('falls back to age for sessions from before tutor tabs were marked', () => {
    expect(isStaleSession({ state: 'waiting', createdAt: NOW - 60_000 }, NOW)).toBe(false)
    expect(
      isStaleSession({ state: 'waiting', createdAt: NOW - STALE_WITHOUT_MARKER_MS - 1 }, NOW)
    ).toBe(true)
    expect(
      isStaleSession({ state: 'waiting', createdAt: NOW - STALE_WITHOUT_MARKER_MS - 1 }, NOW, {
        byAge: false,
      })
    ).toBe(false)
  })

  it('ignores ended or missing sessions', () => {
    expect(isStaleSession({ state: 'ended', createdAt: 0 }, NOW)).toBe(false)
    expect(isStaleSession(null, NOW)).toBe(false)
  })
})
