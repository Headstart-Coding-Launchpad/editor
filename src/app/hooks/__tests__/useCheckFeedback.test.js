import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { useCheckFeedback } from '../useCheckFeedback'

describe('useCheckFeedback', () => {
  describe('initial state', () => {
    it('starts with all check state false/empty/null', () => {
      const { result } = renderHook(() => useCheckFeedback())
      expect(result.current.checkPassed).toBe(false)
      expect(result.current.checkAttempted).toBe(false)
      expect(result.current.checkSuggestion).toBe('')
      expect(result.current.repeatedSuggestionCount).toBe(0)
      expect(result.current.testResults).toBe(null)
    })
  })

  describe('resetCheckFeedback', () => {
    it('clears all check state', () => {
      const { result } = renderHook(() => useCheckFeedback())
      act(() => { result.current.applyCheckFeedback(true) })
      act(() => { result.current.setTestResults([{ id: 1, passed: true }]) })
      act(() => { result.current.resetCheckFeedback() })
      expect(result.current.checkPassed).toBe(false)
      expect(result.current.checkAttempted).toBe(false)
      expect(result.current.checkSuggestion).toBe('')
      expect(result.current.repeatedSuggestionCount).toBe(0)
      expect(result.current.testResults).toBe(null)
    })
  })

  describe('applyCheckFeedback', () => {
    it('sets passed=true, clears suggestion', () => {
      const { result } = renderHook(() => useCheckFeedback())
      act(() => { result.current.applyCheckFeedback(true) })
      expect(result.current.checkPassed).toBe(true)
      expect(result.current.checkAttempted).toBe(true)
      expect(result.current.checkSuggestion).toBe('')
      expect(result.current.repeatedSuggestionCount).toBe(0)
    })

    it('sets passed=false with a suggestion', () => {
      const { result } = renderHook(() => useCheckFeedback())
      act(() => { result.current.applyCheckFeedback(false, 'Try again') })
      expect(result.current.checkPassed).toBe(false)
      expect(result.current.checkAttempted).toBe(true)
      expect(result.current.checkSuggestion).toBe('Try again')
      expect(result.current.repeatedSuggestionCount).toBe(1)
    })

    it('trims whitespace from suggestion', () => {
      const { result } = renderHook(() => useCheckFeedback())
      act(() => { result.current.applyCheckFeedback(false, '  hint  ') })
      expect(result.current.checkSuggestion).toBe('hint')
    })

    it('increments repeatedSuggestionCount for the same suggestion', () => {
      const { result } = renderHook(() => useCheckFeedback())
      act(() => { result.current.applyCheckFeedback(false, 'same hint') })
      act(() => { result.current.applyCheckFeedback(false, 'same hint') })
      expect(result.current.repeatedSuggestionCount).toBe(2)
    })

    it('resets repeatedSuggestionCount when suggestion changes', () => {
      const { result } = renderHook(() => useCheckFeedback())
      act(() => { result.current.applyCheckFeedback(false, 'hint A') })
      act(() => { result.current.applyCheckFeedback(false, 'hint A') })
      act(() => { result.current.applyCheckFeedback(false, 'hint B') })
      expect(result.current.repeatedSuggestionCount).toBe(1)
    })

    it('resets repeatedSuggestionCount on pass', () => {
      const { result } = renderHook(() => useCheckFeedback())
      act(() => { result.current.applyCheckFeedback(false, 'hint') })
      act(() => { result.current.applyCheckFeedback(true) })
      expect(result.current.repeatedSuggestionCount).toBe(0)
    })

    it('returns the normalised suggestion string', () => {
      const { result } = renderHook(() => useCheckFeedback())
      let returned
      act(() => { returned = result.current.applyCheckFeedback(false, '  tip  ') })
      expect(returned).toBe('tip')
    })

    it('returns empty string when passing', () => {
      const { result } = renderHook(() => useCheckFeedback())
      let returned
      act(() => { returned = result.current.applyCheckFeedback(true, 'ignored') })
      expect(returned).toBe('')
    })
  })

  describe('checkPassedRef', () => {
    it('mirrors checkPassed synchronously', () => {
      const { result } = renderHook(() => useCheckFeedback())
      act(() => { result.current.applyCheckFeedback(true) })
      expect(result.current.checkPassedRef.current).toBe(true)
    })
  })

  describe('checkOverride effect', () => {
    it('applies override when checkOverridePushedAt changes', () => {
      let myStudentData = { checkOverridePushedAt: 100, checkOverridePassed: true, checkOverrideHint: '' }
      const { result, rerender } = renderHook(({ data }) => useCheckFeedback({ myStudentData: data }), {
        initialProps: { data: null },
      })

      rerender({ data: myStudentData })
      expect(result.current.checkPassed).toBe(true)
      expect(result.current.checkAttempted).toBe(true)
      expect(result.current.checkSuggestion).toBe('')
    })

    it('applies override with hint when passed=false', () => {
      const myStudentData = { checkOverridePushedAt: 200, checkOverridePassed: false, checkOverrideHint: 'Review line 3' }
      const { result, rerender } = renderHook(({ data }) => useCheckFeedback({ myStudentData: data }), {
        initialProps: { data: null },
      })

      rerender({ data: myStudentData })
      expect(result.current.checkPassed).toBe(false)
      expect(result.current.checkSuggestion).toBe('Review line 3')
    })

    it('does not fire when checkOverridePushedAt is absent', () => {
      const myStudentData = { checkOverridePassed: true }
      const { result, rerender } = renderHook(({ data }) => useCheckFeedback({ myStudentData: data }), {
        initialProps: { data: null },
      })

      rerender({ data: myStudentData })
      expect(result.current.checkPassed).toBe(false)
    })

    it('re-fires when checkOverridePushedAt changes again', () => {
      const { result, rerender } = renderHook(({ data }) => useCheckFeedback({ myStudentData: data }), {
        initialProps: { data: null },
      })

      rerender({ data: { checkOverridePushedAt: 100, checkOverridePassed: false, checkOverrideHint: 'hint 1' } })
      expect(result.current.checkSuggestion).toBe('hint 1')

      rerender({ data: { checkOverridePushedAt: 200, checkOverridePassed: true } })
      expect(result.current.checkPassed).toBe(true)
      expect(result.current.checkSuggestion).toBe('')
    })
  })
})
