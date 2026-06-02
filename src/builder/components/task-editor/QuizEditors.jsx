import React from 'react'
import { MarkdownFieldEditor } from '../ExplainerEditor'
import { Field, QuizTypeIcon } from './TaskEditorFields'

function QuizTypePicker({ task, onQuizTypeChange }) {
  const quizType = task.quizType ?? 'multiple_choice'
  const types = [
    { value: 'multiple_choice', label: 'Multiple Choice', meta: 'Pick one answer', icon: 'choice' },
    { value: 'match', label: 'Match', meta: 'Pair items', icon: 'match' },
    { value: 'fill_blank', label: 'Fill Blank', meta: 'Complete gaps', icon: 'blank' },
    { value: 'short_answer', label: 'Short Answer', meta: 'Typed response', icon: 'answer' },
  ]
  return (
    <Field label="Quiz type">
      <div className="te-quiz-type-grid">
        {types.map(t => {
          const active = quizType === t.value
          return (
            <button
              key={t.value}
              type="button"
              className={active ? 'te-quiz-type-btn te-quiz-type-btn--active' : 'te-quiz-type-btn'}
              onClick={() => onQuizTypeChange(t.value)}
            >
              <QuizTypeIcon type={t.icon} />
              <span className="te-quiz-type-label">{t.label}</span>
              <span className={active ? 'te-quiz-type-meta te-quiz-type-meta--active' : 'te-quiz-type-meta'}>{t.meta}</span>
            </button>
          )
        })}
      </div>
    </Field>
  )
}

function MatchPairsBuilder({ task, onUpdate, lessonType = null }) {
  const pairs = task.pairs?.length ? task.pairs : [{ id: 'p1', prompt: '', answer: '' }, { id: 'p2', prompt: '', answer: '' }]

  function renumber(nextPairs) {
    return nextPairs.map((p, i) => ({ ...p, id: `p${i + 1}` }))
  }
  function updatePairs(nextPairs) {
    onUpdate({ ...task, pairs: renumber(nextPairs), _checkTested: false })
  }
  function updatePair(index, field, value) {
    updatePairs(pairs.map((p, i) => i === index ? { ...p, [field]: value } : p))
  }

  return (
    <Field label="Pairs (students match left to right)">
      <div className="te-quiz-answer-stack">
        {pairs.map((pair, index) => (
          <div key={pair.id || index} className="te-quiz-answer-card">
            <span className="te-quiz-answer-badge">{index + 1}</span>
            <div className="te-match-pair-row">
              <div className="te-quiz-answer-block">
                <span className="te-quiz-answer-label">Prompt</span>
                <MarkdownFieldEditor
                  height={132}
                  minHeight={118}
                  ariaLabel={`Match prompt ${index + 1} Markdown editor views`}
                  value={pair.prompt}
                  onChange={value => updatePair(index, 'prompt', value)}
                  placeholder={`Prompt ${index + 1} in Markdown`}
                  lessonType={lessonType}
                />
              </div>
              <span className="te-match-arrow">-</span>
              <div className="te-quiz-answer-block">
                <span className="te-quiz-answer-label">Answer</span>
                <MarkdownFieldEditor
                  height={132}
                  minHeight={118}
                  ariaLabel={`Match answer ${index + 1} Markdown editor views`}
                  value={pair.answer}
                  onChange={value => updatePair(index, 'answer', value)}
                  placeholder={`Correct answer ${index + 1} in Markdown`}
                  lessonType={lessonType}
                />
              </div>
            </div>
            <button
              type="button"
              className="te-remove-btn"
              onClick={() => updatePairs(pairs.filter((_, i) => i !== index))}
              disabled={pairs.length <= 2}
              title="Remove pair"
            >✕</button>
          </div>
        ))}
        <button type="button" className="btn-ghost te-add-check-btn" onClick={() => updatePairs([...pairs, { id: '', prompt: '', answer: '' }])}>
          + Add pair
        </button>
      </div>
    </Field>
  )
}

function FillBlankBuilder({ task, onUpdate, lessonType = null }) {
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
    const next = blanks.map((b, i) => i === index ? { ...b, answer } : b)
    onUpdate({ ...task, blanks: next, _checkTested: false })
  }

  function addDistractor() {
    const next = [...distractors, { id: `d${Date.now()}`, text: '' }]
    onUpdate({ ...task, distractors: next })
  }

  function updateDistractor(index, text) {
    const next = distractors.map((d, i) => i === index ? { ...d, text } : d)
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
            <input type="radio" checked={mode === 'drag'} onChange={() => onUpdate({ ...task, mode: 'drag' })} />
            Drag and drop
          </label>
          <label className="te-carry-radio-label">
            <input type="radio" checked={mode === 'type'} onChange={() => onUpdate({ ...task, mode: 'type' })} />
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
                  onChange={value => updateBlank(index, value)}
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
                    onChange={e => updateDistractor(index, e.target.value)}
                    placeholder={`Distractor option ${index + 1}`}
                  />
                </div>
                <button
                  type="button"
                  className="te-remove-btn"
                  onClick={() => removeDistractor(index)}
                  title="Remove distractor"
                >✕</button>
              </div>
            ))}
            <button type="button" className="btn-ghost te-add-check-btn" onClick={addDistractor}>
              + Add distractor
            </button>
          </div>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#6b7280', marginTop: 2 }}>
            These extra tiles appear in the answer bank but are not the answer to any blank.
          </span>
        </Field>
      )}
    </>
  )
}

