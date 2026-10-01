import React, { useEffect, useState } from 'react'
import { staggerStyle } from '../../../shared/motion'
import PollResultBars from './PollResultBars'

/**
 * The live class poll on a student's screen (and, read-only, on the presentation window).
 * A card in the corner that never blocks the lesson: the student picks one option while the
 * poll is open and can change it until the teacher closes it. Results are only shown once the
 * teacher chooses to show them (`poll.showResults`).
 *
 * - `poll`: getActivePoll(session) — { pollId, question, options: [text], status, showResults }
 * - `choice`: the viewer's own answer (an option index) or null
 * - `tally`: tallyPoll(session, pollId), for results and the presentation's answer count
 * - `onAnswer(index)`: students only
 * - `presentation`: the projected, read-only variant
 */
export default function ClassPollCard({ poll, choice = null, tally, onAnswer, presentation }) {
  const [minimised, setMinimised] = useState(false)
  // A new poll always arrives open, even if the last one was minimised.
  useEffect(() => setMinimised(false), [poll?.pollId])

  if (!poll) return null
  const isOpen = poll.status === 'open'
  const showResults = poll.showResults === true && !!tally
  const chosenText = choice != null ? poll.options[choice] : null

  if (minimised && !presentation) {
    return (
      <button
        type="button"
        className="class-poll-pill motion-pop-in"
        onClick={() => setMinimised(false)}
        aria-label="Open the class poll"
      >
        📊 Poll{isOpen && choice == null ? ' · waiting for your answer' : ''}
      </button>
    )
  }

  return (
    <section
      key={poll.pollId}
      className={`class-poll-card motion-drop-in motion-now${presentation ? ' class-poll-card--presentation' : ''}`}
      aria-label="Class poll"
      aria-live="polite"
    >
      <header className="class-poll-card__header">
        <span className="class-poll-card__kicker">📊 Class poll</span>
        {!isOpen && <span className="class-poll-card__status">Closed</span>}
        {!presentation && (
          <button
            type="button"
            className="class-poll-card__minimise"
            onClick={() => setMinimised(true)}
            aria-label="Minimise the poll"
            title="Minimise"
          >
            –
          </button>
        )}
      </header>
      <h2 className="class-poll-card__question">{poll.question}</h2>

      {presentation ? (
        !showResults && (
          <>
            <ol className="class-poll-card__list">
              {poll.options.map((text, index) => (
                <li key={index}>{text}</li>
              ))}
            </ol>
            {tally && (
              <p className="class-poll-card__note">
                {tally.respondedCount} of {tally.total} answered
              </p>
            )}
          </>
        )
      ) : isOpen ? (
        <>
          <div className="class-poll-card__options" role="radiogroup" aria-label={poll.question}>
            {poll.options.map((text, index) => {
              const selected = choice === index
              return (
                <button
                  key={index}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`class-poll-option motion-rise-in motion-stagger motion-now${selected ? ' class-poll-option--selected' : ''}`}
                  style={staggerStyle(index)}
                  onClick={() => onAnswer?.(index)}
                >
                  <span className="class-poll-option__mark" aria-hidden="true">
                    {selected ? '✓' : ''}
                  </span>
                  <span className="class-poll-option__text">{text}</span>
                </button>
              )
            })}
          </div>
          <p className="class-poll-card__note">
            {choice == null
              ? 'Pick one. Only your teacher sees who chose what.'
              : 'Thanks! You can change your answer until the poll closes.'}
          </p>
        </>
      ) : (
        !showResults && (
          <p className="class-poll-card__note">
            {chosenText ? (
              <>
                You chose <strong>{chosenText}</strong>.
              </>
            ) : (
              'This poll has closed.'
            )}
          </p>
        )
      )}

      {showResults && (
        <PollResultBars
          options={tally.options}
          respondedCount={tally.respondedCount}
          highlight={presentation ? null : choice}
          large={presentation}
        />
      )}
    </section>
  )
}
