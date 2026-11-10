import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useStudentPresenceReporting } from '../useStudentPresenceReporting'

function setup(initial) {
  const registerPresence = vi.fn()
  const props = {
    phase: 'lesson',
    identity: { anonymousId: 'stu1' },
    session: { students: { stu1: initial } },
    connected: true,
    teacherPresentation: false,
    registerPresence,
    writeStudentPresence: vi.fn(),
    removeStudent: vi.fn(),
  }
  const hook = renderHook((p) => useStudentPresenceReporting(p), { initialProps: props })
  return { registerPresence, props, hook }
}

describe('useStudentPresenceReporting self-heal', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('does not re-register when online is already true', () => {
    const { registerPresence, props, hook } = setup({ online: true })
    expect(registerPresence).toHaveBeenCalledTimes(1)
    hook.rerender({ ...props, session: { students: { stu1: { online: true, x: 1 } } } })
    expect(registerPresence).toHaveBeenCalledTimes(1)
  })

  it('re-registers when a stale onDisconnect removed online while still connected', () => {
    const { registerPresence, props, hook } = setup({ online: true })
    vi.advanceTimersByTime(11000)
    hook.rerender({ ...props, session: { students: { stu1: { displayName: 'A' } } } })
    expect(registerPresence).toHaveBeenCalledTimes(2)
  })

  it('does not hammer: at most once per 10s while online stays missing', () => {
    const { registerPresence, props, hook } = setup({ online: true })
    vi.advanceTimersByTime(11000)
    hook.rerender({ ...props, session: { students: { stu1: { a: 1 } } } })
    hook.rerender({ ...props, session: { students: { stu1: { a: 2 } } } })
    expect(registerPresence).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(11000)
    hook.rerender({ ...props, session: { students: { stu1: { a: 3 } } } })
    expect(registerPresence).toHaveBeenCalledTimes(3)
  })

  it('does not recreate a removed student node', () => {
    const { registerPresence, props, hook } = setup({ online: true })
    vi.advanceTimersByTime(11000)
    hook.rerender({ ...props, session: { students: {} } })
    vi.advanceTimersByTime(30000)
    expect(registerPresence).toHaveBeenCalledTimes(1)
  })

  it('does not heal with a null session, when disconnected, or in teacher presentation', () => {
    const { registerPresence, props, hook } = setup({ online: true })
    vi.advanceTimersByTime(11000)
    hook.rerender({ ...props, session: null })
    vi.advanceTimersByTime(30000)
    hook.rerender({ ...props, connected: false, session: { students: { stu1: { a: 1 } } } })
    vi.advanceTimersByTime(30000)
    hook.rerender({
      ...props,
      teacherPresentation: true,
      session: { students: { stu1: { a: 1 } } },
    })
    vi.advanceTimersByTime(30000)
    expect(registerPresence).toHaveBeenCalledTimes(1)
  })

  it('heals from the interval without a rerender, and stops once online returns', () => {
    const { registerPresence, props, hook } = setup({ online: true })
    hook.rerender({ ...props, session: { students: { stu1: { a: 1 } } } })
    expect(registerPresence).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(10000)
    expect(registerPresence).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(10000)
    expect(registerPresence).toHaveBeenCalledTimes(3)
    hook.rerender({ ...props, session: { students: { stu1: { online: true } } } })
    vi.advanceTimersByTime(30000)
    expect(registerPresence).toHaveBeenCalledTimes(3)
  })

  it('swallows a rejected registerPresence', async () => {
    const { registerPresence, props, hook } = setup({ online: true })
    registerPresence.mockRejectedValue(new Error('offline'))
    vi.advanceTimersByTime(11000)
    hook.rerender({ ...props, session: { students: { stu1: { a: 1 } } } })
    await vi.advanceTimersByTimeAsync(0)
    expect(registerPresence).toHaveBeenCalledTimes(2)
  })
})
