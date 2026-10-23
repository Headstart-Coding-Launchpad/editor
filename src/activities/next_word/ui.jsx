import { useEffect, useId, useRef, useState } from 'react'
import NextWordBuilderEditor from './NextWordBuilderEditor.jsx'
import { SpinTick } from '../ui/ActivityCorrect.jsx'
import RoundProgress, { BonusBanner } from '../ui/RoundProgress.jsx'
import { prefersReducedMotion } from '../../shared/motion.js'
import {
  OWN_VOICE,
  activeModel,
  applyStep,
  candidatesOf,
  gradeTask,
  guessGoalOf,
  initialNextWordState,
  normalizeNextWordState,
  ownWordsOf,
  panelsOf,
  sillyLabel,
  startWordOf,
  voiceOf,
  voicesOf,
} from './next_word.js'
import {
  DEFAULT_TEMPERATURE,
  MAX_PASTE_CHARS,
  MAX_TEMPERATURE,
  MIN_TEMPERATURE,
  describeCount,
  lastWordOf,
  nextOptions,
  pickOption,
} from './ngram.js'

// Next Word UI. Controlled view: ActivityHost passes `state`, `onChange(next | prev =>
// next)`, `readOnly` (teacher views and review) and `teacher`. Never write to Firebase or
// storage here: useActivityState owns persistence and live sync. The model is rebuilt in the
// browser from the student's own sentences (or the chosen voice); nothing leaves the device but
// the sentence it wrote and the guess counts (definition.serializeShared).

const MAX_BARS = 8
const SPIN_STEP_MS = 110

