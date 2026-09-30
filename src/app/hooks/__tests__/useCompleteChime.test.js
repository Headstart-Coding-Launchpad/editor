import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const audio = vi.hoisted(() => ({ playCompleteChime: vi.fn() }))
vi.mock('../../nudgeAlert', () => ({ playCompleteChime: audio.playCompleteChime }))

import useCompleteChime, { COMPLETE_CHIME_ARRIVAL_GRACE_MS } from '../useCompleteChime'
import { setSoundsMuted } from '../../soundSettings'

let now = 1_000_000
function wait(ms = COMPLETE_CHIME_ARRIVAL_GRACE_MS + 1) {
  now += ms
}

function renderChime(initial = {}) {
  return renderHook((props) => useCompleteChime(props), {
    initialProps: { enabled: true, passed: false, taskKey: 'l:1', soundsOff: false, ...initial },
  })
}

beforeEach(() => {
  vi.spyOn(Date, 'now').mockImplementation(() => now)
})

afterEach(() => {
  vi.restoreAllMocks()
  audio.playCompleteChime.mockReset()
  setSoundsMuted(false)
})

describe('useCompleteChime', () => {
  it('chimes once when the checks pass while the student is watching', () => {
    const { rerender } = renderChime()
    wait()
    rerender({ enabled: true, passed: true, taskKey: 'l:1' })
    expect(audio.playCompleteChime).toHaveBeenCalledTimes(1)
  })

  it('does not chime again on a later fail then pass of the same task', () => {
    const { rerender } = renderChime()
    wait()
    rerender({ enabled: true, passed: true, taskKey: 'l:1' })
    rerender({ enabled: true, passed: false, taskKey: 'l:1' })
    rerender({ enabled: true, passed: true, taskKey: 'l:1' })
    expect(audio.playCompleteChime).toHaveBeenCalledTimes(1)

    // Back on the same task after visiting another one: still once.
    rerender({ enabled: true, passed: false, taskKey: 'l:2' })
    rerender({ enabled: true, passed: false, taskKey: 'l:1' })
    wait()
    rerender({ enabled: true, passed: true, taskKey: 'l:1' })
    expect(audio.playCompleteChime).toHaveBeenCalledTimes(1)
  })

  it('chimes again for the next task', () => {
    const { rerender } = renderChime()
    wait()
    rerender({ enabled: true, passed: true, taskKey: 'l:1' })
    rerender({ enabled: true, passed: false, taskKey: 'l:2' })
    wait()
    rerender({ enabled: true, passed: true, taskKey: 'l:2' })
    expect(audio.playCompleteChime).toHaveBeenCalledTimes(2)
  })

  it('stays silent on arriving at an already-passed task', () => {
    const { rerender } = renderChime({ passed: true })
    wait()
    rerender({ enabled: true, passed: true, taskKey: 'l:1' })
    expect(audio.playCompleteChime).not.toHaveBeenCalled()
  })

  it('treats a pass restored just after arrival as not watched, and never chimes that task', () => {
    const { rerender } = renderChime()
    rerender({ enabled: true, passed: true, taskKey: 'l:1' })
    expect(audio.playCompleteChime).not.toHaveBeenCalled()
    wait()
    rerender({ enabled: true, passed: false, taskKey: 'l:1' })
    rerender({ enabled: true, passed: true, taskKey: 'l:1' })
    expect(audio.playCompleteChime).not.toHaveBeenCalled()
  })

  it('is silent while disabled (presentation window, preview, personal sandbox)', () => {
    const { rerender } = renderChime({ enabled: false })
    wait()
    rerender({ enabled: false, passed: true, taskKey: 'l:1' })
    expect(audio.playCompleteChime).not.toHaveBeenCalled()
  })

  it("respects the student's mute", () => {
    setSoundsMuted(true)
    const { rerender } = renderChime()
    wait()
    rerender({ enabled: true, passed: true, taskKey: 'l:1' })
    expect(audio.playCompleteChime).not.toHaveBeenCalled()
  })

  it("respects the tutor's class-wide Sounds off", () => {
    const { rerender } = renderChime({ soundsOff: true })
    wait()
    rerender({ enabled: true, passed: true, taskKey: 'l:1', soundsOff: true })
    expect(audio.playCompleteChime).not.toHaveBeenCalled()
  })

  it('skipTask stops the next pass on that task from chiming (Show complete)', () => {
    const { result, rerender } = renderChime()
    wait()
    act(() => result.current.skipTask())
    rerender({ enabled: true, passed: true, taskKey: 'l:1' })
    expect(audio.playCompleteChime).not.toHaveBeenCalled()
  })
})
