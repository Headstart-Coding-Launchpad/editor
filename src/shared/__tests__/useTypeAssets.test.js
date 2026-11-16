import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const listeners = []
const mockOnSnapshot = vi.fn((ref, onData) => {
  const unsub = vi.fn()
  listeners.push({ onData, unsub })
  return unsub
})
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((fs, col, id) => ({ col, id })),
  onSnapshot: (...args) => mockOnSnapshot(...args),
}))
vi.mock('../firebase', () => ({ firestore: {} }))

const { useTypeAssets } = await import('../useTypeAssets')

describe('useTypeAssets', () => {
  it('shares one listener per type across mounts and closes it with the last unmount', () => {
    const a = renderHook(() => useTypeAssets('scratch'))
    const b = renderHook(() => useTypeAssets('scratch'))
    expect(mockOnSnapshot).toHaveBeenCalledTimes(1)
    a.unmount()
    expect(listeners[0].unsub).not.toHaveBeenCalled()
    b.unmount()
    expect(listeners[0].unsub).toHaveBeenCalledTimes(1)
  })
})
