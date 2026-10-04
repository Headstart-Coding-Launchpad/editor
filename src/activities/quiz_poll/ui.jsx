import React from 'react'
import { MarkdownFieldEditor } from '../../shared/MarkdownFieldEditor'
import { Field } from '../ui/BuilderField.jsx'
import { QuizTypeIcon } from '../quiz/QuizTypeIcon.jsx'
import { switchQuizType } from '../quiz/quizBuilder.js'
import { ChoiceCardSummary, QuizActivityStudentView } from '../quiz/QuizActivityViews.jsx'

const MAX_OPTIONS = 6

// Builder editor: the options only (2–6). A poll has no correct answer, feedback or check.
export function PollOptionsBuilder({ task, onUpdate, lessonType = null }) {
  const options = task.options?.length
    ? task.options
    : [
        { id: 'a', text: '' },
        { id: 'b', text: '' },
      ]

  function updateOptions(nextOptions) {
    onUpdate({
      ...task,
      options: nextOptions.map((option, index) => ({
        ...option,
        id: String.fromCharCode(97 + index),
      })),
      check: null,
    })
  }

  return (
    <Field label="Options">
      <div className="te-quiz-options">
        {options.map((option, index) => (
          <div key={option.id} className="te-quiz-option-card">
            <span className="te-quiz-option-id">{option.id}</span>
            <div className="te-quiz-option-editor">
              <MarkdownFieldEditor
                height={118}
                minHeight={104}
                ariaLabel={`Option ${option.id.toUpperCase()} Markdown editor views`}
                value={option.text}
                onChange={(value) =>
                  updateOptions(options.map((o, i) => (i === index ? { ...o, text: value } : o)))
                }
                placeholder={`Option ${option.id.toUpperCase()} in Markdown`}
                lessonType={lessonType}
              />
            </div>
            <button
              type="button"
              className="te-remove-btn"
              onClick={() => updateOptions(options.filter((_, i) => i !== index))}
              disabled={options.length <= 2}
              title="Remove option"
            >
              x
            </button>
          </div>
        ))}
        {options.length < MAX_OPTIONS && (
          <button
            type="button"
            className="te-add-check-btn"
            onClick={() => updateOptions([...options, { id: '', text: '' }])}
          >
            + Add option
          </button>
        )}
        <div
          style={{
            padding: '8px 12px',
            background: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            fontFamily: 'var(--font-body)',
            fontSize: '0.86rem',
            color: '#6b7280',
          }}
        >
          No right answer: any choice completes the task. Students can change their choice, and
          never see anyone else&apos;s. The session report counts each option.
        </div>
      </div>
    </Field>
  )
}

// The multiple-choice grid without marking (QuizTask → PollQuiz), hosted as an activity.
export default {
  StudentView: QuizActivityStudentView,
  CardSummary: ChoiceCardSummary,
  ownsLayout: true,
  BuilderEditor: PollOptionsBuilder,
  BuilderIcon: () => <QuizTypeIcon type="poll" />,
  builderHint: 'Ask an opinion',
  builderConvert: (task) => switchQuizType(task, 'poll'),
}
