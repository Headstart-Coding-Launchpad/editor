import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SOUNDS_MUTED_KEY, readSoundsMuted, setSoundsMuted, useSoundsMuted } from '../soundSettings'

afterEach(() => {
  vi.restoreAllMocks()
  setSoundsMuted(false)
  window.localStorage.clear()
})

describe('soundSettings', () => {
  it("persists muted as '1' and removes the key when sounds are back on", () => {
    expect(readSoundsMuted()).toBe(false)
    setSoundsMuted(true)
    expect(window.localStorage.getItem(SOUNDS_MUTED_KEY)).toBe('1')
    expect(readSoundsMuted()).toBe(true)
    setSoundsMuted(false)
    expect(window.localStorage.getItem(SOUNDS_MUTED_KEY)).toBeNull()
    expect(readSoundsMuted()).toBe(false)
  })

  it('reads a mute saved earlier (a new page load)', () => {
    window.localStorage.setItem(SOUNDS_MUTED_KEY, '1')
    const { result } = renderHook(() => useSoundsMuted())
    expect(result.current[0]).toBe(true)
  })

  it('keeps working in memory when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const { result } = renderHook(() => useSoundsMuted())
    expect(result.current[0]).toBe(false)
    expect(() => act(() => result.current[1](true))).not.toThrow()
    expect(result.current[0]).toBe(true)
    expect(() => act(() => result.current[1](false))).not.toThrow()
    expect(result.current[0]).toBe(false)
  })

  it('keeps every mounted consumer in sync', () => {
    const a = renderHook(() => useSoundsMuted())
    const b = renderHook(() => useSoundsMuted())
    act(() => a.result.current[1](true))
    expect(a.result.current[0]).toBe(true)
    expect(b.result.current[0]).toBe(true)
    act(() => b.result.current[1](false))
    expect(a.result.current[0]).toBe(false)
  })

  it('follows a change made in another tab', () => {
    const { result } = renderHook(() => useSoundsMuted())
    act(() => {
      // The other tab has already written the shared localStorage.
      window.localStorage.setItem(SOUNDS_MUTED_KEY, '1')
      window.dispatchEvent(new StorageEvent('storage', { key: SOUNDS_MUTED_KEY, newValue: '1' }))
    })
    expect(result.current[0]).toBe(true)
  })
})
