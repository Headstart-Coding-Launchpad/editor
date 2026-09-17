import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useRemoteRunTrigger } from '../useRemoteRunTrigger'

describe('useRemoteRunTrigger', () => {
  it('runs once for a pending token and acknowledges it', () => {
    const run = vi.fn()
    const onHandled = vi.fn()
    const { rerender } = renderHook(
      ({ token }) => useRemoteRunTrigger(token, run, { onHandled }),
      { initialProps: { token: 111 } }
    )
    expect(run).toHaveBeenCalledTimes(1)
    expect(onHandled).toHaveBeenCalledWith(111)

    rerender({ token: 111 })
    expect(run).toHaveBeenCalledTimes(1)

    rerender({ token: 222 })
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('does nothing without a token', () => {
    const run = vi.fn()
    renderHook(() => useRemoteRunTrigger(null, run))
    expect(run).not.toHaveBeenCalled()
  })

  it('acknowledges but does not run while disabled (e.g. a read-only mirror)', () => {
    const run = vi.fn()
    const onHandled = vi.fn()
    renderHook(() => useRemoteRunTrigger(333, run, { enabled: false, onHandled }))
    expect(run).not.toHaveBeenCalled()
    expect(onHandled).toHaveBeenCalledWith(333)
  })
})
