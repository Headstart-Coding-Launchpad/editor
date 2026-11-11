import { useState, useRef, useEffect } from 'react'

export function useCheckFeedback({ myStudentData, currentTaskId, onCheckResult } = {}) {
  const [checkPassed, setCheckPassed] = useState(false)
  const [checkAttempted, setCheckAttempted] = useState(false)
  const [checkSuggestion, setCheckSuggestion] = useState('')
  const [checkFailCount, setCheckFailCount] = useState(0)
  const [testResults, setTestResults] = useState(null)
  const [offeredStageIndex, setOfferedStageIndex] = useState(-1)
  // false, true (the student's own See complete code) or 'teacher' (the tutor opened it).
  const [completePreviewShown, setCompletePreviewShown] = useState(false)
  const [stagePromptAccepted, setStagePromptAccepted] = useState(false)
  // The tutor's "Send hint" text for this task ({ text, at }), shown on the hint banner. It sets
  // no check state: it clears when a check result lands, a run starts or the task changes.
  const [teacherHint, setTeacherHint] = useState(null)

  const checkPassedRef = useRef(false)
  checkPassedRef.current = checkPassed
  const onCheckResultRef = useRef(onCheckResult)
  onCheckResultRef.current = onCheckResult
  // This task's place on the hint ladder (C5): the top hint and the rung shown. Kept across Runs.
  const hintStepRef = useRef({ top: '', step: 0 })

  function resetRunFeedback() {
    // Clears per-run transient state. Does NOT reset checkFailCount or offeredStageIndex
    // so that cross-run progress (fail count, hint progression) is preserved.
    setCheckPassed(false)
    setCheckAttempted(false)
    setCheckSuggestion('')
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
    hintStepRef.current = { top: '', step: 0 }
  }

  // A counted fail with the last top hint shows the hintLadder's next rung (the last one stays).
  function climbHintLadder(passed, suggestion, ladder, counted) {
    if (!counted && !passed) return suggestion
    const top = !passed && suggestion && ladder?.[0] === suggestion ? suggestion : ''
    const { step } = hintStepRef.current
    const next = top && hintStepRef.current.top === top ? Math.min(step + 1, ladder.length - 1) : 0
    hintStepRef.current = { top, step: next }
    return top ? ladder[next] : suggestion
  }

  // `skipLog` keeps a restored or automatic result (idle feedback, Show complete) out of the solo
  // log: only a checked Run the student made reports through `onCheckResult`.
  // `scrub` marks the checks on a live scrub's release: a failed one shows its feedback but is
  // not a failed attempt (no solo-log attempt, no fail-streak step); a passing one counts as usual.
  // `evaluation` (checks.js): its `hintLadder` gives a repeated mistake the next hint (C5).
  function applyCheckFeedback(passed, suggestion = '', { skipLog, scrub, evaluation } = {}) {
    const scrubMiss = scrub && !passed
    if (!skipLog && !scrubMiss) onCheckResultRef.current?.(passed)
    const nextSuggestion = climbHintLadder(
      passed,
      String(suggestion ?? '').trim(),
      evaluation?.hintLadder,
      !skipLog && !scrubMiss
    )
    setTeacherHint(null)
    // At once, not on the next render: a Run starting in the same moment must see it solved.
    checkPassedRef.current = passed
    setCheckPassed(passed)
    setCheckAttempted(true)
    setCheckSuggestion(nextSuggestion)
    setStagePromptAccepted(false)
    setCheckFailCount((prev) => (passed ? 0 : scrubMiss ? prev : prev + 1))
    if (passed) setOfferedStageIndex(-1)
    if (passed) setCompletePreviewShown(false)
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
