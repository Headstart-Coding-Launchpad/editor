import React from 'react'
import { InlineMarkdown } from '../../shared/markdown'
import QuizTask, { getQuizOptionText } from '../../app/components/QuizTask'
import {
  confidenceColour,
  confidenceTextColour,
  formatConfidence,
  parseConfidenceRating,
} from '../../shared/confidenceScale.js'
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
// which the host sees as onChange(answer) and onSubmit(answer, { passedOverride }). Text typed
// into a submit-to-reveal box (short answer, typed gaps) is also reported as
// onDraftChange(text) → the host's onDraft, so the tutor sees the unsubmitted draft. The
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
  onDraft,
  readOnly = false,
  teacher = false,
  result = null,
  // Tutor "look again" highlights { [targetId]: { id, note } } and StudentModal's
  // tap-to-highlight (src/shared/tutorTileHighlights.js).
  tileHighlights = null,
  onTargetTap = null,
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
      onDraftChange={readOnly ? undefined : onDraft}
      submitted={!!result?.submitted}
      checkPassed={result?.passed ?? false}
      disabled={readOnly}
      showResult={teacher}
      showCorrectAnswer={teacher}
      tileHighlights={tileHighlights}
      onTargetTap={onTargetTap}
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
    minWidth: 48,
    height: 40,
    padding: '0 6px',
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

// The rating as an "N/10" pill in its level's colour (a grey "?" for anything else).
export function ConfidenceCardSummary({ raw }) {
  if (!hasAnswer(raw)) return <NoAnswer />
  const level = parseConfidenceRating(raw)
  return (
    <span
      style={{
        ...cardStyles.confidenceBadge,
        background: confidenceColour(level),
        color: level === null ? '#fff' : confidenceTextColour(level),
      }}
    >
      {level === null ? '?' : formatConfidence(level)}
    </span>
  )
}
