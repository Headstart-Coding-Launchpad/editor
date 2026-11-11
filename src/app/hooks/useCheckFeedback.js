import { useState, useRef, useEffect } from 'react'

const NO_PLACE = Object.freeze({ top: '', step: 0, task: null })

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
  // The place on the hint ladder (C5): the task, its top hint and the rung shown. Kept across Runs
  // (a code module's task change leaves feedback alone, so the task is part of the place).
  const hintStepRef = useRef(NO_PLACE)

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
    hintStepRef.current = NO_PLACE
  }

  // A `steps` fail with the held top hint shows the hintLadder's next rung (the last stays); any
  // other fail shows the rung held. Both record the rung shown as the place. Only a pass, another
  // task or a tutor override restarts it; a crash (no top hint) leaves the place as is.
  function climbHintLadder(passed, suggestion, ladder, steps) {
    if (passed) hintStepRef.current = NO_PLACE
    const top = !passed && suggestion && ladder?.[0] === suggestion ? suggestion : ''
    if (!top) return suggestion
    const { step: at, top: heldTop, task } = hintStepRef.current
    const held = heldTop === top && task === currentTaskId ? at : -1
    const step = Math.min(Math.max(held + (steps ? 1 : 0), 0), ladder.length - 1)
    hintStepRef.current = { top, step, task: currentTaskId }
    return ladder[step]
  }

  // `skipLog` keeps a restored or automatic result (idle feedback, Show complete) out of the solo
  // log: only a checked Run the student made reports through `onCheckResult`.
  // `scrub` marks the checks on a live scrub's release: a failed one shows its feedback but is
  // not a failed attempt (no solo-log attempt, no fail-streak step); a passing one counts as usual.
  // `evaluation` (checks.js): its `hintLadder` gives a repeated mistake the next hint (C5), but
  // only with `completed: true` (a finished counted Run or Check); any other call holds the rung.
  function applyCheckFeedback(passed, suggestion = '', opts = {}) {
    const { skipLog, scrub, evaluation, completed = false } = opts
    const scrubMiss = scrub && !passed
    if (!skipLog && !scrubMiss) onCheckResultRef.current?.(passed)
    const steps = completed && !skipLog && !scrubMiss
    const shown = String(suggestion ?? '').trim()
    const nextSuggestion = climbHintLadder(passed, shown, evaluation?.hintLadder, steps)
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
    hintStepRef.current = NO_PLACE
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
