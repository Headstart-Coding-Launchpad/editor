import React from 'react'
import { pollPercent } from '../../../shared/classPolls'

// One horizontal bar per poll option: the option text, its vote count and its share of the
// votes. Used by the teacher's live tally, the students' results card, the presentation window
// and the session report. `options` is [{ index, text, count }]; `highlight` marks the
// viewer's own choice; `large` is the projected presentation size.
export default function PollResultBars({ options, respondedCount, highlight = null, large }) {
  return (
    <ul className={`poll-bars${large ? ' poll-bars--large' : ''}`} aria-label="Poll results">
      {options.map((option) => {
        const percent = pollPercent(option.count, respondedCount)
        const mine = highlight === option.index
        return (
          <li key={option.index} className={`poll-bar${mine ? ' poll-bar--mine' : ''}`}>
            <div className="poll-bar__label">
              <span className="poll-bar__text">
                {option.text}
                {mine && <span className="poll-bar__you"> (your answer)</span>}
              </span>
              <span className="poll-bar__count">
                {option.count} · {percent}%
              </span>
            </div>
            <div className="poll-bar__track" aria-hidden="true">
              <div className="poll-bar__fill" style={{ width: `${percent}%` }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