// The stats panel: which words followed the sentence's last word, with the numbers in words.
function StatsPanel({ model, sentence }) {
  const word = lastWordOf(sentence)
  if (!model || !word) {
    return <p className="act-nw-none">Press Start. Then you can see which words followed.</p>
  }
  const info = nextOptions(model, word)
  if (info.total === 0) {
    return <p className="act-nw-none">No word comes after “{word}” in what it learned.</p>
  }
  const shown = info.options.slice(0, MAX_BARS)
  const hidden = info.options.length - shown.length
  return (
    <div data-testid="next_word-stats">
      <p className="act-nw-bars-title">After “{info.word}”, these words came next:</p>
      <ul className="act-nw-bars" aria-label={`Words that came after ${info.word}`}>
        {shown.map((option) => (
          <li key={option.word} className="act-nw-bar">
            <span className="act-nw-bar__label">
              {describeCount(option.word, option.count, info.total)} (
              {Math.round(option.share * 100)}%)
            </span>
            <span className="act-nw-bar__track" aria-hidden="true">
              <span className="act-nw-bar__fill" style={{ width: `${option.share * 100}%` }} />
            </span>
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <p>
          …and {hidden} more {hidden === 1 ? 'word' : 'words'}.
        </p>
      )}
    </div>
  )
}

export function NextWordStudentView({
  task,
  state: rawState,
  onChange,
  readOnly = false,
  teacher,
}) {
  // A tutor (read-only view, or editing a student's answers) only watches.
  const watching = readOnly || teacher === true
  const groupId = useId()
  const state = normalizeNextWordState(task, rawState ?? initialNextWordState(task))
  const panels = panelsOf(task)
  const voices = voicesOf(task)
  const voice = voiceOf(task, state)
  const goal = guessGoalOf(task)
  const progress = gradeTask(task, state)
  const model = activeModel(task, state)
  const temperature = panels.includes('silly') ? state.temperature : DEFAULT_TEMPERATURE
  const info = model && state.sentence ? candidatesOf(model, state.sentence) : null
  const options = info?.options ?? []
  const pending = options.some((option) => option.word === state.pending) ? state.pending : ''
  const inCore = !progress.done
  const needsGuess = inCore && options.length > 0

  // The spin: the highlighted chip index while the wheel runs, and the word it landed on.
  const [spinIndex, setSpinIndex] = useState(null)
  const [landed, setLanded] = useState('')
  const timersRef = useRef([])
  const spinning = spinIndex != null
  useEffect(
    () => () => {
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
    },
    []
  )

  function update(patch) {
    if (watching) return
    onChange?.((prev) => ({ ...normalizeNextWordState(task, prev), ...patch }))
  }

  function stopSpin() {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    setSpinIndex(null)
  }

  function land(word, guess) {
    stopSpin()
    setLanded(word)
    onChange?.((prev) => applyStep(normalizeNextWordState(task, prev), word, guess))
  }

  function press() {
    if (watching || spinning || !model) return
    // Nothing to choose between yet (a new sentence, or the sentence hit a dead end): the
    // first word is just given, with no guess.
    if (options.length === 0) {
      land(startWordOf(model), '')
      return
    }
    if (needsGuess && !pending) return
    const picked = pickOption(options, temperature).word
    const target = options.findIndex((option) => option.word === picked)
    if (prefersReducedMotion() || options.length < 2) {
      land(picked, pending)
      return
    }
    const steps = options.length * 2 + target
    for (let k = 0; k <= steps; k++) {
      timersRef.current.push(
        setTimeout(
          () => {
            if (k === steps) land(picked, pending)
            else setSpinIndex(k % options.length)
          },
          (k + 1) * SPIN_STEP_MS
        )
      )
    }
    setSpinIndex(0)
  }

  function chooseVoice(id) {
    stopSpin()
    setLanded('')
    update({ voice: id, sentence: '', pending: '', last: null })
  }

  function startAgain() {
    stopSpin()
    setLanded('')
    update({ sentence: '', pending: '', last: null })
  }

  const last = state.last
  const words = state.sentence.split(' ').filter(Boolean)
  const ownWords = ownWordsOf(state)
  const buttonLabel = options.length === 0 ? 'Start a sentence' : 'Next word'
  const disabled = watching || spinning || !model || (needsGuess && !pending)

  return (
    <div className="act-panel act-nw" data-testid="next_word-activity">
      <div className="act-nw-top">
        <RoundProgress done={progress.core} total={goal} core={goal} />
        {progress.done && <BonusBanner />}
        {progress.bonus > 0 && (
          <p className="act-nw-bonus" data-testid="next_word-bonus">
            +{progress.bonus} bonus {progress.bonus === 1 ? 'guess' : 'guesses'}
          </p>
        )}
        {goal < 2 && !progress.done && <p>1 guess to do</p>}
      </div>

      {panels.includes('voices') && (
        <section className="act-nw-section" aria-label="Voices">
          <h3 className="act-nw-heading">Whose words should it learn?</h3>
          <div className="act-nw-voices" role="group" aria-label="Voices">
            {voices.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className="act-nw-voice"
                aria-pressed={entry.id === voice.id}
                disabled={watching}
                onClick={() => chooseVoice(entry.id)}
              >
                <span className="act-nw-voice__emoji" aria-hidden="true">
                  {entry.emoji}
                </span>
                {entry.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {voice.id === OWN_VOICE && (
        <section className="act-nw-section">
          {watching ? (
            <p data-testid="next_word-own-count">
              {ownWords === 0
                ? 'No sentences written yet.'
                : `Wrote ${ownWords} ${ownWords === 1 ? 'word' : 'words'} of their own (kept on their device).`}
            </p>
          ) : (
            <>
              <label htmlFor={`${groupId}-own`} className="act-nw-heading">
                Write some sentences for it to learn from
              </label>
              <textarea
                id={`${groupId}-own`}
                className="act-nw-textarea"
                value={state.own}
                maxLength={MAX_PASTE_CHARS}
                placeholder="The cat sat on the mat. The cat saw the dog. The dog sat on the mat."
                onChange={(event) => update({ own: event.target.value })}
              />
              <p className="act-nw-count">
                {ownWords} {ownWords === 1 ? 'word' : 'words'} learned
                {!model ? ' · write at least two words to start' : ''}
              </p>
            </>
          )}
        </section>
      )}

      <section className="act-nw-section" aria-label="The sentence">
        <p className="act-nw-sentence" aria-live="polite" data-testid="next_word-sentence">
          {words.length === 0 ? (
            <span className="act-nw-placeholder">Your sentence will grow here.</span>
          ) : (
            words.map((word, i) => (
              <span
                key={i}
                className={i === words.length - 1 ? 'act-nw-word act-nw-word--new' : 'act-nw-word'}
              >
                {word}{' '}
              </span>
            ))
          )}
        </p>

        {options.length > 0 && (
          <>
            <p className="act-nw-ask">
              {inCore
                ? 'Guess what it says next: tap a word, then press the button.'
                : 'Bonus: tap a guess if you like, then press the button.'}
            </p>
            <div
              className="act-nw-chips"
              role="group"
              aria-label="Words it might pick, biggest is most likely"
            >
              {options.map((option, i) => (
                <button
                  key={option.word}
                  type="button"
                  className={[
                    'act-nw-chip',
                    'act-nw-chip--big',
                    spinIndex === i ? 'act-nw-chip--spin' : '',
                    !spinning && landed === option.word && last?.picked === option.word
                      ? 'act-nw-chip--landed'
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={{ fontSize: `${(1 + option.share * 0.9).toFixed(2)}rem` }}
                  aria-pressed={pending === option.word}
                  aria-label={describeCount(option.word, option.count, info.total)}
                  disabled={watching || spinning}
                  onClick={() => update({ pending: pending === option.word ? '' : option.word })}
                >
                  {option.word}
                </button>
              ))}
            </div>
          </>
        )}

        {watching && pending && !last && (
          <p data-testid="next_word-pending">Guessing: “{pending}” (not pressed yet)</p>
        )}

        {!watching && (
          <div className="act-row">
            <button
              type="button"
              className="btn-primary act-btn act-nw-big"
              disabled={disabled}
              onClick={press}
            >
              {spinning ? '…' : buttonLabel}
            </button>
            {words.length > 0 && (
              <button
                type="button"
                className="btn-ghost-outline act-btn"
                disabled={spinning}
                onClick={startAgain}
              >
                Start again
              </button>
            )}
          </div>
        )}

        {last && !spinning && (
          <p
            key={`${state.guesses}-${last.picked}`}
            className={last.ok ? 'act-result act-result--pass' : 'act-hint'}
            role="status"
            data-testid="next_word-moment"
          >
            {last.ok ? <SpinTick /> : <span aria-hidden="true">✗</span>}{' '}
            {last.ok
              ? `You guessed it! It picked “${last.picked}”!`
              : `Not this time. It picked “${last.picked}”, you guessed “${last.guess}”.`}
          </p>
        )}
      </section>

      {panels.includes('silly') && (
        <section className="act-nw-section">
          <label htmlFor={`${groupId}-silly`} className="act-nw-heading">
            How silly should it be?
          </label>
          <div className="act-nw-silly">
            <span aria-hidden="true">🧐 Sensible</span>
            <input
              id={`${groupId}-silly`}
              className="act-nw-slider"
              type="range"
              min={MIN_TEMPERATURE}
              max={MAX_TEMPERATURE}
              step={0.1}
              value={state.temperature}
              disabled={watching}
              aria-valuetext={sillyLabel(state.temperature)}
              onChange={(event) => update({ temperature: Number(event.target.value) })}
            />
            <span aria-hidden="true">Silly 🤪</span>
          </div>
          <p data-testid="next_word-silly-label">{sillyLabel(state.temperature)}</p>
        </section>
      )}

      {panels.includes('stats') && (
        <section className="act-nw-section">
          <h3 className="act-nw-heading">What it learned</h3>
          <StatsPanel model={model} sentence={state.sentence} />
        </section>
      )}
    </div>
  )
}

// Teacher surfaces fall back to this StudentView with readOnly: the tutor sees the sentence so
// far, the guess the student has tapped, the tick or cross, the slider and the voice, and how
// many words of their own the student has written. The card summary comes from
// definition.summarize.
export default {
  StudentView: NextWordStudentView,
  BuilderEditor: NextWordBuilderEditor,
}
