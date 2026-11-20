import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import useHealthBeacon from '../useHealthBeacon'
import { HEALTH_BEACON_MIN_INTERVAL_MS } from '../../../shared/healthBeacon'

const NOW = 5_000_000

function fireError(message) {
  window.dispatchEvent(new ErrorEvent('error', { message, error: new Error(message) }))
}

function fireRejection(reason) {
  const event = new Event('unhandledrejection')
  event.reason = reason
  window.dispatchEvent(event)
}

function renderBeacon(initial = {}) {
  const write = vi.fn(() => Promise.resolve())
  const props = {
    enabled: true,
    anonymousId: 'kid-1',
    write,
    pythonStatus: 'idle',
    connected: true,
    appVersion: '1.0.985',
    ...initial,
  }
  const hook = renderHook((p) => useHealthBeacon(p), { initialProps: props })
  return { ...hook, write, props }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useHealthBeacon (Fun moment: an error on a student reaches the tutor, throttled)', () => {
  it('writes one summary when the student joins, with the app version', () => {
    const { write } = renderBeacon()
    expect(write).toHaveBeenCalledTimes(1)
    const [id, summary] = write.mock.calls[0]
    expect(id).toBe('kid-1')
    expect(summary).toMatchObject({ appVersion: '1.0.985', errorCount: 0, connectionDrops: 0 })
  })

  it('an error on the screen produces a summary, then later errors wait for the 30 s throttle', () => {
    const { write } = renderBeacon()
    write.mockClear()
    // The first write was just now: an error inside the window waits for it.
    act(() => fireError("Cannot read properties of undefined (reading 'answer')"))
    expect(write).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(HEALTH_BEACON_MIN_INTERVAL_MS)
    })
    expect(write).toHaveBeenCalledTimes(1)
    expect(write.mock.calls[0][1]).toMatchObject({ errorCount: 1 })
    // Quoted text (which could hold an answer or a name) never leaves the screen.
    expect(write.mock.calls[0][1].lastError).not.toMatch(/answer/)

    act(() => {
      fireError('boom one')
      fireRejection(new Error('boom two'))
    })
    act(() => {
      vi.advanceTimersByTime(HEALTH_BEACON_MIN_INTERVAL_MS - 1)
    })
    expect(write).toHaveBeenCalledTimes(1)
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(write).toHaveBeenCalledTimes(2)
    expect(write.mock.calls[1][1]).toMatchObject({ errorCount: 3, lastError: 'boom two' })
  })

  it('writes nothing more while nothing changes', () => {
    const { write } = renderBeacon()
    act(() => {
      vi.advanceTimersByTime(HEALTH_BEACON_MIN_INTERVAL_MS * 10)
    })
    expect(write).toHaveBeenCalledTimes(1)
  })

  it('counts connection drops and Python load time', () => {
    const { write, rerender, props } = renderBeacon({ pythonStatus: 'loading' })
    act(() => {
      vi.advanceTimersByTime(4000)
    })
    rerender({ ...props, pythonStatus: 'ready', connected: false })
    rerender({ ...props, pythonStatus: 'ready', connected: true })
    rerender({ ...props, pythonStatus: 'ready', connected: false })
    rerender({ ...props, pythonStatus: 'ready', connected: true })
    act(() => {
      vi.advanceTimersByTime(HEALTH_BEACON_MIN_INTERVAL_MS)
    })
    const last = write.mock.calls.at(-1)[1]
    expect(last).toMatchObject({ pythonStatus: 'ready', pythonLoadMs: 4000, connectionDrops: 2 })
  })

  it('never writes while disabled (preview, presentation, no student node)', () => {
    const { write } = renderBeacon({ enabled: false })
    act(() => {
      fireError('boom')
      vi.advanceTimersByTime(HEALTH_BEACON_MIN_INTERVAL_MS * 2)
    })
    expect(write).not.toHaveBeenCalled()
  })

  it('ignores the harmless ResizeObserver loop warning', () => {
    const { write } = renderBeacon()
    act(() => {
      fireError('ResizeObserver loop completed with undelivered notifications.')
      vi.advanceTimersByTime(HEALTH_BEACON_MIN_INTERVAL_MS * 2)
    })
    expect(write).toHaveBeenCalledTimes(1)
  })
})
