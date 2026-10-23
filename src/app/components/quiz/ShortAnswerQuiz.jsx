import React, { useContext, useState } from 'react'
import CheckFeedbackBanner from '../CheckFeedbackBanner'
import { canShowResponses, getShownResponses } from '../../../shared/shownResponses'
import { PollTaskClassContext } from './PollTaskClassContext'
import ShownResponsesWall from './ShownResponsesWall'
import { baseStyles as s, interactionStyles as sm, QuestionPanel } from './quizUtils'

export default function ShortAnswerQuiz({
  task,
  selectedAnswer,
  onSelectAnswer,
  // (text) => void: the unsubmitted answer typed so far, mirrored to the tutor as a draft
  // (useActivityState onDraft). '' when there is nothing new to show.
  onDraftChange,
  submitted,
  checkPassed,
  disabled,
  showQuestion,
  showResult,
}) {
  const classView = useContext(PollTaskClassContext)
  const [localAnswer, setLocalAnswer] = useState(
    typeof selectedAnswer === 'string' ? selectedAnswer : ''
  )

  React.useEffect(() => {
    setLocalAnswer(typeof selectedAnswer === 'string' ? selectedAnswer : '')
  }, [selectedAnswer])

  function handleType(value) {
    setLocalAnswer(value)
    // Text that matches the submitted answer is not a draft.
    const submittedText = typeof selectedAnswer === 'string' ? selectedAnswer : ''
    onDraftChange?.(value.trim() && value.trim() !== submittedText.trim() ? value : '')
  }

  function handleSubmit() {
    const trimmed = localAnswer.trim()
    if (!trimmed) return
    onSelectAnswer?.(trimmed)
  }

  // On the presentation window, a task whose answers the teacher can show swaps the answer box
  // for the answers picked so far (src/shared/shownResponses.js).
  if (classView?.presentation && canShowResponses(task)) {
    return (
      <div style={s.wrap}>
        {showQuestion && <QuestionPanel task={task} />}
        <ShownResponsesWall responses={getShownResponses(classView.session, task.id)} />
      </div>
    )
  }

  // Go Live: students see the same wall above their own answer box (read-only).
  const liveWall =
    classView?.live && !classView.presentation && canShowResponses(task) ? (
      <ShownResponsesWall responses={getShownResponses(classView.session, task.id)} />
    ) : null

  const submittedAnswer = localAnswer || (typeof selectedAnswer === 'string' ? selectedAnswer : '')

  return (
    <div style={s.wrap}>
      {showQuestion && <QuestionPanel task={task} />}
      {liveWall}

      <div style={sm.shortAnswerWrap}>
        <textarea
          style={sm.shortAnswerInput}
          value={localAnswer}
          onChange={(e) => handleType(e.target.value)}
          placeholder="Type your answer here…"
          disabled={disabled || (submitted && checkPassed)}
          rows={3}
        />
        {!submitted && !disabled && (
          <button
            className="btn-primary"
            style={{ alignSelf: 'flex-start', padding: '8px 24px' }}
            onClick={handleSubmit}
            disabled={!localAnswer.trim()}
          >
            Submit Answer
          </button>
        )}
        {submitted && (
          // A clear "it went" after Submit (the plain grey strip was easy to miss). Worded to fit
          // a solo lesson too, where nobody is sent anything.
          <div style={sm.submittedAnswer} role="status">
            <span style={sm.submittedTick}>✅ Got it!</span> Your answer:{' '}
            <strong style={sm.submittedAnswerText}>{submittedAnswer}</strong>
          </div>
        )}
      </div>

      {showResult && submitted && (
        <CheckFeedbackBanner
          passed={checkPassed}
          failureMessage="Not quite right, try again."
          suggestion={task?.check?.hint ?? task?.feedback ?? ''}
        />
      )}
    </div>
  )
}
