import React, { useState } from 'react'
import CheckFeedbackBanner from '../CheckFeedbackBanner'
import { baseStyles as s, interactionStyles as sm, QuestionPanel } from './quizUtils'

export default function ShortAnswerQuiz({ task, selectedAnswer, onSelectAnswer, submitted, checkPassed, disabled, showQuestion, showResult }) {
  const [localAnswer, setLocalAnswer] = useState(typeof selectedAnswer === 'string' ? selectedAnswer : '')

  React.useEffect(() => {
    setLocalAnswer(typeof selectedAnswer === 'string' ? selectedAnswer : '')
  }, [selectedAnswer])

  function handleSubmit() {
    const trimmed = localAnswer.trim()
    if (!trimmed) return
    onSelectAnswer?.(trimmed)
  }

  return (
    <div style={s.wrap}>
      {showQuestion && <QuestionPanel task={task} />}

      <div style={sm.shortAnswerWrap}>
        <textarea
          style={sm.shortAnswerInput}
          value={localAnswer}
          onChange={e => setLocalAnswer(e.target.value)}
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
          <div style={sm.submittedAnswer}>
            Your answer: <strong>{localAnswer || (typeof selectedAnswer === 'string' ? selectedAnswer : '')}</strong>
          </div>
        )}
      </div>

      {showResult && submitted && (
        <CheckFeedbackBanner passed={checkPassed} failureMessage="Not quite right, try again." suggestion={task?.check?.hint ?? task?.feedback ?? ''} />
      )}
    </div>
  )
}
