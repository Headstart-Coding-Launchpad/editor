import React from 'react'
import { InlineMarkdown } from '../../../shared/markdown'
import { optionHasPicture } from '../../../shared/quizPictureOptions.js'
import { QuizOptionPicture } from '../../components/quiz/QuizOptionPicture.jsx'
import {
  shortAnswerModel,
  shortAnswerResponses,
  tallyChoiceAnswers,
  teacherAnswerKind,
} from './teacherAnswer'

const OPTION_COLOURS = [
  { edge: '#2563eb', soft: '#eff6ff', bar: '#2563eb' },
  { edge: '#7c3aed', soft: '#f5f3ff', bar: '#7c3aed' },
  { edge: '#0891b2', soft: '#ecfeff', bar: '#0891b2' },
  { edge: '#db2777', soft: '#fdf2f8', bar: '#db2777' },
]

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

function NotAnswered({ names }) {
  if (!names.length) return null
  return (
    <div style={s.notAnswered} data-testid="quiz-answer-not-answered">
      <span>Not answered yet ({names.length}):</span>
      {names.map((name, i) => (
        <span key={`${name}-${i}`} style={s.nameChip}>
          {name}
        </span>
      ))}
    </div>
  )
}

function ChoiceAnswer({ task, students, classIsHere }) {
  const options = Array.isArray(task.options) ? task.options : []
  const tally = tallyChoiceAnswers(task, students)
  return (
    <div style={s.wrap}>
      {classIsHere && (
        <div style={s.summary} data-testid="quiz-answer-summary">
          {tally.answered} of {tally.total} answered
          {tally.correct != null ? `, ${tally.right} right` : ''}
        </div>
      )}
      <div style={s.grid}>
        {options.map((option, index) => {
          const colour = OPTION_COLOURS[index % OPTION_COLOURS.length]
          const isCorrect = option.id === tally.correct
          const count = tally.counts[option.id] ?? 0
          const share = tally.total > 0 ? count / tally.total : 0
          return (
            <div
              key={option.id}
              data-testid={`quiz-answer-option-${option.id}`}
              style={{
                ...s.option,
                borderColor: isCorrect ? '#16a34a' : colour.edge,
                background: colour.soft,
                ...(isCorrect ? s.optionCorrect : {}),
              }}
            >
              <div style={s.optionHead}>
                <span style={{ ...s.letter, background: colour.edge }}>
                  {String(option.id).toUpperCase()}
                </span>
                {optionHasPicture(option) && (
                  <QuizOptionPicture option={option} size={40} decorative />
                )}
                <span style={s.optionText}>
                  <InlineMarkdown content={option.text ?? ''} />
                </span>
                {isCorrect && <span style={s.correctTag}>✓ Correct answer</span>}
              </div>
              {classIsHere && (
                <div style={s.countRow}>
                  <span style={s.count}>{plural(count, 'student')}</span>
                  <span style={s.barTrack} aria-hidden="true">
                    <span
                      style={{
                        ...s.barFill,
                        width: `${Math.round(share * 100)}%`,
                        background: isCorrect ? '#16a34a' : colour.bar,
                      }}
                    />
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>
      {classIsHere && <NotAnswered names={tally.notAnswered} />}
    </div>
  )
}

function ShortAnswer({ task, students, classIsHere }) {
  const model = shortAnswerModel(task)
  const { responses, notAnswered } = shortAnswerResponses(students)
  return (
    <div style={s.wrap}>
      <div style={s.model} data-testid="short-answer-model">
        {model ? (
          <>
            <span style={s.modelLabel}>{model.label}</span>
            <code style={s.modelValue}>{model.value}</code>
          </>
        ) : (
          <span style={s.modelLabel}>Open answer: any answer is accepted (not marked)</span>
        )}
      </div>
      {classIsHere ? (
        <>
          <div style={s.responses} data-testid="short-answer-responses">
            <span style={s.responsesTitle}>Answers so far ({responses.length})</span>
            {responses.length === 0 && <span style={s.empty}>No answers yet.</span>}
            {responses.map((response) => (
              <div key={response.id} style={s.response}>
                <strong style={s.responseName}>{response.name}</strong>
                <span style={s.responseText}>{response.text}</span>
                {model && (
                  <span style={{ color: response.passed ? '#15803d' : '#b91c1c' }}>
                    {response.passed ? '✓' : '✗'}
                  </span>
                )}
              </div>
            ))}
          </div>
          <NotAnswered names={notAnswered} />
        </>
      ) : (
        <span style={s.empty}>The class is not on this task, so there are no answers yet.</span>
      )}
    </div>
  )
}

/**
 * The teacher view's Answer panel for a multiple-choice or short-answer quiz: the real options
 * with the correct one ticked and a count per option, or the model answer and the class's
 * submitted answers, plus who has not answered yet. Counts only show for the task the class is
 * on (`classIsHere`), since students' answers belong to that task.
 */
export default function TeacherQuizAnswer({ task, students = [], classIsHere = false }) {
  const kind = teacherAnswerKind(task)
  if (kind === 'choice')
    return <ChoiceAnswer task={task} students={students} classIsHere={classIsHere} />
  if (kind === 'short')
    return <ShortAnswer task={task} students={students} classIsHere={classIsHere} />
  return null
}

const s = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 10, padding: 14 },
  summary: { fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#166534' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 },
  option: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: 12,
    border: '2px solid',
    borderRadius: 10,
    minWidth: 0,
  },
  optionCorrect: { boxShadow: '0 0 0 3px rgba(22, 163, 74, 0.25)' },
  optionHead: { display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 },
  letter: {
    width: 26,
    height: 26,
    borderRadius: 6,
    color: '#fff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    flexShrink: 0,
  },
  optionText: {
    flex: 1,
    minWidth: 0,
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '1rem',
    color: 'var(--colour-text)',
    overflowWrap: 'anywhere',
  },
  correctTag: {
    flexShrink: 0,
    padding: '2px 8px',
    borderRadius: 999,
    background: '#15803d',
    color: '#fff',
    fontFamily: 'var(--font-body)',
    fontSize: '0.72rem',
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  countRow: { display: 'flex', alignItems: 'center', gap: 10 },
  count: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.85rem',
    color: 'var(--colour-text)',
    whiteSpace: 'nowrap',
    minWidth: 80,
  },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    background: 'rgba(255,255,255,0.9)',
    overflow: 'hidden',
  },
  barFill: { display: 'block', height: '100%', borderRadius: 999 },
  notAnswered: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    fontFamily: 'var(--font-body)',
    fontSize: '0.85rem',
    color: 'var(--colour-text)',
  },
  nameChip: {
    padding: '1px 8px',
    borderRadius: 6,
    background: '#f3f4f6',
    border: '1px solid #e5e7eb',
    fontFamily: 'var(--font-mono, monospace)',
    fontSize: '0.78rem',
  },
  model: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 10,
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
  },
  modelLabel: { fontWeight: 700, color: '#166534' },
  modelValue: {
    padding: '2px 8px',
    borderRadius: 6,
    background: '#f3f4f6',
    border: '1px solid #e5e7eb',
  },
  responses: { display: 'flex', flexDirection: 'column', gap: 6 },
  responsesTitle: {
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.82rem',
    color: '#374151',
  },
  response: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 10,
    padding: '6px 10px',
    borderRadius: 8,
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    fontFamily: 'var(--font-body)',
    fontSize: '0.88rem',
  },
  responseName: { flexShrink: 0 },
  responseText: { flex: 1, minWidth: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' },
  empty: { fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--colour-muted)' },
}
