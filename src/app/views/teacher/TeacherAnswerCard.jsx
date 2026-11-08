import React from 'react'

/**
 * The teacher view's centre card (calm teacher view): "Task N · title" and a small Answer /
 * Starter (or Answer / Question only) toggle, around TeacherEditorPanel. The answer shows
 * first: the tutor teaches from the presentation window, so this screen answers "what does a
 * right answer look like". `toggle` is null when the task has no answer to show.
 */
export default function TeacherAnswerCard({
  taskNumber,
  title,
  answerShown,
  onShowAnswer,
  otherLabel = 'Starter',
  toggle = true,
  // A fill-height module workspace (capabilities.teacherFillHeight): the card fills the column.
  fill = false,
  children,
}) {
  return (
    <section
      className={`teacher-answer-card${fill ? ' teacher-answer-card--fill' : ''}`}
      data-testid="teacher-answer-card"
    >
      <header className="teacher-answer-card__head">
        <h2 className="teacher-answer-card__title">
          Task {taskNumber}
          {title ? ` · ${title}` : ''}
        </h2>
        {toggle && (
          <div className="teacher-answer-card__toggle" role="group" aria-label="Show">
            <button
              type="button"
              aria-pressed={answerShown}
              className={answerShown ? 'is-active' : undefined}
              onClick={() => onShowAnswer(true)}
            >
              Answer
            </button>
            <button
              type="button"
              aria-pressed={!answerShown}
              className={!answerShown ? 'is-active' : undefined}
              onClick={() => onShowAnswer(false)}
            >
              {otherLabel}
            </button>
          </div>
        )}
      </header>
      <div className="teacher-answer-card__body">{children}</div>
    </section>
  )
}
