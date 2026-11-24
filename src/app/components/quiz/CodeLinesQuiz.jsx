import React from 'react'
import { MarkdownRenderer, highlightHtml, hljsName } from '../../../shared/markdown'
import { splitHighlightedLines } from '../../../shared/markdown/codeLines.js'
import {
  codeRows,
  correctLinesOf,
  encodeLinePicks,
  gradeLinePicks,
  parseLinePicks,
  pickCountOf,
} from '../../../activities/quiz_code_lines/lines.js'
import { baseStyles as s } from './quizUtils'

// Click-the-line quiz (quizType code_lines; sketch OK'd 24 Nov 2026): the question, then the code
// as numbered rows the student taps (a listbox: arrows move, Space or Enter picks), and one Check.
// Check marks it here: the right line(s) green, a wrong pick amber, one line saying why, and Try
// again. A pick is an in-progress answer (onSelectAnswer(answer, null): mirrored to the tutor as
// currentAnswer); Check is the final one, with its pass or fail for the Builder preview. On the
// tutor's screens (disabled) the rows show the student's pick, and the verdict once checked.
export default function CodeLinesQuiz({
  task,
  selectedAnswer,
  onSelectAnswer,
  submitted,
  disabled,
  showQuestion,
}) {
  const rows = codeRows(task)
  const html = splitHighlightedLines(
    highlightHtml(rows.join('\n'), hljsName(task?.language || 'python'))
  )
  const picks = parseLinePicks(selectedAnswer)
  const need = pickCountOf(task)
  const right = correctLinesOf(task)
  const [retrying, setRetrying] = React.useState(false)
  const listRef = React.useRef(null)
  const id = React.useId()
  const verdict =
    submitted && picks.length === need && (disabled || !retrying)
      ? gradeLinePicks(task, selectedAnswer)
      : null
  const locked = disabled || !!verdict

  function toggle(n) {
    if (locked) return
    const next = picks.includes(n)
      ? picks.filter((p) => p !== n)
      : need === 1
        ? [n]
        : [...picks, n].slice(-need)
    onSelectAnswer?.(encodeLinePicks(next), null)
  }
  function onKeyDown(event, index) {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key]
    if (step) listRef.current?.children[index + step]?.focus()
    else if (event.key === ' ' || event.key === 'Enter') toggle(index + 1)
    else return
    event.preventDefault()
  }

  const tagFor = (n) => {
    const picked = picks.includes(n)
    if (verdict && right.includes(n)) return ['right', picked ? '✓ Yes!' : '✓ This is the one']
    if (verdict && picked) return ['wrong', 'Your pick']
    return [null, picked ? '✓ picked' : '']
  }
  const status = verdict
    ? verdict.passed
      ? `Yes! ${task?.explanation ?? ''}`
      : `Not quite. ${verdict.suggestion}`
    : need === 1
      ? picks.length
        ? `You picked line ${picks[0]}.`
        : 'Tap a line to pick it.'
      : picks.length
        ? `${picks.length} of ${need} lines picked`
        : `Tap ${need} lines to pick them.`

  return (
    <div style={s.wrap} className="cl-quiz">
      <div style={s.question} className="cl-quiz__card">
        {showQuestion && <div style={s.questionLabel}>{task?.title || 'Question'}</div>}
        <div style={s.questionBody} className="cl-quiz__body">
          {showQuestion && task?.explainer && (
            <MarkdownRenderer title={task.title} content={task.explainer} textScale={1.15} />
          )}
          <div
            ref={listRef}
            role="listbox"
            aria-label="Lines of code"
            aria-multiselectable={need > 1 || undefined}
            aria-disabled={locked || undefined}
            className="cl-quiz__lines hljs"
          >
            {rows.map((code, index) => {
              const n = index + 1
              const [mark, tag] = tagFor(n)
              return (
                <div
                  key={n}
                  role="option"
                  aria-selected={picks.includes(n)}
                  aria-label={`Line ${n}: ${code}`}
                  aria-describedby={tag ? `${id}-${n}` : undefined}
                  tabIndex={index === Math.max(0, (picks[0] ?? 1) - 1) ? 0 : -1}
                  className="cl-quiz__row"
                  data-line={n}
                  data-picked={picks.includes(n) || undefined}
                  data-verdict={mark ?? undefined}
                  onClick={() => toggle(n)}
                  onKeyDown={(event) => onKeyDown(event, index)}
                >
                  <code dangerouslySetInnerHTML={{ __html: html[index] || '&nbsp;' }} />
                  {tag && (
                    <span id={`${id}-${n}`} className="cl-quiz__tag">
                      {tag}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <div className="cl-quiz__footer">
        <p
          role="status"
          className="cl-quiz__status"
          data-verdict={verdict ? (verdict.passed ? 'right' : 'wrong') : undefined}
        >
          {status}
        </p>
        {!disabled && !verdict && (
          <button
            type="button"
            className="btn-primary cl-quiz__button"
            disabled={picks.length !== need}
            onClick={() => {
              setRetrying(false)
              onSelectAnswer?.(selectedAnswer, gradeLinePicks(task, selectedAnswer).passed)
            }}
          >
            Check
          </button>
        )}
        {!disabled && verdict && !verdict.passed && (
          <button
            type="button"
            className="btn-primary cl-quiz__button"
            onClick={() => {
              setRetrying(true)
              onSelectAnswer?.('', null)
            }}
          >
            Try again
          </button>
        )}
      </div>
    </div>
  )
}
