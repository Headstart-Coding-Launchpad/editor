// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { handleOfKey, lessonIdOfKey, normaliseHandle, sessionKeyOf } from '../sessionKey'

describe('session keys (per-tutor live sessions)', () => {
  it('is just the lesson id when there is no tutor, so every old link behaves as before', () => {
    expect(sessionKeyOf('abc123', '')).toBe('abc123')
    expect(sessionKeyOf('abc123', null)).toBe('abc123')
    expect(sessionKeyOf('abc123', undefined)).toBe('abc123')
  })

  it('keeps Ryan on the plain lesson key, so his posted links and ?t=ryan open the same class', () => {
    expect(sessionKeyOf('abc123', 'ryan')).toBe('abc123')
    expect(sessionKeyOf('abc123', ' Ryan ')).toBe('abc123')
    expect(sessionKeyOf('abc123', 'ryan2')).toBe('abc123~ryan2')
  })

  it('adds the tutor handle for a tutor session, and splits it back', () => {
    const key = sessionKeyOf('abc123', 'Sam')
    expect(key).toBe('abc123~sam')
    expect(lessonIdOfKey(key)).toBe('abc123')
    expect(handleOfKey(key)).toBe('sam')
    expect(lessonIdOfKey('abc123')).toBe('abc123')
    expect(handleOfKey('abc123')).toBe('')
  })

  it('ignores anything that is not a plain handle (so a link cannot invent keys)', () => {
    for (const bad of [
      'a',
      'x'.repeat(21),
      'sam/../x',
      'sam.1',
      'sa m',
      '$sam',
      'sam~x',
      '#',
      '[sam]',
    ]) {
      expect(normaliseHandle(bad)).toBe('')
      expect(sessionKeyOf('abc123', bad)).toBe('abc123')
    }
    expect(normaliseHandle('  RYAN ')).toBe('ryan')
  })

  it('never produces a key Realtime Database refuses', () => {
    expect(sessionKeyOf('abc123', 'ryan')).not.toMatch(/[.$#[\]/]/)
  })
})
