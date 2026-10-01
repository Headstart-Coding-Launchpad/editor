import React, { useEffect, useRef, useState } from 'react'
import {
  getActivePoll,
  normalizePollDraft,
  POLL_MAX_OPTIONS,
  POLL_MIN_OPTIONS,
  POLL_OPTION_MAX_LENGTH,
  POLL_QUESTION_MAX_LENGTH,
  tallyPoll,
} from '../../../shared/classPolls'
import PollResultBars from './PollResultBars'

const EMPTY_DRAFT = () => ({ question: '', options: ['', ''] })

/**
 * The teacher's 📊 Poll button and popover (top bar, TeacherSessionControls). With no poll on
 * screen it shows the form (a question and 2–6 options); with one it shows the live tally:
 * counts, who chose each option and who hasn't answered, plus Close poll, Show results to the
 * class, Remove from screens and New poll. Every poll is kept for the session report.
 */
export default function TeacherPollControl({
  session,
  onLaunch,
  onClosePoll,
  onSetShowResults,
  onDismiss,
}) {
  const [open, setOpen] = useState(false)
  const [composing, setComposing] = useState(false)
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const wrapRef = useRef(null)

  const activePoll = getActivePoll(session)
  const tally = activePoll ? tallyPoll(session, activePoll.pollId) : null
  const pollCount = Object.keys(session?.polls ?? {}).length
  const showForm = !activePoll || composing

  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  async function run(action) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err?.message || 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  function setOption(index, value) {
    setDraft((d) => ({ ...d, options: d.options.map((o, i) => (i === index ? value : o)) }))
  }

  function handleLaunch(e) {
    e.preventDefault()
    const { error: draftError } = normalizePollDraft(draft)
    if (draftError) {
      setError(draftError)
      return
    }
    run(async () => {
      await onLaunch(draft)
      setDraft(EMPTY_DRAFT())
      setComposing(false)
    })
  }

  const buttonLabel = activePoll
    ? activePoll.status === 'open'
      ? `📊 Poll (${tally?.respondedCount ?? 0}/${tally?.total ?? 0})`
      : '📊 Poll (closed)'
    : '📊 Poll'

  return (
    <div ref={wrapRef} style={sWrap}>
      <button
        className="btn-ghost teacher-session-controls__action"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title="Ask the class a quick question"
      >
        {buttonLabel}
      </button>
      {open && (
        <div className="ui-popover teacher-poll-panel" role="dialog" aria-label="Class poll">
          {showForm ? (
            <form className="teacher-poll-form" onSubmit={handleLaunch}>
              <label className="teacher-poll-form__label">
                Question
                <input
                  className="teacher-poll-form__input"
                  autoFocus
                  maxLength={POLL_QUESTION_MAX_LENGTH}
                  placeholder="What would you like to do next?"
                  value={draft.question}
                  onChange={(e) => setDraft((d) => ({ ...d, question: e.target.value }))}
                />
              </label>
              <fieldset className="teacher-poll-form__options">
                <legend className="teacher-poll-form__label">Options (pick one)</legend>
                {draft.options.map((option, index) => (
                  <div key={index} className="teacher-poll-form__option">
                    <input
                      className="teacher-poll-form__input"
                      aria-label={`Option ${index + 1}`}
                      maxLength={POLL_OPTION_MAX_LENGTH}
                      placeholder={`Option ${index + 1}`}
                      value={option}
                      onChange={(e) => setOption(index, e.target.value)}
                    />
                    <button
                      type="button"
                      className="teacher-poll-form__remove"
                      aria-label={`Remove option ${index + 1}`}
                      disabled={draft.options.length <= POLL_MIN_OPTIONS}
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          options: d.options.filter((_, i) => i !== index),
                        }))
                      }
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {draft.options.length < POLL_MAX_OPTIONS && (
                  <button
                    type="button"
                    className="teacher-poll-panel__link"
                    onClick={() => setDraft((d) => ({ ...d, options: [...d.options, ''] }))}
                  >
                    + Add option
                  </button>
                )}
              </fieldset>
              {error && <span className="teacher-poll-panel__error">{error}</span>}
              <p className="teacher-poll-panel__note">
                Students see a card they can answer while they work. Results stay hidden from them
                until you show them.
                {activePoll ? ' Launching closes the current poll.' : ''}
              </p>
              <div className="teacher-poll-panel__actions">
                {composing && (
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      setComposing(false)
                      setError(null)
                    }}
                  >
                    Back
                  </button>
                )}
                <button type="submit" className="btn-primary" disabled={busy}>
                  {busy ? 'Launching…' : 'Launch poll'}
                </button>
              </div>
            </form>
          ) : (
            <div className="teacher-poll-live">
              <div className="teacher-poll-live__head">
                <strong className="teacher-poll-live__question">{activePoll.question}</strong>
                <span
                  className={`teacher-poll-live__status teacher-poll-live__status--${activePoll.status}`}
                >
                  {activePoll.status === 'open' ? 'Open' : 'Closed'}
                </span>
              </div>
              <p className="teacher-poll-panel__note">
                {tally.respondedCount} of {tally.total} answered
              </p>
              <PollResultBars options={tally.options} respondedCount={tally.respondedCount} />
              <dl className="teacher-poll-live__voters">
                {tally.options
                  .filter((option) => option.voters.length > 0)
                  .map((option) => (
                    <div key={option.index}>
                      <dt>{option.text}</dt>
                      <dd>{option.voters.map((v) => v.name).join(', ')}</dd>
                    </div>
                  ))}
                {tally.notResponded.length > 0 && (
                  <div>
                    <dt>Not answered</dt>
                    <dd>{tally.notResponded.map((v) => v.name).join(', ')}</dd>
                  </div>
                )}
              </dl>
              <label className="teacher-poll-live__toggle">
                <input
                  type="checkbox"
                  checked={activePoll.showResults === true}
                  disabled={busy}
                  onChange={(e) => run(() => onSetShowResults(activePoll.pollId, e.target.checked))}
                />
                Show results to the class
              </label>
              {error && <span className="teacher-poll-panel__error">{error}</span>}
              <div className="teacher-poll-panel__actions">
                {activePoll.status === 'open' && (
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={busy}
                    onClick={() => run(() => onClosePoll(activePoll.pollId))}
                  >
                    Close poll
                  </button>
                )}
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={busy}
                  onClick={() => run(() => onDismiss())}
                  title="Take the poll off every screen. It stays in the session report."
                >
                  Remove from screens
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={busy}
                  onClick={() => {
                    setComposing(true)
                    setError(null)
                  }}
                >
                  New poll
                </button>
              </div>
            </div>
          )}
          {pollCount > 0 && (
            <p className="teacher-poll-panel__footer">
              {pollCount} poll{pollCount === 1 ? '' : 's'} this session, all saved in the session
              report.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

const sWrap = { position: 'relative', display: 'inline-block' }
