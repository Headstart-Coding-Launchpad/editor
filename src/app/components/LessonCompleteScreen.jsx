import React from 'react'
import { firstViewKey, useFirstView } from '../../shared/motion'
import BadgeStickerSheet from './badges/BadgeStickerSheet'

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
// Calm layout (Ryan, 23 Nov): title, moments strip (newest 6, none: hidden), Open Playground +
// Solo Challenge (with neither, replay is the button), quiet replay link. The party (option C)
// plays once per lesson here (useFirstView), else a still picture. CSS: `.lesson-complete`.
export default function LessonCompleteScreen({
  lessonId,
  lessonTitle,
  onOpenPlayground,
  soloCompanion,
  onTrySoloChallenge,
  onReplayLesson,
  moments = [],
}) {
  const celebrate = useFirstView(firstViewKey('lesson-complete', lessonId ?? lessonTitle))
  const choices = [
    onOpenPlayground && { label: 'Open Playground', onClick: onOpenPlayground },
    soloCompanion &&
      onTrySoloChallenge && { label: 'Try the Solo Challenge', onClick: onTrySoloChallenge },
  ].filter(Boolean)
  const replayIsChoice = choices.length === 0 && !!onReplayLesson
  if (replayIsChoice)
    choices.push({ label: 'Go through the lesson again', onClick: onReplayLesson })
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
        {moments.length > 0 && (
          <section className="lesson-complete__moments" aria-label="Your coding moments">
            <h2 className="lesson-complete__moments-label">Your coding moments</h2>
            <BadgeStickerSheet variant="strip" moments={moments} max={6} animate={celebrate} />
          </section>
        )}
        {choices.length > 0 && (
          <div className="lesson-complete__actions">
            {choices.map(({ label, onClick }, i) => (
              <button
                key={label}
                type="button"
                className={i === 0 ? 'lesson-complete__primary' : 'lesson-complete__secondary'}
                onClick={onClick}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {onReplayLesson && !replayIsChoice && (
          <button type="button" className="lesson-complete__again" onClick={onReplayLesson}>
            Go through the lesson again
          </button>
        )}
      </div>
    </div>
  )
}
