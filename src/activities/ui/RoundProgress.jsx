import React from 'react'
import { roundText } from '../round.js'
import { usePresentation } from './presentation.js'

// Non-interactive progress for an activity round: one tick-dot per rep (done or still to do,
// bonus reps drawn as stars after the core) and one consistent line, "3 of 5 done". It replaces
// the old Previous / numbered dots / Next bar: the student never picks an item, the round moves
// on by itself. aria-live so a screen reader hears each rep land. Hidden for a single rep.
export default function RoundProgress({ done, total, core = total }) {
  if (usePresentation() || !(total >= 2)) return null
  const goal = Math.min(core, total)
  const text = roundText(done, total, goal)
  return (
    <div className="act-round" data-testid="round-progress">
      <div
        className="act-round__dots"
        role="progressbar"
        aria-label="Round progress"
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-valuenow={Math.min(done, goal)}
        aria-valuetext={text}
      >
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={`act-round__dot${i < done ? ' act-round__dot--done' : ''}${i >= goal ? ' act-round__dot--bonus' : ''}`}
          >
            {i < done ? (i >= goal ? '★' : '✓') : ''}
          </span>
        ))}
      </div>
      <span className="act-round__text" aria-live="polite">
        {text}
      </span>
    </div>
  )
}

// The finish card once every rep is done. Play again clears the reps on this device only (the
// task stays passed), so it never un-passes or logs anything by itself.
// `message` replaces the default line for activities where finishing is not the same as being
// right (they say what happened instead); the default suits the ones that mark correctness.
export function RoundFinished({ total, onPlayAgain, readOnly = false, message }) {
  return (
    <div className="act-round-finished" role="status" data-testid="round-finished">
      <p className="act-prompt">{message ?? `You did it! ${total} done`}</p>
      {!readOnly && onPlayAgain && (
        <button type="button" className="btn-primary act-btn" onClick={onPlayAgain}>
          Play again
        </button>
      )}
    </div>
  )
}

// The one-line moment shown once the core is met and bonus reps follow.
export function BonusBanner() {
  if (usePresentation()) return null
  return (
    <p className="act-result act-result--pass" role="status" data-testid="round-bonus">
      Done! ⭐ Bonus round
    </p>
  )
}
