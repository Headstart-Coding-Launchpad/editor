import React, { useContext } from 'react'
import { InlineMarkdown } from '../../../shared/markdown'
import { parsePollChoice, tallyPollTask } from '../../../shared/classPolls'
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
  const multiple = task?.multiple === true
  const chosenList = multiple
    ? (task?.options ?? []).filter((option) => parsePollChoice(selectedAnswer).includes(option.id))
    : []
  const chosen = multiple ? chosenList[0] : task?.options?.find((o) => o.id === selectedAnswer)
  const hasChosen = multiple ? chosenList.length > 0 : !!chosen
  const showSplit =
    !!classView && task?.showResults !== false && (classView.presentation || hasChosen)
  const tally = showSplit
    ? tallyPollTask(classView.session, task, {
        anonymousId: classView.anonymousId,
        choice: multiple ? (chosenList.length ? selectedAnswer : null) : (chosen?.id ?? null),
      })
    : null
  const hint = multiple && !disabled ? <div style={hintStyle}>Pick all that apply.</div> : null
  const note =
    hasChosen && !disabled ? (
      <div style={noteStyle} role="status">
        {multiple ? (
          <>You picked {chosenList.length}. You can change your answers.</>
        ) : (
          <>
            You chose <InlineMarkdown content={normalizeQuizAnswerText(chosen.text)} />. You can
            change your answer.
          </>
        )}
      </div>
    ) : null
  const footer =
    hint || note || tally ? (
      <>
        {hint}
        {note}
        {tally && (
          <div style={splitStyle}>
            <div style={splitHeadingStyle}>
              {multiple ? 'What the class picked' : 'How the class voted'} · {tally.respondedCount}{' '}
              answered
            </div>
            <PollResultBars
              options={tally.options}
              respondedCount={tally.respondedCount}
              multiple={multiple}
              highlight={
                classView.presentation
                  ? null
                  : multiple
                    ? chosenList.map((option) => task.options.indexOf(option))
                    : chosen
                      ? task.options.indexOf(chosen)
                      : null
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
      multiple={multiple}
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

const hintStyle = {
  fontFamily: 'var(--font-body)',
  fontSize: '0.88rem',
  fontWeight: 700,
  color: 'var(--colour-primary-dark)',
  flexShrink: 0,
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
