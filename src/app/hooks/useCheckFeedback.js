import { useState, useRef, useEffect } from 'react'

export function useCheckFeedback({ myStudentData } = {}) {
  const [checkPassed, setCheckPassed]         = useState(false)
  const [checkAttempted, setCheckAttempted]   = useState(false)
  const [checkSuggestion, setCheckSuggestion] = useState('')
  const [repeatedSuggestionCount, setRepeatedSuggestionCount] = useState(0)
  const [checkFailCount, setCheckFailCount]   = useState(0)
  const [testResults, setTestResults]         = useState(null)
  const [offeredStageIndex, setOfferedStageIndex] = useState(-1)

  const checkPassedRef    = useRef(false)
  checkPassedRef.current  = checkPassed
  const checkSuggestionRef    = useRef('')
  checkSuggestionRef.current  = checkSuggestion

  function resetRunFeedback() {
    // Clears per-run transient state. Does NOT reset checkFailCount or offeredStageIndex
    // so that cross-run progress (fail count, hint progression) is preserved.
    setCheckPassed(false)
    setCheckAttempted(false)
    setCheckSuggestion('')
    setRepeatedSuggestionCount(0)
    setTestResults(null)
  }

  function resetCheckFeedback() {
    // Full reset including cross-run progress — use on task change or code reset.
    resetRunFeedback()
    setCheckFailCount(0)
    setOfferedStageIndex(-1)
  }

  function applyCheckFeedback(passed, suggestion = '') {
    const nextSuggestion = passed ? '' : String(suggestion ?? '').trim()
    setCheckPassed(passed)
    setCheckAttempted(true)
    setCheckSuggestion(nextSuggestion)
    setCheckFailCount(prev => passed ? 0 : prev + 1)
    if (passed) setOfferedStageIndex(-1)
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
    checkFailCount,
    testResults, setTestResults,
    checkPassedRef,
    offeredStageIndex, setOfferedStageIndex,
    resetRunFeedback,
    resetCheckFeedback,
    applyCheckFeedback,
  }
}
