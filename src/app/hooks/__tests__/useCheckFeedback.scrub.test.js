// Handoff #92: the checks on a live scrub's release are not failed attempts for the student.
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useCheckFeedback } from '../useCheckFeedback'

describe('useCheckFeedback: scrub releases', () => {
  it('a failed scrub release shows feedback but is not logged or counted as a failure', () => {
    const onCheckResult = vi.fn()
    const { result } = renderHook(() => useCheckFeedback({ onCheckResult }))
    act(() => {
      result.current.applyCheckFeedback(false, 'Print hi')
    })
    act(() => {
      result.current.applyCheckFeedback(false, 'Print hi', { scrub: true })
    })
    expect(onCheckResult).toHaveBeenCalledTimes(1)
    expect(result.current.checkFailCount).toBe(1)
    expect(result.current.checkAttempted).toBe(true)
    expect(result.current.checkSuggestion).toBe('Print hi')
  })

  it('a passing scrub release counts as the pass', () => {
    const onCheckResult = vi.fn()
    const { result } = renderHook(() => useCheckFeedback({ onCheckResult }))
    act(() => {
      result.current.applyCheckFeedback(false, 'Print hi')
    })
    act(() => {
      result.current.applyCheckFeedback(true, '', { scrub: true })
    })
    expect(onCheckResult).toHaveBeenLastCalledWith(true)
    expect(result.current.checkFailCount).toBe(0)
    expect(result.current.checkPassed).toBe(true)
  })
})
