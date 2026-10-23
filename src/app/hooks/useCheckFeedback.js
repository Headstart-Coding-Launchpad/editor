import { useState, useRef, useEffect } from 'react'

export function useCheckFeedback({ myStudentData, currentTaskId, onCheckResult } = {}) {
  const [checkPassed, setCheckPassed] = useState(false)
  const [checkAttempted, setCheckAttempted] = useState(false)
  const [checkSuggestion, setCheckSuggestion] = useState('')
  const [repeatedSuggestionCount, setRepeatedSuggestionCount] = useState(0)
  const [checkFailCount, setCheckFailCount] = useState(0)
  const [testResults, setTestResults] = useState(null)
  const [offeredStageIndex, setOfferedStageIndex] = useState(-1)
  const [completePreviewShown, setCompletePreviewShown] = useState(false)
  const [stagePromptAccepted, setStagePromptAccepted] = useState(false)
  // The tutor's "Send hint" text for this task ({ text, at }), shown on the hint banner. It sets
  // no check state: it clears when a check result lands, a run starts or the task changes.
  const [teacherHint, setTeacherHint] = useState(null)

  const checkPassedRef = useRef(false)
  checkPassedRef.current = checkPassed
  const checkSuggestionRef = useRef('')
  checkSuggestionRef.current = checkSuggestion
  const onCheckResultRef = useRef(onCheckResult)
  onCheckResultRef.current = onCheckResult

  function resetRunFeedback() {
    // Clears per-run transient state. Does NOT reset checkFailCount or offeredStageIndex
    // so that cross-run progress (fail count, hint progression) is preserved.
    setCheckPassed(false)
    setCheckAttempted(false)
    setCheckSuggestion('')
    setRepeatedSuggestionCount(0)
    setTestResults(null)
    setStagePromptAccepted(false)
    setTeacherHint(null)
  }

  function resetCheckFeedback() {
    // Full reset including cross-run progress — use on task change or code reset.
    resetRunFeedback()
    setCheckFailCount(0)
    setOfferedStageIndex(-1)
    setCompletePreviewShown(false)
    setStagePromptAccepted(false)
  }

  // `skipLog` keeps a restored or automatic result (idle feedback, Show complete) out of the solo
  // log: only a checked Run the student made reports through `onCheckResult`.
  // `scrub` marks the checks on a live scrub's release: a failed one shows its feedback but is
  // not a failed attempt (no solo-log attempt, no fail-streak step); a passing one counts as usual.
  function applyCheckFeedback(passed, suggestion = '', { skipLog = false, scrub = false } = {}) {
    const scrubMiss = scrub && !passed
    if (!skipLog && !scrubMiss) onCheckResultRef.current?.(passed)
    const nextSuggestion = String(suggestion ?? '').trim()
    setTeacherHint(null)
    setCheckPassed(passed)
    setCheckAttempted(true)
    setCheckSuggestion(nextSuggestion)
    setStagePromptAccepted(false)
    setCheckFailCount((prev) => (passed ? 0 : scrubMiss ? prev : prev + 1))
    if (passed) setOfferedStageIndex(-1)
    if (passed) setCompletePreviewShown(false)
    setRepeatedSuggestionCount((prev) => {
      if (passed || !nextSuggestion) return 0
      return checkSuggestionRef.current === nextSuggestion ? prev + 1 : 1
    })
    return nextSuggestion
  }

  function markStagePromptAccepted() {
    setStagePromptAccepted(true)
  }

  // React to teacher overriding this student's check result
  useEffect(() => {
    if (!myStudentData?.checkOverridePushedAt) return
    setCheckPassed(myStudentData.checkOverridePassed)
    setCheckAttempted(true)
    setCheckSuggestion(
      myStudentData.checkOverridePassed ? '' : (myStudentData.checkOverrideHint ?? '')
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myStudentData?.checkOverridePushedAt])

  const sentHint = myStudentData?.teacherHint
  const sentHintAt = sentHint?.at ?? null
  useEffect(() => {
    const text = String(sentHint?.text ?? '').trim()
    const onThisTask = currentTaskId == null || String(sentHint?.taskId) === String(currentTaskId)
    setTeacherHint(text && onThisTask && sentHintAt ? { text, at: sentHintAt } : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentHintAt, currentTaskId])

  return {
    teacherHint,
    checkPassed,
    setCheckPassed,
    checkAttempted,
    setCheckAttempted,
    checkSuggestion,
    setCheckSuggestion,
    repeatedSuggestionCount,
    checkFailCount,
    testResults,
    setTestResults,
    checkPassedRef,
    offeredStageIndex,
    setOfferedStageIndex,
    completePreviewShown,
    setCompletePreviewShown,
    stagePromptAccepted,
    markStagePromptAccepted,
    resetRunFeedback,
    resetCheckFeedback,
    applyCheckFeedback,
  }
}
