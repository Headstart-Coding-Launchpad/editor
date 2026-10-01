import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const audio = vi.hoisted(() => ({ playBadgeChime: vi.fn() }))
vi.mock('../../nudgeAlert', () => ({ playBadgeChime: audio.playBadgeChime }))

import useThumbsUp, { THUMBS_UP_MAX_AGE_MS, THUMBS_UP_VISIBLE_MS } from '../useThumbsUp'
import { setSoundsMuted } from '../../soundSettings'

const NOW = 1_000_000

function renderThumbsUp(initial = {}) {
  return renderHook((props) => useThumbsUp(props), {
    initialProps: { ready: true, enabled: true, pushedAt: null, soundsOff: false, ...initial },
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
  audio.playBadgeChime.mockReset()
  setSoundsMuted(false)
})

describe('useThumbsUp', () => {
  it('does not replay a 👍 that was already set when the session loaded', () => {
    const { result } = renderThumbsUp({ pushedAt: NOW - 1000 })
    expect(result.current.thumbsUpAt).toBeNull()
    expect(audio.playBadgeChime).not.toHaveBeenCalled()
  })

  it('shows a new 👍 with a chime, then auto-dismisses', () => {
    const { result, rerender } = renderThumbsUp({ pushedAt: NOW - 5000 })
    rerender({ ready: true, enabled: true, pushedAt: NOW, soundsOff: false })
    expect(result.current.thumbsUpAt).toBe(NOW)
    expect(audio.playBadgeChime).toHaveBeenCalledTimes(1)

    act(() => vi.advanceTimersByTime(THUMBS_UP_VISIBLE_MS - 1))
    expect(result.current.thumbsUpAt).toBe(NOW)
    act(() => vi.advanceTimersByTime(1))
    expect(result.current.thumbsUpAt).toBeNull()
  })

  it('restarts the timer for a second 👍', () => {
    const { result, rerender } = renderThumbsUp({})
    rerender({ ready: true, enabled: true, pushedAt: NOW, soundsOff: false })
    act(() => vi.advanceTimersByTime(2000))
    rerender({ ready: true, enabled: true, pushedAt: NOW + 2000, soundsOff: false })
    act(() => vi.advanceTimersByTime(2000))
    expect(result.current.thumbsUpAt).toBe(NOW + 2000)
    expect(audio.playBadgeChime).toHaveBeenCalledTimes(2)
  })

  it('ignores a push older than the max age', () => {
    const { result, rerender } = renderThumbsUp({})
    rerender({
      ready: true,
      enabled: true,
      pushedAt: NOW - THUMBS_UP_MAX_AGE_MS - 1,
      soundsOff: false,
    })
    expect(result.current.thumbsUpAt).toBeNull()
    expect(audio.playBadgeChime).not.toHaveBeenCalled()
  })

  it('stays silent when disabled and does not show that push once enabled', () => {
    const { result, rerender } = renderThumbsUp({ enabled: false })
    rerender({ ready: true, enabled: false, pushedAt: NOW, soundsOff: false })
    expect(result.current.thumbsUpAt).toBeNull()
    rerender({ ready: true, enabled: true, pushedAt: NOW, soundsOff: false })
    expect(result.current.thumbsUpAt).toBeNull()
    expect(audio.playBadgeChime).not.toHaveBeenCalled()
  })

  it('shows the toast without a chime when the tutor turned sounds off', () => {
    const { result, rerender } = renderThumbsUp({ soundsOff: true })
    rerender({ ready: true, enabled: true, pushedAt: NOW, soundsOff: true })
    expect(result.current.thumbsUpAt).toBe(NOW)
    expect(audio.playBadgeChime).not.toHaveBeenCalled()
  })

  it("respects the student's own mute", () => {
    setSoundsMuted(true)
    const { result, rerender } = renderThumbsUp({})
    rerender({ ready: true, enabled: true, pushedAt: NOW, soundsOff: false })
    expect(result.current.thumbsUpAt).toBe(NOW)
    expect(audio.playBadgeChime).not.toHaveBeenCalled()
  })

  it('waits for the session before taking a baseline', () => {
    const { result, rerender } = renderThumbsUp({ ready: false })
    rerender({ ready: true, enabled: true, pushedAt: NOW - 1000, soundsOff: false })
    expect(result.current.thumbsUpAt).toBeNull()
    rerender({ ready: true, enabled: true, pushedAt: NOW, soundsOff: false })
    expect(result.current.thumbsUpAt).toBe(NOW)
  })
})
