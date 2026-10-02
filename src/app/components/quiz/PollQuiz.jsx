import React, { useContext } from 'react'
import { InlineMarkdown } from '../../../shared/markdown'
import { tallyPollTask } from '../../../shared/classPolls'
import PollResultBars from '../polls/PollResultBars'
import { PollTaskClassContext } from './PollTaskClassContext'
import MultipleChoiceQuiz from './MultipleChoiceQuiz'
import { normalizeQuizAnswerText } from './quizUtils'

// A poll task (`quizType: poll`): the multiple-choice grid with no right answer. Choosing an
// option records it (never marked, so never a verdict banner or a revealed answer) and the
// student can change it at any time. In a live lesson the class split (percentages, never who
// chose what) shows once the student has chosen, and live on the presentation window, unless
// the task sets `showResults: false`. The teacher sees each student's choice on their card and
// the option counts in the session report.
export default function PollQuiz(props) {
  const { task, selectedAnswer, disabled } = props
  const classView = useContext(PollTaskClassContext)
  const chosen = task?.options?.find((option) => option.id === selectedAnswer)
  const showSplit =
    !!classView && task?.showResults !== false && (classView.presentation || !!chosen)
  const tally = showSplit
    ? tallyPollTask(classView.session, task, {
        anonymousId: classView.anonymousId,
        choice: chosen?.id ?? null,
      })
    : null
  const note =
    chosen && !disabled ? (
      <div style={noteStyle} role="status">
        You chose <InlineMarkdown content={normalizeQuizAnswerText(chosen.text)} />. You can change
        your answer.
      </div>
    ) : null
  const footer =
    note || tally ? (
      <>
        {note}
        {tally && (
          <div style={splitStyle}>
            <div style={splitHeadingStyle}>
              How the class voted · {tally.respondedCount} answered
            </div>
            <PollResultBars
              options={tally.options}
              respondedCount={tally.respondedCount}
              highlight={
                classView.presentation ? null : chosen ? task.options.indexOf(chosen) : null
              }
              large={classView.presentation}
            />
          </div>
        )}
      </>
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

const splitStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  flexShrink: 0,
}

const splitHeadingStyle = {
  fontFamily: 'var(--font-body)',
  fontSize: '0.82rem',
  fontWeight: 700,
  color: 'var(--colour-primary-dark)',
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
