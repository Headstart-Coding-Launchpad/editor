import React from 'react'
import { InlineMarkdown } from '../../shared/markdown'
import QuizTask, { CONFIDENCE_COLOURS, getQuizOptionText } from '../../app/components/QuizTask'
import { getTaskActivity } from '../registry.pure.js'

// Shared UI for the legacy quiz activities: each quiz_<type>/ui.jsx hosts the existing quiz
// components (QuizTask dispatches to src/app/components/quiz/* by quizType) through
// QuizActivityStudentView, and gives the teacher's StudentCard its compact answer summary
// (CardSummary).
//
// The quiz components report answers as onSelectAnswer(answer, passedOverride):
//   passedOverride === null        → an in-progress change (a tile placed, a gap typed)
//   anything else (bool/undefined) → a final answer (an option chosen, every tile placed,
//                                    Submit pressed)
// which the host sees as onChange(answer) and onSubmit(answer, { passedOverride }). The
// student's host marks a final answer with the definition's grade(); a teacher's "Edit
// answers" forwards passedOverride as the edit's `passed`, exactly as before.

/**
 * `result` is { submitted, passed } for the answer being shown (the student's own run status
 * and check result, or the mirrored ones on the teacher's screens). The teacher variant
 * (`teacher`) shows the verdict banner and, once submitted, the correct answers — as the
 * StudentModal always has. The quiz components get the answer in its stored string form.
 */
export function QuizActivityStudentView({
  task,
  state,
  onChange,
  onSubmit,
  readOnly = false,
  teacher = false,
  result = null,
}) {
  const onSelectAnswer =
    readOnly || (!onChange && !onSubmit)
      ? undefined
      : (answer, passedOverride) => {
          if (passedOverride === null) onChange?.(answer)
          else onSubmit?.(answer, { passedOverride })
        }
  const selectedAnswer = state == null ? '' : (getTaskActivity(task)?.serialize(state) ?? '')
  return (
    <QuizTask
      task={task}
      showQuestion
      selectedAnswer={selectedAnswer}
      onSelectAnswer={onSelectAnswer}
      submitted={!!result?.submitted}
      checkPassed={result?.passed ?? false}
      disabled={readOnly}
      showResult={teacher}
      showCorrectAnswer={teacher}
    />
  )
}

const cardStyles = {
  answerId: {
    width: 24,
    height: 24,
    borderRadius: 5,
    background: 'var(--colour-primary)',
    color: '#fff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    textTransform: 'uppercase',
    fontSize: '0.78rem',
  },
  answerText: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    lineHeight: 1.3,
    color: 'var(--colour-text)',
    fontWeight: 600,
  },
  shortAnswerText: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    lineHeight: 1.4,
    color: 'var(--colour-text)',
    fontWeight: 500,
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    fontStyle: 'italic',
  },
  summaryText: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    lineHeight: 1.4,
    color: 'var(--colour-text)',
    fontWeight: 600,
  },
  confidenceBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    borderRadius: 8,
    color: '#fff',
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.9rem',
    flexShrink: 0,
  },
}

function NoAnswer() {
  return <span style={{ color: '#9ca3af', fontSize: 12 }}>No answer yet</span>
}

const hasAnswer = (raw) => raw != null && raw !== ''

// StudentCard summaries. `raw` is the mirrored currentAnswer; `submitted` / `passed` are the
// student's lastRunStatus === 'submitted' and checkPassed.
export function ChoiceCardSummary({ task, raw }) {
  if (!hasAnswer(raw)) return <NoAnswer />
  const text = getQuizOptionText(task, raw)
  return (
    <>
      <span style={cardStyles.answerId}>{raw}</span>
      <span style={cardStyles.answerText}>
        {text ? <InlineMarkdown content={text} /> : 'Selected answer'}
      </span>
    </>
  )
}

export function makeItemsCardSummary(definition) {
  return function ItemsCardSummary({ task, raw, state, submitted, passed }) {
    if (!hasAnswer(raw)) return <NoAnswer />
    return (
      <span style={cardStyles.summaryText}>
        {definition.summarize(task, state, { submitted, passed }).text}
      </span>
    )
  }
}

export function TextCardSummary({ raw }) {
  if (!hasAnswer(raw)) return <NoAnswer />
  return <span style={cardStyles.shortAnswerText}>{raw}</span>
}

export function ConfidenceCardSummary({ raw }) {
  if (!hasAnswer(raw)) return <NoAnswer />
  const level = parseInt(raw)
  return (
    <span
      style={{
        ...cardStyles.confidenceBadge,
        background: level >= 1 && level <= 5 ? CONFIDENCE_COLOURS[level - 1] : '#9ca3af',
      }}
    >
      {level}/5
    </span>
  )
}
