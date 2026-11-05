import React from 'react'
import { MarkdownFieldEditor } from '../../shared/MarkdownFieldEditor'
import { Field } from '../ui/BuilderField.jsx'
import { QuizTypeIcon } from '../quiz/QuizTypeIcon.jsx'
import { switchQuizType } from '../quiz/quizBuilder.js'
import { ChoiceCardSummary, QuizActivityStudentView } from '../quiz/QuizActivityViews.jsx'
import { QuizOptionPicture } from '../../app/components/quiz/QuizOptionPicture.jsx'
import {
  PICTURE_QUIZ_MAX_OPTIONS,
  optionHasPicture,
  quizHasPictureOptions,
} from '../../shared/quizPictureOptions.js'

// Builder editor (moved from src/builder/components/task-editor/QuizEditors.jsx), plus the
// picture option fields (request 128).
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

  function updateOption(index, change) {
    updateOptions(options.map((o, i) => (i === index ? change(o) : o)))
  }

  // Removing a picture keeps the option (its caption becomes its words, or it is left empty for
  // the author to fill in).
  function removePicture(index) {
    updateOption(index, ({ image: _image, emoji: _emoji, alt: _alt, ...rest }) => ({
      ...rest,
      text: rest.text ?? '',
    }))
  }

  // A picture quiz takes 2 to 4 options (validation says so too); adding a 5th is blocked here.
  const pictureCapReached =
    quizHasPictureOptions({ options }) && options.length >= PICTURE_QUIZ_MAX_OPTIONS

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
              {/* Pictures are added in YAML / the CLI for now (request 128). Here the author can
                  edit the alt text (the caption is the option text below) or remove the picture;
                  image and emoji are kept on every other edit. */}
              {optionHasPicture(option) && (
                <div
                  className="te-quiz-option-picture"
                  data-testid={`quiz-option-picture-${option.id}`}
                >
                  <QuizOptionPicture option={option} size={56} decorative />
                  <div className="te-quiz-option-picture-fields">
                    <input
                      type="text"
                      className="te-input"
                      aria-label={`Option ${option.id.toUpperCase()} alt text`}
                      placeholder="Alt text: what the picture shows"
                      value={typeof option.alt === 'string' ? option.alt : ''}
                      maxLength={200}
                      onChange={(event) =>
                        updateOption(index, (o) => ({ ...o, alt: event.target.value }))
                      }
                    />
                    {!(typeof option.alt === 'string' && option.alt.trim()) && (
                      <span className="te-quiz-option-picture-missing">
                        Add alt text: say what the picture shows
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="te-remove-btn"
                    onClick={() => removePicture(index)}
                    aria-label={`Remove picture from option ${option.id.toUpperCase()}`}
                    title="Remove picture"
                  >
                    x
                  </button>
                </div>
              )}
              <MarkdownFieldEditor
                height={132}
                minHeight={118}
                ariaLabel={`Option ${option.id.toUpperCase()} Markdown editor views`}
                value={option.text ?? ''}
                onChange={(value) => updateOption(index, (o) => ({ ...o, text: value }))}
                placeholder={
                  optionHasPicture(option)
                    ? `Option ${option.id.toUpperCase()} caption (optional)`
                    : `Option ${option.id.toUpperCase()} in Markdown`
                }
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
          className="te-add-check-btn"
          onClick={() => updateOptions([...options, { id: '', text: '' }])}
          disabled={pictureCapReached}
          aria-describedby={pictureCapReached ? `quiz-picture-cap-${task.id}` : undefined}
        >
          + Add option
        </button>
        {pictureCapReached && (
          <p className="te-act-note" id={`quiz-picture-cap-${task.id}`}>
            Picture quizzes take 2 to {PICTURE_QUIZ_MAX_OPTIONS} options, so they stay big enough to
            tap.
          </p>
        )}
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
