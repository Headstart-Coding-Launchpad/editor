import React from 'react'
import { MarkdownRenderer, highlightHtml, hljsName } from '../../../shared/markdown'
import { splitHighlightedLines } from '../../../shared/markdown/codeLines.js'
import * as L from '../../../activities/quiz_code_lines/lines.js'
import { baseStyles as s } from './quizUtils'

// Click-the-line quiz (quizType code_lines; sketch OK'd 24 Nov 2026): the question, then the code
// as numbered rows the student taps (a listbox: arrows move, Space or Enter picks), and one Check.
// Check marks it here: the right line(s) green, a wrong pick amber, one line saying why, and Try
// again. A pick is an in-progress answer (onSelectAnswer(answer, null): mirrored to the tutor as
// currentAnswer); Check is the final one, with its pass or fail for the Builder preview. On the
// tutor's screens (disabled) the rows show the student's pick, and the verdict once checked.
export default function CodeLinesQuiz(props) {
  const { task, selectedAnswer: answer, onSelectAnswer: send, submitted, disabled } = props
  const rows = L.codeRows(task)
  const lang = hljsName(task?.language || 'python')
  const html = splitHighlightedLines(highlightHtml(rows.join('\n'), lang))
  const picks = L.parseLinePicks(answer)
  const need = L.pickCountOf(task)
  const right = L.correctLinesOf(task)
  const [retrying, setRetrying] = React.useState(false)
  const listRef = React.useRef(null)
  const id = React.useId()
  const full = picks.length === need
  const verdict =
    submitted && full && (disabled || !retrying) ? L.gradeLinePicks(task, answer) : null
  const locked = disabled || !!verdict

  function toggle(n) {
    if (locked) return
    const kept = picks.filter((p) => p !== n)
    const next = kept.length < picks.length ? kept : need === 1 ? [n] : [...picks, n].slice(-need)
    send?.(L.encodeLinePicks(next), null)
  }
  function onKeyDown(event, index) {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key]
    if (step) listRef.current?.children[index + step]?.focus()
    else if (event.key === ' ' || event.key === 'Enter') toggle(index + 1)
    else return
    event.preventDefault()
  }
  // [verdict mark, tag words] for line n: the tag means colour is never the only cue.
  const tagFor = (n, picked) =>
    verdict && right.includes(n)
      ? ['right', picked ? '✓ Yes!' : '✓ This is the one']
      : verdict && picked
        ? ['wrong', 'Your pick']
        : [undefined, picked ? '✓ picked' : '']
  const one = need === 1
  const status = verdict
    ? verdict.passed
      ? `Yes! ${task?.explanation ?? ''}`
      : `Not quite. ${verdict.suggestion}`
    : !picks.length
      ? one
        ? 'Tap a line to pick it.'
        : `Tap ${need} lines to pick them.`
      : one
        ? `You picked line ${picks[0]}.`
        : `${picks.length} of ${need} lines picked`
  const retry = verdict && !verdict.passed

  return (
    <div style={s.wrap} className="cl-quiz">
      <div style={s.question} className="cl-quiz__card">
        {props.showQuestion && <div style={s.questionLabel}>{task?.title || 'Question'}</div>}
        <div style={s.questionBody} className="cl-quiz__body">
          {props.showQuestion && task?.explainer && (
            <MarkdownRenderer title={task.title} content={task.explainer} textScale={1.15} />
          )}
          <div
            ref={listRef}
            role="listbox"
            aria-label="Lines of code"
            aria-multiselectable={!one || undefined}
            aria-disabled={locked || undefined}
            className="cl-quiz__lines hljs"
          >
            {rows.map((code, index) => {
              const n = index + 1
              const picked = picks.includes(n)
              const [mark, tag] = tagFor(n, picked)
              return (
                <div
                  key={n}
                  role="option"
                  aria-selected={picked}
                  aria-label={`Line ${n}: ${code}`}
                  aria-describedby={tag ? `${id}-${n}` : undefined}
                  tabIndex={n === (picks[0] ?? 1) ? 0 : -1}
                  className="cl-quiz__row"
                  data-line={n}
                  data-picked={picked || undefined}
                  data-verdict={mark}
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
          data-verdict={verdict && (retry ? 'wrong' : 'right')}
        >
          {status}
        </p>
        {!disabled && (!verdict || retry) && (
          <button
            type="button"
            className="btn-primary cl-quiz__button"
            disabled={!retry && !full}
            onClick={() => {
              setRetrying(!!retry)
              if (retry) send?.('', null)
              else send?.(answer, L.gradeLinePicks(task, answer).passed)
            }}
          >
            {retry ? 'Try again' : 'Check'}
          </button>
        )}
      </div>
    </div>
  )
}
