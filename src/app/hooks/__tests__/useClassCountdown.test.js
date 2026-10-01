import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const audio = vi.hoisted(() => ({ playTimesUpChime: vi.fn() }))
vi.mock('../../nudgeAlert', () => ({ playTimesUpChime: audio.playTimesUpChime }))

import useClassCountdown, { TIMES_UP_VISIBLE_MS, useCountdownRemaining } from '../useClassCountdown'
import { setSoundsMuted } from '../../soundSettings'

const NOW = 2_000_000

function countdownEndingIn(ms, startedAgo = 0) {
  return { startedAt: NOW - startedAgo, endsAt: NOW + ms, durationMs: ms + startedAgo }
}

function renderCountdown(initial = {}) {
  return renderHook((props) => useClassCountdown(props), {
    initialProps: {
      countdown: null,
      serverTimeOffset: 0,
      enabled: true,
      playSound: true,
      soundsOff: false,
      ...initial,
    },
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
  audio.playTimesUpChime.mockReset()
  setSoundsMuted(false)
})

describe('useClassCountdown', () => {
  it('shows the Time’s up banner and plays the chime when a watched countdown hits zero', () => {
    const countdown = countdownEndingIn(10_000)
    const { result } = renderCountdown({ countdown })
    expect(result.current.timesUpAt).toBeNull()

    act(() => vi.advanceTimersByTime(9_999))
    expect(result.current.timesUpAt).toBeNull()
    act(() => vi.advanceTimersByTime(1))
    expect(result.current.timesUpAt).toBe(countdown.endsAt)
    expect(audio.playTimesUpChime).toHaveBeenCalledTimes(1)
  })

  it('auto-dismisses the banner', () => {
    const { result } = renderCountdown({ countdown: countdownEndingIn(1000) })
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.timesUpAt).not.toBeNull()
    act(() => vi.advanceTimersByTime(TIMES_UP_VISIBLE_MS))
    expect(result.current.timesUpAt).toBeNull()
  })

  it('does not replay Time’s up for a countdown that was already over on load', () => {
    const { result } = renderCountdown({ countdown: countdownEndingIn(-5000, 60_000) })
    act(() => vi.advanceTimersByTime(10_000))
    expect(result.current.timesUpAt).toBeNull()
    expect(audio.playTimesUpChime).not.toHaveBeenCalled()
  })

  it('counts to the server-time deadline', () => {
    // The server clock is 4s ahead of this device: 10s left in server time is 6s here.
    const { result } = renderCountdown({
      countdown: countdownEndingIn(10_000),
      serverTimeOffset: 4000,
    })
    act(() => vi.advanceTimersByTime(6000))
    expect(result.current.timesUpAt).not.toBeNull()
  })

  it('re-arms when the teacher adds time', () => {
    const first = countdownEndingIn(1000)
    const { result, rerender } = renderCountdown({ countdown: first })
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.timesUpAt).toBe(first.endsAt)

    const extended = { ...first, endsAt: NOW + 61_000, durationMs: 61_000 }
    rerender({ countdown: extended, serverTimeOffset: 0, enabled: true, playSound: true })
    // The old banner is stale once the deadline moves.
    expect(result.current.timesUpAt).toBeNull()
    act(() => vi.advanceTimersByTime(60_000))
    expect(result.current.timesUpAt).toBe(extended.endsAt)
    expect(audio.playTimesUpChime).toHaveBeenCalledTimes(2)
  })

  it('does nothing when the teacher stops the countdown first', () => {
    const { result, rerender } = renderCountdown({ countdown: countdownEndingIn(5000) })
    rerender({ countdown: null, serverTimeOffset: 0, enabled: true, playSound: true })
    act(() => vi.advanceTimersByTime(10_000))
    expect(result.current.timesUpAt).toBeNull()
    expect(audio.playTimesUpChime).not.toHaveBeenCalled()
  })

  it('shows the banner without sound when playSound is off (presentation window)', () => {
    const { result } = renderCountdown({ countdown: countdownEndingIn(1000), playSound: false })
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.timesUpAt).not.toBeNull()
    expect(audio.playTimesUpChime).not.toHaveBeenCalled()
  })

  it('respects the student’s mute and the tutor’s class-wide Sounds off', () => {
    setSoundsMuted(true)
    const muted = renderCountdown({ countdown: countdownEndingIn(1000) })
    act(() => vi.advanceTimersByTime(1000))
    expect(muted.result.current.timesUpAt).not.toBeNull()
    expect(audio.playTimesUpChime).not.toHaveBeenCalled()
    muted.unmount()

    setSoundsMuted(false)
    vi.setSystemTime(NOW)
    renderCountdown({ countdown: countdownEndingIn(1000), soundsOff: true })
    act(() => vi.advanceTimersByTime(1000))
    expect(audio.playTimesUpChime).not.toHaveBeenCalled()
  })

  it('stays quiet while disabled', () => {
    const { result } = renderCountdown({ countdown: countdownEndingIn(1000), enabled: false })
    act(() => vi.advanceTimersByTime(2000))
    expect(result.current.timesUpAt).toBeNull()
    expect(audio.playTimesUpChime).not.toHaveBeenCalled()
  })
})

describe('useCountdownRemaining', () => {
  it('ticks down and stops at zero', () => {
    const { result } = renderHook(() => useCountdownRemaining(countdownEndingIn(2000), 0))
    expect(result.current).toBe(2000)
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current).toBe(1000)
    act(() => vi.advanceTimersByTime(5000))
    expect(result.current).toBe(0)
  })

  it('applies the server time offset', () => {
    const { result } = renderHook(() => useCountdownRemaining(countdownEndingIn(10_000), 3000))
    expect(result.current).toBe(7000)
  })

  it('is null without a countdown', () => {
    const { result } = renderHook(() => useCountdownRemaining(null, 0))
    expect(result.current).toBeNull()
  })
})
