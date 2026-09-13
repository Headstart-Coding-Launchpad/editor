import { renderHook } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'
import { useIsTouchDevice } from '../useIsTouchDevice'

describe('useIsTouchDevice', () => {
  afterEach(() => {
    delete window.ontouchstart
    Object.defineProperty(window.navigator, 'maxTouchPoints', {
      configurable: true,
      value: 0,
    })
  })

  it('returns false when neither ontouchstart nor maxTouchPoints indicate touch support', () => {
    delete window.ontouchstart
    Object.defineProperty(window.navigator, 'maxTouchPoints', { configurable: true, value: 0 })
    const { result } = renderHook(() => useIsTouchDevice())
    expect(result.current).toBe(false)
  })

  it('returns true when ontouchstart is present', () => {
    window.ontouchstart = () => {}
    const { result } = renderHook(() => useIsTouchDevice())
    expect(result.current).toBe(true)
  })

  it('returns true when navigator.maxTouchPoints is greater than 0', () => {
    delete window.ontouchstart
    Object.defineProperty(window.navigator, 'maxTouchPoints', { configurable: true, value: 5 })
    const { result } = renderHook(() => useIsTouchDevice())
    expect(result.current).toBe(true)
  })
})
