import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  firstViewKey,
  prefersReducedMotion,
  resetFirstViews,
  staggerStyle,
  useFirstView,
  usePassMoment,
} from '../motion'

afterEach(() => {
  resetFirstViews()
  vi.unstubAllGlobals()
})

describe('prefersReducedMotion', () => {
  it('reads the media query', () => {
    vi.stubGlobal('matchMedia', (query) => ({ matches: query.includes('reduce') }))
    expect(prefersReducedMotion()).toBe(true)
  })

  it('is false when matchMedia is missing', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(prefersReducedMotion()).toBe(false)
  })
})

describe('staggerStyle', () => {
  it('sets the item index, never negative', () => {
    expect(staggerStyle(3)).toEqual({ '--motion-i': 3 })
    expect(staggerStyle(-2)).toEqual({ '--motion-i': 0 })
    expect(staggerStyle(undefined)).toEqual({ '--motion-i': 0 })
  })
})

describe('firstViewKey', () => {
  it('joins the non-empty parts', () => {
    expect(firstViewKey('explainer', 'lesson-1', 4)).toBe('explainer:lesson-1:4')
    expect(firstViewKey('explainer', null, 4)).toBe('explainer:4')
    expect(firstViewKey(null, '')).toBeNull()
  })
})

describe('useFirstView', () => {
  it('is true for the whole first mount, then false on a revisit', () => {
    const first = renderHook(() => useFirstView('quiz:1'))
    expect(first.result.current).toBe(true)
    first.rerender()
    expect(first.result.current).toBe(true)
    first.unmount()

    const revisit = renderHook(() => useFirstView('quiz:1'))
    expect(revisit.result.current).toBe(false)
  })

  it('treats a new key on the same mount as a first view', () => {
    const { result, rerender } = renderHook(({ id }) => useFirstView(`quiz:${id}`), {
      initialProps: { id: 1 },
    })
    expect(result.current).toBe(true)
    rerender({ id: 2 })
    expect(result.current).toBe(true)
    rerender({ id: 1 })
    expect(result.current).toBe(false)
  })

  it('never animates a null key', () => {
    const { result } = renderHook(() => useFirstView(null))
    expect(result.current).toBe(false)
  })

  it('forgets everything on reset', () => {
    renderHook(() => useFirstView('a')).unmount()
    resetFirstViews()
    expect(renderHook(() => useFirstView('a')).result.current).toBe(true)
  })
})

describe('usePassMoment', () => {
  it('counts false-to-true changes on the same task', () => {
    const { result, rerender } = renderHook(({ passed, id }) => usePassMoment(passed, id), {
      initialProps: { passed: false, id: 't1' },
    })
    expect(result.current).toBe(0)
    rerender({ passed: true, id: 't1' })
    expect(result.current).toBe(1)
    rerender({ passed: true, id: 't1' })
    expect(result.current).toBe(1)
    rerender({ passed: false, id: 't1' })
    rerender({ passed: true, id: 't1' })
    expect(result.current).toBe(2)
  })

  it('ignores a task that was already passed on arrival or restored on reload', () => {
    const { result, rerender } = renderHook(({ passed, id }) => usePassMoment(passed, id), {
      initialProps: { passed: true, id: 't1' },
    })
    expect(result.current).toBe(0)
    rerender({ passed: true, id: 't2' })
    expect(result.current).toBe(0)
  })

  it('starts again at zero on a new task', () => {
    const { result, rerender } = renderHook(({ passed, id }) => usePassMoment(passed, id), {
      initialProps: { passed: false, id: 't1' },
    })
    rerender({ passed: true, id: 't1' })
    expect(result.current).toBe(1)
    rerender({ passed: false, id: 't2' })
    expect(result.current).toBe(0)
    rerender({ passed: true, id: 't2' })
    expect(result.current).toBe(1)
  })
})
