import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const effects = vi.hoisted(() => ({
  stopFlash: vi.fn(),
  startTitleFlash: vi.fn(),
  playNudgeChime: vi.fn(),
  showNudgeNotification: vi.fn(),
}))

vi.mock('../../nudgeAlert', () => ({
  startTitleFlash: effects.startTitleFlash,
  playNudgeChime: effects.playNudgeChime,
  showNudgeNotification: effects.showNudgeNotification,
}))

import useNudgeAlert from '../useNudgeAlert'

let focused = true

beforeEach(() => {
  focused = true
  vi.spyOn(document, 'hasFocus').mockImplementation(() => focused)
  effects.startTitleFlash.mockReturnValue(effects.stopFlash)
})

afterEach(() => {
  vi.restoreAllMocks()
  Object.values(effects).forEach((fn) => fn.mockReset())
})

function renderNudge(initial) {
  return renderHook((props) => useNudgeAlert(props), {
    initialProps: {
      ready: true,
      enabled: true,
      studentPushedAt: null,
      classPushedAt: null,
      ...initial,
    },
  })
}

describe('useNudgeAlert', () => {
  it('does not replay a nudge that was already set when the session loaded', () => {
    const { result } = renderNudge({ studentPushedAt: 100, classPushedAt: 200 })
    expect(result.current.nudgeBannerVisible).toBe(false)
    expect(effects.playNudgeChime).not.toHaveBeenCalled()
  })

  it('alerts on a new per-student nudge and flashes the tab only when away', () => {
    const { result, rerender } = renderNudge({ studentPushedAt: 100 })
    focused = false
    rerender({ ready: true, enabled: true, studentPushedAt: 150, classPushedAt: null })

    expect(result.current.nudgeBannerVisible).toBe(true)
    expect(effects.playNudgeChime).toHaveBeenCalledTimes(1)
    expect(effects.showNudgeNotification).toHaveBeenCalledTimes(1)
    expect(effects.startTitleFlash).toHaveBeenCalledTimes(1)

    act(() => window.dispatchEvent(new Event('focus')))
    expect(effects.stopFlash).toHaveBeenCalledTimes(1)

    act(() => result.current.dismissNudge())
    expect(result.current.nudgeBannerVisible).toBe(false)
  })

  it('shows the banner and chime but no flash for a focused student', () => {
    const { result, rerender } = renderNudge({})
    rerender({ ready: true, enabled: true, studentPushedAt: 50, classPushedAt: null })
    expect(result.current.nudgeBannerVisible).toBe(true)
    expect(effects.startTitleFlash).not.toHaveBeenCalled()
    expect(effects.showNudgeNotification).not.toHaveBeenCalled()
  })

  it('ignores the class-wide "nudge Away" when this student is focused', () => {
    const { result, rerender } = renderNudge({})
    rerender({ ready: true, enabled: true, studentPushedAt: null, classPushedAt: 300 })
    expect(result.current.nudgeBannerVisible).toBe(false)
    expect(effects.playNudgeChime).not.toHaveBeenCalled()

    focused = false
    rerender({ ready: true, enabled: true, studentPushedAt: null, classPushedAt: 400 })
    expect(result.current.nudgeBannerVisible).toBe(true)
    expect(effects.startTitleFlash).toHaveBeenCalledTimes(1)
  })

  it('stays silent when disabled (solo, presentation)', () => {
    const { result, rerender } = renderNudge({ enabled: false })
    rerender({ ready: true, enabled: false, studentPushedAt: 999, classPushedAt: null })
    expect(result.current.nudgeBannerVisible).toBe(false)
    expect(effects.playNudgeChime).not.toHaveBeenCalled()
  })
})
