import React from 'react'
import { MarkdownFieldEditor } from '../../shared/MarkdownFieldEditor'
import { Field } from '../ui/BuilderField.jsx'
import { QuizTypeIcon } from '../quiz/QuizTypeIcon.jsx'
import { switchQuizType } from '../quiz/quizBuilder.js'
import { QuizActivityStudentView, makeItemsCardSummary } from '../quiz/QuizActivityViews.jsx'
import definition from './definition.js'

// Builder editor (moved from src/builder/components/task-editor/QuizEditors.jsx, unchanged).
export function FillBlankBuilder({ task, onUpdate, lessonType = null }) {
  const mode = task.mode ?? 'drag'
  const text = task.text ?? ''
  const blanks = task.blanks ?? []
  const distractors = task.distractors ?? []
  const blankCount = (text.match(/___/g) ?? []).length

  function handleTextChange(newText) {
    const count = (newText.match(/___/g) ?? []).length
    let newBlanks = [...blanks]
    while (newBlanks.length < count) newBlanks.push({ id: `b${newBlanks.length + 1}`, answer: '' })
    if (newBlanks.length > count) newBlanks = newBlanks.slice(0, count)
    onUpdate({ ...task, text: newText, blanks: newBlanks, _checkTested: false })
  }

  function updateBlank(index, answer) {
    const next = blanks.map((b, i) => (i === index ? { ...b, answer } : b))
    onUpdate({ ...task, blanks: next, _checkTested: false })
  }

  function addDistractor() {
    const next = [...distractors, { id: `d${Date.now()}`, text: '' }]
    onUpdate({ ...task, distractors: next })
  }

  function updateDistractor(index, text) {
    const next = distractors.map((d, i) => (i === index ? { ...d, text } : d))
    onUpdate({ ...task, distractors: next })
  }

  function removeDistractor(index) {
    onUpdate({ ...task, distractors: distractors.filter((_, i) => i !== index) })
  }

  return (
    <>
      <Field label="Mode">
        <div style={{ display: 'flex', gap: 24 }}>
          <label className="te-carry-radio-label">
            <input
              type="radio"
              checked={mode === 'drag'}
              onChange={() => onUpdate({ ...task, mode: 'drag' })}
            />
            Drag and drop
          </label>
          <label className="te-carry-radio-label">
            <input
              type="radio"
              checked={mode === 'type'}
              onChange={() => onUpdate({ ...task, mode: 'type' })}
            />
            Type answer
          </label>
        </div>
      </Field>
      <Field label="Text (use ___ for each blank)">
        <MarkdownFieldEditor
          height={150}
          minHeight={130}
          ariaLabel="Fill in the blank text Markdown editor views"
          value={text}
          onChange={handleTextChange}
          placeholder="e.g. Python uses ___ to print output and ___ to get input."
          lessonType={lessonType}
        />
        <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#6b7280' }}>
          {blankCount} blank{blankCount !== 1 ? 's' : ''} detected
        </span>
      </Field>
      {blanks.length > 0 && (
        <Field label="Correct answers (in order)">
          <div className="te-quiz-answer-stack">
            {blanks.map((blank, index) => (
              <div key={blank.id} className="te-quiz-answer-card">
                <span className="te-quiz-answer-badge">{index + 1}</span>
                <div className="te-quiz-answer-block">
                  <span className="te-quiz-answer-label">Blank {index + 1}</span>
                  <MarkdownFieldEditor
                    height={118}
                    minHeight={104}
                    ariaLabel={`Blank ${index + 1} answer Markdown editor views`}
                    value={blank.answer}
                    onChange={(value) => updateBlank(index, value)}
                    placeholder={`Answer for blank ${index + 1}`}
                    lessonType={lessonType}
                  />
                </div>
              </div>
            ))}
          </div>
        </Field>
      )}
      {mode === 'drag' && (
        <Field label="Extra options (distractors — drag mode only)">
          <div className="te-quiz-answer-stack">
            {distractors.map((d, index) => (
              <div key={d.id} className="te-quiz-answer-card" style={{ alignItems: 'center' }}>
                <span className="te-quiz-answer-badge">✕</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <input
                    type="text"
                    className="te-input"
                    value={d.text}
                    onChange={(e) => updateDistractor(index, e.target.value)}
                    placeholder={`Distractor option ${index + 1}`}
                  />
                </div>
                <button
                  type="button"
                  className="te-remove-btn"
                  onClick={() => removeDistractor(index)}
                  title="Remove distractor"
                >
                  ✕
                </button>
              </div>
            ))}
            <button type="button" className="te-add-check-btn" onClick={addDistractor}>
              + Add distractor
            </button>
          </div>
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.82rem',
              color: '#6b7280',
              marginTop: 2,
            }}
          >
            These extra tiles appear in the answer bank but are not the answer to any blank.
          </span>
        </Field>
      )}
    </>
  )
}

// The existing fill-in-the-gaps component (via QuizTask), hosted as an activity.
export default {
  StudentView: QuizActivityStudentView,
  CardSummary: makeItemsCardSummary(definition),
  ownsLayout: true,
  BuilderEditor: FillBlankBuilder,
  BuilderIcon: () => <QuizTypeIcon type="blank" />,
  builderHint: 'Complete gaps',
  builderConvert: (task) => switchQuizType(task, 'fill_blank'),
}
