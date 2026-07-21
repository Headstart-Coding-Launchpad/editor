import React, { useMemo } from 'react'
import { InlineMarkdown } from '../../../shared/markdown'
import CheckFeedbackBanner from '../CheckFeedbackBanner'
import { baseStyles as s, normalizeQuizAnswerText, OPTION_COLOURS, QuestionPanel } from './quizUtils'

export default function MultipleChoiceQuiz({ task, selectedAnswer, onSelectAnswer, submitted, checkPassed, disabled, showQuestion, showResult, showCorrectAnswer }) {
  const options = task?.options ?? []
  const correctId = task?.check?.type === 'answer_equals' ? task.check.value : null
  const revealAnswers = showCorrectAnswer && submitted && disabled && correctId
  const locked = disabled || (submitted && checkPassed)

  const shuffledOptions = useMemo(() => {
    const arr = [...options]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id])

  return (
    <div style={s.wrap}>
      {showQuestion && <QuestionPanel task={task} />}
      <div style={s.options} role="radiogroup" aria-label={task?.title ?? 'Quiz options'}>
        {shuffledOptions.map((option, index) => {
          const active = selectedAnswer === option.id
          const isCorrect = revealAnswers && option.id === correctId
          const isWrong = revealAnswers && active && option.id !== correctId
          const colour = OPTION_COLOURS[index % OPTION_COLOURS.length]

          const bg = isCorrect ? '#16a34a' : isWrong ? '#dc2626' : active ? colour.active : colour.background
          const border = isCorrect ? '#16a34a' : isWrong ? '#dc2626' : colour.border
          const textColour = isCorrect || isWrong || active ? '#fff' : colour.text
          const optionText = normalizeQuizAnswerText(option.text)

          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={active}
              style={{
                ...s.option,
                background: bg,
                borderColor: border,
                color: textColour,
                ...((active || isCorrect || isWrong) ? s.optionActive : {}),
              }}
              onClick={() => onSelectAnswer?.(option.id)}
              disabled={locked}
            >
              <span style={{ ...s.optionId, background: active || isCorrect || isWrong ? 'rgba(255,255,255,0.22)' : colour.active, color: '#fff' }}>
                {option.id}
              </span>
              <span style={s.optionText}>
                <span style={active || isCorrect || isWrong ? s.markdownOnDark : undefined}>
                  <InlineMarkdown content={optionText} />
                </span>
              </span>
            </button>
          )
        })}
      </div>
      {revealAnswers && !checkPassed && (
        <div style={s.correctAnswerNote}>
          Correct answer:{' '}
          <span style={s.correctAnswerText}>
            <InlineMarkdown content={normalizeQuizAnswerText(options.find(o => o.id === correctId)?.text ?? correctId)} />
          </span>
        </div>
      )}
      {showResult && submitted && (
        <CheckFeedbackBanner
          passed={checkPassed}
          failureMessage="Wrong answer, try again."
          suggestion={getMultipleChoiceSuggestion(task, selectedAnswer)}
        />
      )}
    </div>
  )
}

function getMultipleChoiceSuggestion(task, selectedAnswer) {
  if (checkPassedFromTask(task, selectedAnswer)) return ''
  const option = task?.options?.find(o => o.id === selectedAnswer)
  return String(option?.feedback ?? option?.hint ?? task?.feedback ?? task?.check?.hint ?? '').trim()
}

function checkPassedFromTask(task, selectedAnswer) {
  return task?.check?.type === 'answer_equals' && task.check.value === selectedAnswer
}
