import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useSession } from '../useSession'

const firebaseMocks = vi.hoisted(() => ({
  ref: vi.fn(),
  onValue: vi.fn(),
  set: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  onDisconnect: vi.fn(() => ({ set: vi.fn(), remove: vi.fn() })),
}))

vi.mock('firebase/database', () => ({
  ref: (...args) => firebaseMocks.ref(...args),
  onValue: (...args) => firebaseMocks.onValue(...args),
  set: (...args) => firebaseMocks.set(...args),
  update: (...args) => firebaseMocks.update(...args),
  remove: (...args) => firebaseMocks.remove(...args),
  serverTimestamp: vi.fn(),
  onDisconnect: (...args) => firebaseMocks.onDisconnect(...args),
}))

vi.mock('../../../shared/firebase', () => ({
  db: {},
}))

describe('useSession', () => {
  it('does not subscribe to Realtime Database when disabled', () => {
    const { result } = renderHook(() => useSession('python-1-1', { enabled: false }))

    expect(result.current.session).toBe(null)
    expect(result.current.loading).toBe(false)
    expect(result.current.connected).toBe(null)
    expect(firebaseMocks.ref).not.toHaveBeenCalled()
    expect(firebaseMocks.onValue).not.toHaveBeenCalled()
  })
})
