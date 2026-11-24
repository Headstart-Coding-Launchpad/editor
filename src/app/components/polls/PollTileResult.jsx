import React from 'react'
import { pollPercent } from '../../../shared/classPolls'

// A poll task tile's share of the class vote (PollQuiz): count and percentage as text and a thin
// bar in the tile's colour (white on a filled tile). Hidden from the tile's name (which stays the
// option's words); the tile is aria-describedby the words span ("1 vote, 50 percent").
export default function PollTileResult(props) {
  const { count, respondedCount, multiple, large, mine } = props
  const percent = pollPercent(count, respondedCount)
  const fill = { width: `${percent}%`, background: props.onDark ? '#fff' : props.colour }
  const words = multiple
    ? `${count} of ${respondedCount} picked this`
    : `${count} ${count === 1 ? 'vote' : 'votes'}, ${percent} percent`
  const dark = props.onDark ? ' poll-tile-result--on-dark' : ''
  const modifiers = `${dark}${large ? ' poll-tile-result--large' : ''}`
  return (
    <div
      className={`poll-tile-result${modifiers}`}
      data-testid="poll-tile-result"
      aria-hidden="true"
    >
      <span id={props.id} className="quiz-visually-hidden">
        {mine ? `${words}, your answer` : words}
      </span>
      <span className="poll-tile-result__count">
        {multiple ? words : `${count} · ${percent}%`}
        {mine && ' (your answer)'}
      </span>
      <span className="poll-tile-result__track">
        <span className="poll-tile-result__fill" data-testid="poll-tile-fill" style={fill} />
      </span>
    </div>
  )
}
