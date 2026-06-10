import { useState, useRef, useEffect } from 'react'

export function useCheckFeedback({ myStudentData } = {}) {
  const [checkPassed, setCheckPassed]         = useState(false)
  const [checkAttempted, setCheckAttempted]   = useState(false)
  const [checkSuggestion, setCheckSuggestion] = useState('')
  const [repeatedSuggestionCount, setRepeatedSuggestionCount] = useState(0)
  const [testResults, setTestResults]         = useState(null)

  const checkPassedRef    = useRef(false)
  checkPassedRef.current  = checkPassed
  const checkSuggestionRef    = useRef('')
  checkSuggestionRef.current  = checkSuggestion

  function resetCheckFeedback() {
    setCheckPassed(false)
    setCheckAttempted(false)
    setCheckSuggestion('')
    setRepeatedSuggestionCount(0)
    setTestResults(null)
  }

  function applyCheckFeedback(passed, suggestion = '') {
    const nextSuggestion = passed ? '' : String(suggestion ?? '').trim()
    setCheckPassed(passed)
    setCheckAttempted(true)
    setCheckSuggestion(nextSuggestion)
    setRepeatedSuggestionCount(prev => {
      if (passed || !nextSuggestion) return 0
      return checkSuggestionRef.current === nextSuggestion ? prev + 1 : 1
    })
    return nextSuggestion
  }

  // React to teacher overriding this student's check result
  useEffect(() => {
    if (!myStudentData?.checkOverridePushedAt) return
    setCheckPassed(myStudentData.checkOverridePassed)
    setCheckAttempted(true)
    setCheckSuggestion(myStudentData.checkOverridePassed ? '' : (myStudentData.checkOverrideHint ?? ''))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myStudentData?.checkOverridePushedAt])

  return {
    checkPassed, setCheckPassed,
    checkAttempted, setCheckAttempted,
    checkSuggestion, setCheckSuggestion,
    repeatedSuggestionCount,
    testResults, setTestResults,
    checkPassedRef,
    resetCheckFeedback,
    applyCheckFeedback,
  }
}
