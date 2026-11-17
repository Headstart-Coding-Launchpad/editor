import React from 'react'
import { firstViewKey, useFirstView } from '../../shared/motion'

const TITLE_WORDS = ['Lesson', 'complete!']
const CONFETTI_COLOURS = ['#fba504', '#ffffff', '#ff6b9d', '#4ade80', '#38bdf8', '#ffd84d']
const CONFETTI_PER_CORNER = 14

// Where each confetti piece lands (as % of the screen): mostly round the edges, kept out of the
// middle band where the title and buttons usually sit. Seeded, so every render looks the same.
const CONFETTI = (() => {
  let seed = 7
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const pieces = []
  for (const corner of ['left', 'right']) {
    for (let placed = 0; placed < CONFETTI_PER_CORNER;) {
      const x = 3 + rnd() * 44
      const y = 4 + rnd() * 88
      if (x > 22 && y > 22 && y < 86) continue
      const left = corner === 'left' ? x : 100 - x
      // The burst starts at this side's bottom corner: --fx/--fy move the piece back there.
      pieces.push({
        corner,
        style: {
          '--x': `${left.toFixed(1)}%`,
          '--y': `${y.toFixed(1)}%`,
          '--fx': `${((corner === 'left' ? 4 : 96) - left).toFixed(1)}%`,
          '--fy': `${(96 - y).toFixed(1)}%`,
          '--r': `${Math.round(rnd() * 900 - 450)}deg`,
          '--c': CONFETTI_COLOURS[pieces.length % CONFETTI_COLOURS.length],
          '--d': `${Math.round(rnd() * 300)}ms`,
        },
      })
      placed += 1
    }
  }
  return pieces
})()

// Reuses the "introduction" information-task look (full-bleed primary-colour hero) —
// see .information-task--introduction in index.css — rather than inventing new styles.
// The party (option C): the title bounces in letter by letter, three stars pop in and confetti
// shoots from both bottom corners, once per lesson on this screen (useFirstView); after that,
// and under reduced motion, it is the same still picture. CSS: `.lesson-complete` in index.css.
export default function LessonCompleteScreen({
  lessonId,
  lessonTitle,
  onOpenPlayground,
  soloCompanion,
  onTrySoloChallenge,
  onReplayLesson,
}) {
  const celebrate = useFirstView(firstViewKey('lesson-complete', lessonId ?? lessonTitle))
  let letterIndex = 0
  return (
    <div
      className={`information-task information-task--introduction lesson-complete${celebrate ? ' lesson-complete--celebrate' : ''}`}
    >
      <div className="lesson-complete__party" aria-hidden="true">
        {CONFETTI.map((piece, i) => (
          <span
            key={i}
            className="lesson-complete__confetti"
            data-corner={piece.corner}
            style={piece.style}
          />
        ))}
        <span className="lesson-complete__popper lesson-complete__popper--left">🎉</span>
        <span className="lesson-complete__popper lesson-complete__popper--right">🎉</span>
      </div>
      <div className="information-intro__content lesson-complete__content">
        <div className="lesson-complete__stars" aria-hidden="true">
          {['', 'lesson-complete__star--big', ''].map((size, i) => (
            <span
              key={i}
              data-testid="lesson-complete-star"
              className={`lesson-complete__star ${size}`}
            >
              ⭐
            </span>
          ))}
        </div>
        <h1 className="lesson-complete__title">
          <span className="act-sr-only">Lesson complete!</span>
          <span aria-hidden="true">
            {TITLE_WORDS.map((word, w) => (
              <React.Fragment key={word}>
                {w > 0 && ' '}
                <span className="lesson-complete__word">
                  {[...word].map((ch) => (
                    <span
                      key={letterIndex}
                      className="lesson-complete__letter"
                      style={{ '--i': letterIndex++ }}
                    >
                      {ch}
                    </span>
                  ))}
                </span>
              </React.Fragment>
            ))}
          </span>
        </h1>
        <p>Well done finishing {lessonTitle ?? 'this lesson'}.</p>
        <p>What would you like to do next?</p>
        <div className="lesson-complete__actions">
          {onReplayLesson && (
            <button type="button" className="btn-ghost-outline" onClick={onReplayLesson}>
              Go Through the Lesson Again
            </button>
          )}
          {soloCompanion && onTrySoloChallenge && (
            <button type="button" className="btn-ghost-outline" onClick={onTrySoloChallenge}>
              Try the Solo Challenge
            </button>
          )}
          {onOpenPlayground && (
            <button
              type="button"
              className="btn-primary lesson-complete__primary"
              onClick={onOpenPlayground}
            >
              Open Playground
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
