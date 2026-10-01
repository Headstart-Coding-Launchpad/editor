import React from 'react'
import { InlineMarkdown } from '../../../shared/markdown'
import MultipleChoiceQuiz from './MultipleChoiceQuiz'
import { normalizeQuizAnswerText } from './quizUtils'

// A poll task (`quizType: poll`): the multiple-choice grid with no right answer. Choosing an
// option records it (never marked, so never a verdict banner or a revealed answer) and the
// student can change it at any time. Nobody's choice is shown to anyone else; the teacher sees
// each student's choice on their card and the option counts in the session report.
export default function PollQuiz(props) {
  const { task, selectedAnswer, disabled } = props
  const chosen = task?.options?.find((option) => option.id === selectedAnswer)
  const footer =
    chosen && !disabled ? (
      <div style={noteStyle} role="status">
        You chose <InlineMarkdown content={normalizeQuizAnswerText(chosen.text)} />. You can change
        your answer.
      </div>
    ) : null
  return (
    <MultipleChoiceQuiz
      {...props}
      // Never locked by a "pass", never judged.
      checkPassed={false}
      showResult={false}
      showCorrectAnswer={false}
      footer={footer}
    />
  )
}

const noteStyle = {
  padding: '8px 12px',
  borderRadius: 6,
  background: 'var(--ui-surface-tint)',
  border: '1px solid var(--ui-border-strong)',
  color: 'var(--colour-primary-dark)',
  fontFamily: 'var(--font-body)',
  fontSize: '0.88rem',
  fontWeight: 600,
  flexShrink: 0,
}
