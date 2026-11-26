import React, { useContext } from 'react'
import { InlineMarkdown } from '../../../shared/markdown'
import { parsePollChoice, tallyPollTask } from '../../../shared/classPolls'
import PollTileResult from '../polls/PollTileResult'
import { PollTaskClassContext } from './PollTaskClassContext'
import MultipleChoiceQuiz from './MultipleChoiceQuiz'
import { normalizeQuizAnswerText } from './quizUtils'

// A poll task (`quizType: poll`): the multiple-choice grid with no right answer. Choosing an
// option records it (never marked, so never a verdict banner or a revealed answer) and the
// student can change it at any time. In a live lesson the class split (counts and percentages on
// each tile, never who chose what) shows once the student has chosen, and live on the
// presentation window, unless the task sets `showResults: false`. The teacher sees each
// student's choice on their card and the option counts in the session report.
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
  // Each tile shows its own share (PollTileResult), "(your answer)" on the student's own pick.
  const large = !!classView?.presentation
  const tileResult = tally
    ? (option, look) => {
        const row = tally.options.find((candidate) => candidate.id === option.id)
        const mine = !large && (multiple ? chosenList.includes(option) : chosen === option)
        const shared = { respondedCount: tally.respondedCount, multiple, large, mine }
        return row && <PollTileResult count={row.count} {...shared} {...look} />
      }
    : null
  const hint =
    multiple && !disabled ? <div className="poll-quiz__hint">Pick all that apply.</div> : null
  const note =
    hasChosen && !disabled ? (
      <div className="poll-quiz__note" role="status">
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
          <div className="poll-quiz__answered">
            {multiple ? 'What the class picked' : 'How the class voted'} · {tally.respondedCount}{' '}
            answered
          </div>
        )}
      </>
    ) : null
  return (
    <MultipleChoiceQuiz
      {...props}
      multiple={multiple}
      optionExtra={tileResult}
      // Never locked by a "pass", never judged.
      checkPassed={false}
      showResult={false}
      showCorrectAnswer={false}
      footer={footer}
    />
  )
}
