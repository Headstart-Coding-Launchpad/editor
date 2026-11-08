import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

beforeEach(() => {
  vi.clearAllMocks()
  firebaseMocks.ref.mockImplementation((_db, path) => ({ path }))
  firebaseMocks.onValue.mockImplementation(() => vi.fn())
})

describe('useSession Skip optional tasks', () => {
  it('writes the session flag on, and removes it when off', async () => {
    const { result } = renderHook(() => useSession('lesson-1'))
    await act(async () => {
      await result.current.setSkipOptionalTasks(true)
    })
    expect(firebaseMocks.update).toHaveBeenLastCalledWith(
      { path: 'sessions/lesson-1' },
      { skipOptionalTasks: true }
    )
    await act(async () => {
      await result.current.setSkipOptionalTasks(false)
    })
    expect(firebaseMocks.update).toHaveBeenLastCalledWith(
      { path: 'sessions/lesson-1' },
      { skipOptionalTasks: null }
    )
  })
})
