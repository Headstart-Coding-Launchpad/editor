import React from 'react'
import { pollPercent } from '../../../shared/classPolls'

// One poll task tile's share of the class vote (PollQuiz, under the option's words): the count
// and percentage as text, then a thin bar in the tile's colour. The text carries the number, so
// the bar is decoration only (aria-hidden).
export default function PollTileResult({ count, respondedCount, multiple, colour }) {
  const percent = pollPercent(count, respondedCount)
  const fill = { width: `${percent}%`, background: colour }
  return (
    <div
      className={`poll-tile-result${colour === '#fff' ? ' poll-tile-result--on-dark' : ''}`}
      data-testid="poll-tile-result"
    >
      <span className="poll-tile-result__count">
        {multiple ? `${count} of ${respondedCount} picked this` : `${count} · ${percent}%`}
      </span>
      <span className="poll-tile-result__track" aria-hidden="true">
        <span className="poll-tile-result__fill" data-testid="poll-tile-fill" style={fill} />
      </span>
    </div>
  )
}
