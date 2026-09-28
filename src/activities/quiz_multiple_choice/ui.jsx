import React from 'react'
import { MarkdownFieldEditor } from '../../shared/MarkdownFieldEditor'
import { Field } from '../ui/BuilderField.jsx'
import { QuizTypeIcon } from '../quiz/QuizTypeIcon.jsx'
import { switchQuizType } from '../quiz/quizBuilder.js'
import { ChoiceCardSummary, QuizActivityStudentView } from '../quiz/QuizActivityViews.jsx'

// Builder editor (moved from src/builder/components/task-editor/QuizEditors.jsx, unchanged).
export function QuizOptionsBuilder({ task, onUpdate, lessonType = null }) {
  const options = task.options?.length
    ? task.options
    : [
        { id: 'a', text: '' },
        { id: 'b', text: '' },
      ]
  const correctAnswer = task.check?.type === 'answer_equals' ? task.check.value : ''

  function renumber(nextOptions) {
    return nextOptions.map((option, index) => ({
      ...option,
      id: String.fromCharCode(97 + index),
    }))
  }

  function updateOptions(nextOptions, nextAnswer = correctAnswer) {
    const renumbered = renumber(nextOptions)
    const answer = renumbered.some((option) => option.id === nextAnswer) ? nextAnswer : ''
    const existingHint = task.check?.hint ? { hint: task.check.hint } : {}
    onUpdate({
      ...task,
      options: renumbered,
      check: answer ? { type: 'answer_equals', value: answer, ...existingHint } : null,
      _checkTested: false,
    })
  }

  function setCorrectAnswer(answer) {
    onUpdate({
      ...task,
      check: {
        type: 'answer_equals',
        value: answer,
        ...(task.check?.hint ? { hint: task.check.hint } : {}),
      },
      _checkTested: false,
    })
  }

  return (
    <Field label="Options">
      <div className="te-quiz-options">
        {options.map((option, index) => (
          <div key={option.id} className="te-quiz-option-card">
            <label className="te-quiz-correct-label">
              <span className="te-quiz-option-id">{option.id}</span>
              <input
                type="radio"
                name={`quiz-correct-${task.id}`}
                checked={correctAnswer === option.id}
                onChange={() => setCorrectAnswer(option.id)}
              />
              <span
                className={
                  correctAnswer === option.id
                    ? 'te-quiz-correct-pill te-quiz-correct-pill--active'
                    : 'te-quiz-correct-pill'
                }
              >
                Correct
              </span>
            </label>
            <div className="te-quiz-option-editor">
              <MarkdownFieldEditor
                height={132}
                minHeight={118}
                ariaLabel={`Option ${option.id.toUpperCase()} Markdown editor views`}
                value={option.text}
                onChange={(value) =>
                  updateOptions(options.map((o, i) => (i === index ? { ...o, text: value } : o)))
                }
                placeholder={`Option ${option.id.toUpperCase()} in Markdown`}
                lessonType={lessonType}
              />
              <MarkdownFieldEditor
                height={118}
                minHeight={104}
                ariaLabel={`Option ${option.id.toUpperCase()} feedback Markdown editor views`}
                value={option.feedback ?? ''}
                onChange={(value) =>
                  updateOptions(
                    options.map((o, i) => (i === index ? { ...o, feedback: value } : o))
                  )
                }
                placeholder="Feedback shown if students choose this wrong answer..."
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
        <button
          type="button"
          className="btn-ghost te-add-check-btn"
          onClick={() => updateOptions([...options, { id: '', text: '' }])}
        >
          + Add option
        </button>
      </div>
    </Field>
  )
}

// The existing multiple-choice component (via QuizTask), hosted as an activity. `ownsLayout`:
// the quiz renders its own question panel and full-height layout, so the host adds no header
// or act-host frame.
export default {
  StudentView: QuizActivityStudentView,
  CardSummary: ChoiceCardSummary,
  ownsLayout: true,
  BuilderEditor: QuizOptionsBuilder,
  BuilderIcon: () => <QuizTypeIcon type="choice" />,
  builderHint: 'Pick one answer',
  builderConvert: (task) => switchQuizType(task, 'multiple_choice'),
}
