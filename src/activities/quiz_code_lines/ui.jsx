import React from 'react'
import { Field } from '../ui/BuilderField.jsx'
import { QuizActivityStudentView, makeItemsCardSummary } from '../quiz/QuizActivityViews.jsx'
import definition from './definition.js'
import { codeRows, correctLinesOf } from './lines.js'

const LANGUAGES = ['python', 'html', 'css', 'js']

// Builder editor: the code, its colouring, which line(s) are the answer (tick them), what a wrong
// pick of each other line says, and the one-line explanation. pick follows the ticks.
export function CodeLinesBuilder({ task, onUpdate }) {
  const right = correctLinesOf(task)
  const feedback = task.lineFeedback ?? {}
  const update = (changes) => onUpdate({ ...task, ...changes, check: null, _checkTested: false })
  const toggle = (n) =>
    update({
      correctLines: right.includes(n)
        ? right.filter((v) => v !== n)
        : [...right, n].sort((a, b) => a - b),
    })
  const setFeedback = (n, text) => {
    const { [n]: _old, ...rest } = feedback
    update({ lineFeedback: text ? { ...rest, [n]: text } : rest })
  }
  return (
    <>
      <Field label="Code (one row per line; no line numbers)">
        <select
          className="te-select"
          aria-label="Code colouring"
          value={task.language || 'python'}
          onChange={(e) => update({ language: e.target.value })}
        >
          {LANGUAGES.map((lang) => (
            <option key={lang}>{lang}</option>
          ))}
        </select>
        <textarea
          className="te-check-value cl-builder__code"
          aria-label="Code"
          rows={Math.min(12, codeRows(task).length + 1)}
          value={task.code ?? ''}
          onChange={(e) => update({ code: e.target.value })}
        />
      </Field>
      <Field label="Answer: tick the right line (tick two for a two-line question)">
        <div className="cl-builder__lines">
          {codeRows(task).map((code, i) => (
            <div key={i} className="cl-builder__line">
              <label>
                <input
                  type="checkbox"
                  checked={right.includes(i + 1)}
                  onChange={() => toggle(i + 1)}
                />
                <span className="cl-builder__n">{i + 1}</span>
                <code>{code || ' '}</code>
              </label>
              {!right.includes(i + 1) && (
                <input
                  className="te-input"
                  aria-label={`Says when line ${i + 1} is picked`}
                  placeholder="Optional: says when this line is picked"
                  value={feedback[i + 1] ?? ''}
                  onChange={(e) => setFeedback(i + 1, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      </Field>
      <Field label="Explanation (one line, shown after Check)">
        <input
          className="te-input"
          aria-label="Explanation"
          value={task.explanation ?? ''}
          onChange={(e) => update({ explanation: e.target.value })}
        />
      </Field>
    </>
  )
}

// Switching another quiz to this one: its own fields are kept; a task with no code gets the
// example program and answer, so it validates straight away.
function toCodeLines(task) {
  const example = definition.defaultTask(task)
  const { options: _o, pairs: _p, blanks: _b, text: _t, ...rest } = task
  const fresh = !String(task.code ?? '').trim()
  return {
    ...rest,
    quizType: 'code_lines',
    language: task.language ?? 'python',
    code: fresh ? example.code : task.code,
    correctLines: fresh ? example.correctLines : correctLinesOf(task),
    check: null,
  }
}

function CodeLinesIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M3 6h1M3 12h1M3 18h1M8 6h9M8 18h12" />
      <rect x="6.5" y="9.5" width="15" height="5" rx="1.5" />
    </svg>
  )
}

// The quiz itself is CodeLinesQuiz (via QuizTask); the card names the picked line(s).
export default {
  StudentView: QuizActivityStudentView,
  CardSummary: makeItemsCardSummary(definition),
  ownsLayout: true,
  BuilderEditor: CodeLinesBuilder,
  BuilderIcon: CodeLinesIcon,
  builderHint: 'Tap the line',
  builderConvert: toCodeLines,
}