function ShortAnswerBuilder({ task, onUpdate, lessonType = null }) {
  const hasCheck = task.check != null
  const check = task.check ?? { type: 'answer_contains', value: '' }

  function updateCheck(updates) {
    onUpdate({ ...task, check: { ...check, ...updates }, _checkTested: false })
  }

  function toggleCheck(enabled) {
    onUpdate({
      ...task,
      check: enabled ? { type: 'answer_contains', value: '' } : null,
      _checkTested: false,
    })
  }

  return (
    <Field label="Completion check">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-body)', fontSize: '0.9rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={hasCheck} onChange={e => toggleCheck(e.target.checked)} />
          Require a correct answer
        </label>
        {!hasCheck && (
          <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#6b7280', lineHeight: 1.5, padding: '8px 10px', background: '#f9fafb', borderRadius: 6, border: '1px solid #e5e7eb' }}>
            Open-ended — any submitted answer completes the task. The teacher can review what each student wrote.
          </p>
        )}
        {hasCheck && (
          <>
            <select
              className="te-select"
              value={check.type ?? 'answer_contains'}
              onChange={e => updateCheck({ type: e.target.value })}
            >
              <option value="answer_contains">Answer contains</option>
              <option value="answer_equals">Answer equals (exact match)</option>
              <option value="answer_matches_regex">Answer matches regex</option>
            </select>
            <textarea
              className="te-check-value"
              value={check.value ?? ''}
              onChange={e => updateCheck({ value: e.target.value })}
              placeholder={
                check.type === 'answer_equals' ? 'Exact expected answer…'
                : check.type === 'answer_matches_regex' ? 'Regular expression…'
                : 'Text that the answer must contain… or "option1","option2" for any one of multiple values'
              }
            />
            <MarkdownFieldEditor
              height={118}
              minHeight={104}
              ariaLabel="Short answer check hint Markdown editor views"
              value={check.hint ?? ''}
              onChange={value => updateCheck({ hint: value })}
              placeholder="Suggestion shown when this answer is wrong..."
              lessonType={lessonType}
            />
            <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#6b7280', lineHeight: 1.5 }}>
              Text matching is case-insensitive. Regular expressions are case-sensitive. Test by typing an answer in the student preview below.
            </p>
          </>
        )}
      </div>
    </Field>
  )
}

function QuizOptionsBuilder({ task, onUpdate, lessonType = null }) {
  const options = task.options?.length ? task.options : [{ id: 'a', text: '' }, { id: 'b', text: '' }]
  const correctAnswer = task.check?.type === 'answer_equals' ? task.check.value : ''

  function renumber(nextOptions) {
    return nextOptions.map((option, index) => ({
      ...option,
      id: String.fromCharCode(97 + index),
    }))
  }

  function updateOptions(nextOptions, nextAnswer = correctAnswer) {
    const renumbered = renumber(nextOptions)
    const answer = renumbered.some(option => option.id === nextAnswer) ? nextAnswer : ''
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
      check: { type: 'answer_equals', value: answer, ...(task.check?.hint ? { hint: task.check.hint } : {}) },
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
              <span className={correctAnswer === option.id ? 'te-quiz-correct-pill te-quiz-correct-pill--active' : 'te-quiz-correct-pill'}>
                Correct
              </span>
            </label>
            <div className="te-quiz-option-editor">
              <MarkdownFieldEditor
                height={132}
                minHeight={118}
                ariaLabel={`Option ${option.id.toUpperCase()} Markdown editor views`}
                value={option.text}
                onChange={value => updateOptions(options.map((o, i) => i === index ? { ...o, text: value } : o))}
                placeholder={`Option ${option.id.toUpperCase()} in Markdown`}
                lessonType={lessonType}
              />
              <MarkdownFieldEditor
                height={118}
                minHeight={104}
                ariaLabel={`Option ${option.id.toUpperCase()} feedback Markdown editor views`}
                value={option.feedback ?? ''}
                onChange={value => updateOptions(options.map((o, i) => i === index ? { ...o, feedback: value } : o))}
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

export { QuizTypePicker, MatchPairsBuilder, FillBlankBuilder, ShortAnswerBuilder, QuizOptionsBuilder }
