import React from 'react'
import { Field } from './TaskEditorFields'
import {
  getGalleryActivityDefinitions,
  getQuizActivityDefinitions,
  getTaskActivity,
} from '../../../activities/registry.pure.js'
import { getActivityUi } from '../../../activities/registry.js'
import { UNKNOWN_ACTIVITY_ID } from '../../../activities/resolve.js'

// Registry-driven pickers for the Builder's Quiz and Activity task formats (plan step 2.4).
// Adding an activity (or a quiz sub-type) to the registry adds it here with no Builder change:
// labels, descriptions and icons come from each definition and its ui.jsx.

/**
 * Quiz-type picker: every category 'quiz' activity. `onSelect(definition)` receives the chosen
 * activity; `onQuizTypeChange(quizType)` is kept for older callers.
 */
export function QuizTypePicker({ task, onSelect, onQuizTypeChange }) {
  const activeId = getTaskActivity(task)?.id
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
                onSelect?.(definition)
                onQuizTypeChange?.(definition.legacy?.quizType)
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
