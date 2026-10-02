import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSession } from '../useSession'

const firebaseMocks = vi.hoisted(() => ({
  ref: vi.fn((_db, path) => ({ path })),
  onValue: vi.fn(),
  set: vi.fn(() => Promise.resolve()),
  update: vi.fn(() => Promise.resolve()),
  remove: vi.fn(() => Promise.resolve()),
  onDisconnect: vi.fn(() => ({
    set: vi.fn(() => Promise.resolve()),
    remove: vi.fn(() => Promise.resolve()),
  })),
  get: vi.fn(() => Promise.resolve({ val: () => null })),
}))

vi.mock('firebase/database', () => ({
  ref: (...args) => firebaseMocks.ref(...args),
  onValue: (...args) => firebaseMocks.onValue(...args),
  set: (...args) => firebaseMocks.set(...args),
  update: (...args) => firebaseMocks.update(...args),
  remove: (...args) => firebaseMocks.remove(...args),
  push: vi.fn((parentRef) => ({ path: `${parentRef.path}/pushed`, key: 'pushed' })),
  serverTimestamp: vi.fn(() => ({ '.sv': 'timestamp' })),
  onDisconnect: (...args) => firebaseMocks.onDisconnect(...args),
  get: (...args) => firebaseMocks.get(...args),
  runTransaction: vi.fn(() => Promise.resolve()),
}))

vi.mock('../../../shared/firebase', () => ({ db: {} }))

const NOW = 5_000_000
const COUNTDOWN_PATH = { path: 'sessions/lesson-1/classCountdown' }

let callbacks

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  callbacks = {}
  firebaseMocks.ref.mockImplementation((_db, path) => ({ path }))
  firebaseMocks.onValue.mockImplementation((refObj, callback) => {
    callbacks[refObj.path] = callback
    return vi.fn()
  })
})

afterEach(() => {
  vi.useRealTimers()
})

function fire(path, value) {
  act(() => {
    callbacks[path]?.({ exists: () => value !== null, val: () => value })
  })
}

describe('useSession class countdown', () => {
  it('exposes Firebase .info/serverTimeOffset (0 until it arrives)', () => {
    const { result } = renderHook(() => useSession('lesson-1'))
    expect(result.current.serverTimeOffset).toBe(0)
    fire('.info/serverTimeOffset', 2500)
    expect(result.current.serverTimeOffset).toBe(2500)
    fire('.info/serverTimeOffset', null)
    expect(result.current.serverTimeOffset).toBe(0)
  })

  it('does not subscribe to the server time offset when disabled', () => {
    renderHook(() => useSession('lesson-1', { enabled: false }))
    expect(callbacks['.info/serverTimeOffset']).toBeUndefined()
  })

  it('starts a countdown with the deadline in server time', async () => {
    const { result } = renderHook(() => useSession('lesson-1'))
    fire('.info/serverTimeOffset', 3000)
    await act(async () => {
      await result.current.startClassCountdown(120_000)
    })
    expect(firebaseMocks.set).toHaveBeenCalledWith(COUNTDOWN_PATH, {
      startedAt: NOW + 3000,
      endsAt: NOW + 3000 + 120_000,
      durationMs: 120_000,
    })
  })

  it('ignores an unusable duration', async () => {
    const { result } = renderHook(() => useSession('lesson-1'))
    await act(async () => {
      await result.current.startClassCountdown(0)
    })
    expect(firebaseMocks.set).not.toHaveBeenCalled()
  })

  it('adds time to a running countdown', async () => {
    const { result } = renderHook(() => useSession('lesson-1'))
    fire('sessions/lesson-1', {
      state: 'active',
      classCountdown: { startedAt: NOW - 10_000, endsAt: NOW + 50_000, durationMs: 60_000 },
    })
    await act(async () => {
      await result.current.addClassCountdownTime(60_000)
    })
    expect(firebaseMocks.set).toHaveBeenCalledWith(COUNTDOWN_PATH, {
      startedAt: NOW - 10_000,
      endsAt: NOW + 110_000,
      durationMs: 120_000,
    })
  })

  it('restarts from now when adding time after the countdown hit zero', async () => {
    const { result } = renderHook(() => useSession('lesson-1'))
    fire('sessions/lesson-1', {
      state: 'active',
      classCountdown: { startedAt: NOW - 90_000, endsAt: NOW - 30_000, durationMs: 60_000 },
    })
    await act(async () => {
      await result.current.addClassCountdownTime(60_000)
    })
    expect(firebaseMocks.set).toHaveBeenCalledWith(
      COUNTDOWN_PATH,
      expect.objectContaining({ endsAt: NOW + 60_000 })
    )
  })

  it('does nothing when adding time without a countdown', async () => {
    const { result } = renderHook(() => useSession('lesson-1'))
    fire('sessions/lesson-1', { state: 'active' })
    await act(async () => {
      await result.current.addClassCountdownTime(60_000)
    })
    expect(firebaseMocks.set).not.toHaveBeenCalled()
  })

  it('clears the countdown', async () => {
    const { result } = renderHook(() => useSession('lesson-1'))
    await act(async () => {
      await result.current.clearClassCountdown()
    })
    expect(firebaseMocks.set).toHaveBeenCalledWith(COUNTDOWN_PATH, null)
  })

  it('createSession starts without a countdown', async () => {
    const { result } = renderHook(() => useSession('lesson-1'))
    await act(async () => {
      await result.current.createSession()
    })
    expect(firebaseMocks.set).toHaveBeenCalledWith(
      { path: 'sessions/lesson-1' },
      expect.objectContaining({ classCountdown: null })
    )
  })

  it('endSession clears the countdown', async () => {
    const { result } = renderHook(() => useSession('lesson-1'))
    await act(async () => {
      await result.current.endSession()
    })
    expect(firebaseMocks.update).toHaveBeenCalledWith(
      { path: 'sessions/lesson-1' },
      expect.objectContaining({ classCountdown: null })
    )
  })

  it('setTaskId leaves the countdown running', async () => {
    const { result } = renderHook(() => useSession('lesson-1'))
    fire('sessions/lesson-1', {
      state: 'active',
      classCountdown: { startedAt: NOW, endsAt: NOW + 60_000, durationMs: 60_000 },
    })
    await act(async () => {
      await result.current.setTaskId(2)
    })
    const writes = firebaseMocks.update.mock.calls.map(([, payload]) => payload)
    for (const payload of writes) expect(payload).not.toHaveProperty('classCountdown')
  })
})
