import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useIsMobile } from '../useIsMobile'

describe('useIsMobile', () => {
  let originalMatchMedia

  beforeEach(() => {
    originalMatchMedia = window.matchMedia
  })

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: originalMatchMedia,
    })
    // Reset innerWidth to a desktop-sized value
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 })
  })

  it('returns false when window.innerWidth is wider than the breakpoint', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 })
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it('returns true when window.innerWidth is narrower than the breakpoint', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 320 })
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it('updates to true when matchMedia fires a matching change event', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 })

    let capturedHandler = null
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: (_event, handler) => {
          capturedHandler = handler
        },
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    })

    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)

    act(() => {
      capturedHandler({ matches: true })
    })

    expect(result.current).toBe(true)
  })

  it('updates to false when matchMedia fires a non-matching change event', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 320 })

    let capturedHandler = null
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query) => ({
        matches: true,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: (_event, handler) => {
          capturedHandler = handler
        },
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    })

    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)

    act(() => {
      capturedHandler({ matches: false })
    })

    expect(result.current).toBe(false)
  })

  it('removes the event listener on unmount (cleanup)', () => {
    const removeEventListenerSpy = { called: false }

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {
          removeEventListenerSpy.called = true
        },
        dispatchEvent: () => false,
      }),
    })

    const { unmount } = renderHook(() => useIsMobile())
    unmount()

    expect(removeEventListenerSpy.called).toBe(true)
  })

  it('respects a custom breakpoint', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 900 })
    // Width 900 is above default 640 (not mobile) but below 1024 (mobile at that breakpoint)
    const { result } = renderHook(() => useIsMobile(1024))
    expect(result.current).toBe(true)
  })
})
