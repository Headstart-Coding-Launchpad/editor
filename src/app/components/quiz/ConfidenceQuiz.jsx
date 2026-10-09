import React from 'react'
import { useChoiceEntrance } from '../../../activities/ui/choiceEntrance.jsx'
import {
  CONFIDENCE_SCALE,
  confidenceColour,
  confidenceLevels,
  confidenceTextColour,
  parseConfidenceRating,
} from '../../../shared/confidenceScale'
import { baseStyles as s, confidenceStyles as sc, QuestionPanel } from './quizUtils'

// The confidence check: ten buttons, red (1) to green (10), 👎 on 1 and 👍 on 10. One tap
// submits. The grid (.confidence-scale in src/index.css) is one row of ten when there is room
// and two rows of five on a narrow phone; every button is at least 44px square.
export default function ConfidenceQuiz({
  task,
  selectedAnswer,
  onSelectAnswer,
  submitted,
  disabled,
  showQuestion,
}) {
  const blocked = disabled
  const entrance = useChoiceEntrance()
  const selectedLevel = parseConfidenceRating(selectedAnswer)
  return (
    <div style={s.wrap}>
      {showQuestion && <QuestionPanel task={task} />}
      <div style={sc.wrap}>
        <div style={sc.labelRow}>
          <span style={sc.labelEdge}>👎 Not confident</span>
          <span style={sc.labelEdge}>Very confident 👍</span>
        </div>
        <div className="confidence-scale" role="group" aria-label="Confidence from 1 to 10">
          {confidenceLevels().map((level, i) => {
            const colour = confidenceColour(level)
            const isSelected = selectedLevel === level
            const buttonEntrance = entrance(i)
            // Light levels (amber to lime) need dark text to be readable.
            const lightLevel = confidenceTextColour(level) !== '#fff'
            return (
              <button
                key={level}
                type="button"
                className={buttonEntrance.className}
                style={{
                  ...sc.btn,
                  background: isSelected ? colour : '#f3f4f6',
                  borderColor: colour,
                  color: isSelected ? confidenceTextColour(level) : lightLevel ? '#374151' : colour,
                  opacity: blocked && !isSelected ? 0.35 : 1,
                  boxShadow: isSelected
                    ? `0 0 0 4px ${colour}38, 0 6px 18px ${colour}28`
                    : undefined,
                  transform: isSelected ? 'scale(1.08)' : undefined,
                  ...buttonEntrance.style,
                }}
                onClick={() => !blocked && onSelectAnswer?.(String(level), true)}
                disabled={blocked}
                aria-pressed={isSelected}
                title={`Confidence level ${level}`}
                aria-label={`${level} out of ${CONFIDENCE_SCALE}`}
              >
                <span style={sc.btnNum}>{level}</span>
                {level === 1 && <span style={sc.btnIcon}>👎</span>}
                {level === CONFIDENCE_SCALE && <span style={sc.btnIcon}>👍</span>}
              </button>
            )
          })}
        </div>
        {submitted && selectedLevel !== null && (
          <div
            style={{
              ...sc.result,
              borderColor: confidenceColour(selectedLevel),
              color: '#1f2937',
              background: confidenceColour(selectedLevel) + '18',
            }}
          >
            You rated your confidence:{' '}
            <strong>
              {selectedLevel} / {CONFIDENCE_SCALE}
            </strong>
          </div>
        )}
      </div>
    </div>
  )
}
