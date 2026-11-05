import { useState } from 'react'
import { Field } from './TaskEditorFields'
import {
  getGalleryActivityDefinitions,
  getQuizActivityDefinitions,
  getTaskActivity,
} from '../../../activities/registry.pure.js'
import { getActivityUi } from '../../../activities/registry.js'
import { UNKNOWN_ACTIVITY_ID } from '../../../activities/resolve.js'
import { quizHasPictureOptions } from '../../../shared/quizPictureOptions.js'

// Registry-driven pickers for the Builder's Quiz and Activity task formats (plan step 2.4).
// Adding an activity (or a quiz sub-type) to the registry adds it here with no Builder change:
// labels, descriptions and icons come from each definition and its ui.jsx.

/**
 * Quiz-type picker: every category 'quiz' activity. `onSelect(definition)` receives the chosen
 * activity; `onQuizTypeChange(quizType)` is kept for older callers.
 *
 * Picture options are multiple-choice only, and leaving multiple choice turns each picture into
 * its caption (switchQuizType) for good. So on a quiz with pictures, choosing another quiz type
 * first shows an inline warning: "Keep Multiple choice" changes nothing, "Continue" converts.
 */
export function QuizTypePicker({ task, onSelect, onQuizTypeChange }) {
  const activeId = getTaskActivity(task)?.id
  // { taskId, definition }: the switch waiting for the author's yes, for this task only.
  const [pending, setPending] = useState(null)
  const pendingDefinition = pending && pending.taskId === task?.id ? pending.definition : null
  const choose = (definition) => {
    setPending(null)
    onSelect?.(definition)
    onQuizTypeChange?.(definition.legacy?.quizType)
  }
  const losesPictures = (definition) =>
    definition.id !== activeId &&
    definition.legacy?.quizType !== 'multiple_choice' &&
    quizHasPictureOptions(task)
  return (
    <Field label="Quiz type">
      <div className="te-quiz-type-grid">
        {getQuizActivityDefinitions().map((definition) => {
          const ui = getActivityUi(definition.id)
          const active = activeId === definition.id
          const Icon = ui?.BuilderIcon
          return (
            <button
              key={definition.id}
              type="button"
              className={active ? 'te-quiz-type-btn te-quiz-type-btn--active' : 'te-quiz-type-btn'}
              aria-pressed={active}
              data-activity={definition.id}
              title={definition.description || undefined}
              onClick={() => {
                if (losesPictures(definition)) setPending({ taskId: task?.id, definition })
                else choose(definition)
              }}
            >
              {Icon ? <Icon /> : <span aria-hidden="true">{definition.icon}</span>}
              <span className="te-quiz-type-label">{definition.label}</span>
              <span
                className={
                  active ? 'te-quiz-type-meta te-quiz-type-meta--active' : 'te-quiz-type-meta'
                }
              >
                {ui?.builderHint ?? definition.description}
              </span>
            </button>
          )
        })}
      </div>
      {pendingDefinition ? (
        <div
          className="te-act-message te-act-message--warning te-quiz-type-confirm"
          role="alert"
          data-testid="quiz-type-picture-confirm"
        >
          <span>
            Switching to {pendingDefinition.label} turns the pictures into their captions. This
            cannot be undone.
          </span>
          <span className="te-quiz-type-confirm__actions">
            <button
              type="button"
              className="te-quiz-type-confirm__btn"
              onClick={() => setPending(null)}
            >
              Keep Multiple choice
            </button>
            <button
              type="button"
              className="te-quiz-type-confirm__btn te-quiz-type-confirm__btn--go"
              onClick={() => choose(pendingDefinition)}
            >
              Continue to {pendingDefinition.label}
            </button>
          </span>
        </div>
      ) : null}
    </Field>
  )
}

/**
 * Activity gallery: every `taskType: 'activity'` activity, with its icon, label and description.
 * `onSelect(definition)` converts the task (TaskEditor keeps the title and description).
 */
export function ActivityGallery({ task, onSelect }) {
  const current = getTaskActivity(task)
  const unknown = current?.id === UNKNOWN_ACTIVITY_ID
  const activeId = current && !current.legacy && !unknown ? current.id : null
  const definitions = getGalleryActivityDefinitions()
  return (
    <Field label="Activity">
      <div className="te-activity-gallery" role="group" aria-label="Choose an activity">
        {definitions.map((definition) => {
          const active = activeId === definition.id
          return (
            <button
              key={definition.id}
              type="button"
              className={active ? 'te-activity-card te-activity-card--active' : 'te-activity-card'}
              aria-pressed={active}
              data-activity={definition.id}
              onClick={() => onSelect(definition)}
            >
              <span className="te-activity-card__icon" aria-hidden="true">
                {definition.icon || '🧩'}
              </span>
              <span className="te-activity-card__label">{definition.label}</span>
              {definition.description && (
                <span className="te-activity-card__desc">{definition.description}</span>
              )}
            </button>
          )
        })}
      </div>
      {!activeId && (
        <span className="te-activity-gallery__hint">
          {unknown
            ? `This task uses an activity this version doesn't know ("${task.activityType ?? ''}"). Choose one above to replace it.`
            : 'Choose an activity. The task keeps its title and description.'}
        </span>
      )}
    </Field>
  )
}
