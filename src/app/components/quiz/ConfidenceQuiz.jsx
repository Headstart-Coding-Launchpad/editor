import React from 'react'
import { baseStyles as s, CONFIDENCE_COLOURS, confidenceStyles as sc, QuestionPanel } from './quizUtils'

export default function ConfidenceQuiz({ task, selectedAnswer, onSelectAnswer, submitted, disabled, showQuestion }) {
  const blocked = disabled
  return (
    <div style={s.wrap}>
      {showQuestion && <QuestionPanel task={task} />}
      <div style={sc.wrap}>
        <div style={sc.labelRow}>
          <span style={sc.labelEdge}>👎 Not confident</span>
          <span style={sc.labelEdge}>Very confident 👍</span>
        </div>
        <div style={sc.buttons}>
          {CONFIDENCE_COLOURS.map((colour, i) => {
            const level = i + 1
            const isSelected = selectedAnswer === String(level)
            return (
              <button
                key={level}
                type="button"
                style={{
                  ...sc.btn,
                  background: isSelected ? colour : '#f3f4f6',
                  borderColor: colour,
                  color: isSelected ? '#fff' : colour,
                  opacity: blocked && !isSelected ? 0.35 : 1,
                  boxShadow: isSelected ? `0 0 0 4px ${colour}38, 0 6px 18px ${colour}28` : undefined,
                  transform: isSelected ? 'scale(1.08)' : undefined,
                }}
                onClick={() => !blocked && onSelectAnswer?.(String(level), true)}
                disabled={blocked}
                aria-pressed={isSelected}
                title={`Confidence level ${level}`}
              >
                <span style={sc.btnNum}>{level}</span>
                {level === 1 && <span style={sc.btnIcon}>👎</span>}
                {level === 5 && <span style={sc.btnIcon}>👍</span>}
              </button>
            )
          })}
        </div>
        {submitted && selectedAnswer && (
          <div style={{ ...sc.result, borderColor: CONFIDENCE_COLOURS[parseInt(selectedAnswer) - 1], color: CONFIDENCE_COLOURS[parseInt(selectedAnswer) - 1], background: CONFIDENCE_COLOURS[parseInt(selectedAnswer) - 1] + '18' }}>
            You rated your confidence: <strong>{selectedAnswer} / 5</strong>
          </div>
        )}
      </div>
    </div>
  )
}
