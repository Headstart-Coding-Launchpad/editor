import React from 'react'
import { MarkdownFieldEditor } from '../../shared/MarkdownFieldEditor'
import { Field } from '../ui/BuilderField.jsx'
import { QuizTypeIcon } from '../quiz/QuizTypeIcon.jsx'
import { switchQuizType } from '../quiz/quizBuilder.js'
import { QuizActivityStudentView, TextCardSummary } from '../quiz/QuizActivityViews.jsx'

// Builder editor (moved from src/builder/components/task-editor/QuizEditors.jsx, unchanged).
export function ShortAnswerBuilder({ task, onUpdate, lessonType = null }) {
  const hasCheck = task.check != null
  const check = task.check ?? { type: 'answer_contains', value: '' }

  function updateCheck(updates) {
    onUpdate({ ...task, check: { ...check, ...updates }, _checkTested: false })
  }

  function toggleCheck(enabled) {
    // A graded answer is never shown to the class, so a check drops the show-answer fields.
    const { showResponses: _showResponses, anonymiseResponses: _anonymise, ...rest } = task
    onUpdate({
      ...(enabled ? rest : task),
      check: enabled ? { type: 'answer_contains', value: '' } : null,
      _checkTested: false,
    })
  }

  function toggleShowResponses(enabled) {
    const { showResponses: _showResponses, anonymiseResponses: _anonymise, ...rest } = task
    onUpdate(enabled ? { ...rest, showResponses: 'teacher_picks' } : rest)
  }

  function toggleShowNames(showNames) {
    const { anonymiseResponses: _anonymise, ...rest } = task
    onUpdate(showNames ? { ...rest, anonymiseResponses: false } : rest)
  }

  return (
    <Field label="Completion check">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label style={toggleLabelStyle}>
          <input
            type="checkbox"
            checked={hasCheck}
            onChange={(e) => toggleCheck(e.target.checked)}
          />
          Require a correct answer
        </label>
        {!hasCheck && (
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--font-body)',
              fontSize: '0.82rem',
              color: '#6b7280',
              lineHeight: 1.5,
              padding: '8px 10px',
              background: '#f9fafb',
              borderRadius: 6,
              border: '1px solid #e5e7eb',
            }}
          >
            Open-ended — any submitted answer completes the task. The teacher can review what each
            student wrote.
          </p>
        )}
        {!hasCheck && (
          <label style={toggleLabelStyle}>
            <input
              type="checkbox"
              checked={task.showResponses === 'teacher_picks'}
              onChange={(e) => toggleShowResponses(e.target.checked)}
            />
            Teacher can show answers on the presentation window
          </label>
        )}
        {!hasCheck && task.showResponses === 'teacher_picks' && (
          <label style={{ ...toggleLabelStyle, paddingLeft: 24 }}>
            <input
              type="checkbox"
              checked={task.anonymiseResponses === false}
              onChange={(e) => toggleShowNames(e.target.checked)}
            />
            Show names by default (the teacher can still change each answer)
          </label>
        )}
        {hasCheck && (
          <>
            <select
              className="te-select"
              value={check.type ?? 'answer_contains'}
              onChange={(e) => updateCheck({ type: e.target.value })}
            >
              <option value="answer_contains">Answer contains</option>
              <option value="answer_equals">Answer equals (exact match)</option>
              <option value="answer_matches_regex">Answer matches regex</option>
            </select>
            <textarea
              className="te-check-value"
              value={check.value ?? ''}
              onChange={(e) => updateCheck({ value: e.target.value })}
              placeholder={
                check.type === 'answer_equals'
                  ? 'Exact expected answer…'
                  : check.type === 'answer_matches_regex'
                    ? 'Regular expression…'
                    : 'Text that the answer must contain… or "option1","option2" for any one of multiple values'
              }
            />
            <MarkdownFieldEditor
              height={118}
              minHeight={104}
              ariaLabel="Short answer check hint Markdown editor views"
              value={check.hint ?? ''}
              onChange={(value) => updateCheck({ hint: value })}
              placeholder="Suggestion shown when this answer is wrong..."
              lessonType={lessonType}
            />
            <p
              style={{
                margin: 0,
                fontFamily: 'var(--font-body)',
                fontSize: '0.82rem',
                color: '#6b7280',
                lineHeight: 1.5,
              }}
            >
              Text matching is case-insensitive. Regular expressions are case-sensitive. Test by
              typing an answer in the student preview below.
            </p>
          </>
        )}
      </div>
    </Field>
  )
}

const toggleLabelStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontFamily: 'var(--font-body)',
  fontSize: '0.9rem',
  cursor: 'pointer',
}

// The existing short-answer component (via QuizTask), hosted as an activity.
export default {
  StudentView: QuizActivityStudentView,
  CardSummary: TextCardSummary,
  ownsLayout: true,
  BuilderEditor: ShortAnswerBuilder,
  BuilderIcon: () => <QuizTypeIcon type="answer" />,
  builderHint: 'Typed response',
  builderConvert: (task) => switchQuizType(task, 'short_answer'),
}
