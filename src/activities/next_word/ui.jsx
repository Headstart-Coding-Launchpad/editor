import { useEffect, useId, useRef, useState } from 'react'
import NextWordBuilderEditor from './NextWordBuilderEditor.jsx'
import { SpinTick } from '../ui/ActivityCorrect.jsx'
import { BonusBanner } from '../ui/RoundProgress.jsx'
import { roundText } from '../round.js'
import { prefersReducedMotion } from '../../shared/motion.js'
import {
  OWN_VOICE,
  activeModel,
  applyStep,
  candidatesOf,
  dotsOf,
  gradeGuess,
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
  endsSentence,
  isEndMark,
  lastWordOf,
  nextOptions,
  pickOption,
  spoken,
  withoutLastToken,
} from './ngram.js'

// Next Word UI. Controlled view: ActivityHost passes `state`, `onChange(next | prev =>
// next)`, `readOnly` (teacher views and review) and `teacher`. Never write to Firebase or
// storage here: useActivityState owns persistence and live sync. The model is rebuilt in the
// browser from the student's own sentences (or the chosen voice). The tutor sees all of it live,
// the student's own sentences included (definition.serializeShared).
//
// While a guess is pending in the core the student must not be able to read the answer off the
// screen: the chips are one size, in alphabetical order, and the stats panel shows the step
// before (it is about a word they have already seen the result for). Pressing the button spins,
// lands, and holds the landed chip with the full odds for HOLD_MS before the next options
// replace it. A tutor (watching) always sees the odds. Bonus and free play always show them.

const MAX_BARS = 8
const SPIN_STEP_MS = 110
const HOLD_MS = 600
const PLAIN_SIZE = '1.3rem'

const chipText = (word) => (isEndMark(word) ? `${word} (the end)` : word)

// The "what happened" line after a press: whether the tapped word was the likeliest, and, when
// the random pick was a different word, a brief note that it doesn't always pick the likeliest.
function momentText(last) {
  const best = spoken(last.best)
  const times = last.total === 1 ? 'time' : 'times'
  const head = last.ok
    ? `Yes, “${best}” was the likeliest!`
    : `“${best}” was likelier${last.total > 0 ? ` (${last.bestCount} of ${last.total} ${times})` : ''}`
  const tail = last.pickedBest
    ? ''
    : ` It picked “${spoken(last.picked)}” this time — it doesn't always pick the likeliest.`
  return `${head}${tail}`
}

// The stats panel: which words followed the sentence's last word, with the numbers in words.
// `previous` marks the step before the current one (shown while a guess is pending).
function StatsPanel({ model, sentence, previous = false }) {
  const word = lastWordOf(sentence)
  if (!model || !word) {
    return (
      <p className="act-nw-none">
        {previous
          ? 'Make a guess and press the button. The numbers for that step show up here.'
          : 'Press Start. Then you can see which words followed.'}
      </p>
    )
  }
  const info = nextOptions(model, word)
  if (info.total === 0) {
    return <p className="act-nw-none">No word comes after “{spoken(word)}” in what it learned.</p>
  }
  const shown = info.options.slice(0, MAX_BARS)
  const hidden = info.options.length - shown.length
  return (
    <div data-testid="next_word-stats">
      <p className="act-nw-bars-title">
        {previous ? 'Last guess: after' : 'After'} “{spoken(info.word)}”, these words came next:
      </p>
      <ul className="act-nw-bars" aria-label={`Words that came after ${spoken(info.word)}`}>
        {shown.map((option) => (
          <li key={option.word} className="act-nw-bar">
            <span className="act-nw-bar__label">
              {describeCount(spoken(option.word), option.count, info.total)} (
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

// Round progress dots for the guesses: a green tick for a right guess, a plain filled dot for a
// wrong one (RoundProgress can't tell them apart), and "3 of 5 done".
function GuessDots({ task, state, goal, core, right }) {
  if (!(goal >= 2)) return null
  const dots = dotsOf(task, state)
  const text = roundText(core, goal, goal)
  return (
    <div className="act-round" data-testid="round-progress">
      <div
        className="act-round__dots"
        role="progressbar"
        aria-label="Round progress"
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-valuenow={core}
        aria-valuetext={`${text}, ${right} right`}
      >
        {dots.map((dot, i) => (
          <span
            key={i}
            aria-hidden="true"
            data-dot={dot}
            className={[
              'act-round__dot',
              dot !== 'todo' ? 'act-round__dot--done' : '',
              dot === 'right' ? 'act-nw-dot--right' : '',
              dot === 'wrong' ? 'act-nw-dot--wrong' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {dot === 'right' ? '✓' : ''}
          </span>
        ))}
      </div>
      <span className="act-round__text" aria-live="polite">
        {text}
      </span>
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
  const ended = endsSentence(state.sentence)
  // (candidatesOf gives no options for a finished sentence: the next press starts a new one.)
  const info = model && state.sentence ? candidatesOf(model, state.sentence) : null
  const options = info?.options ?? []
  const pending = options.some((option) => option.word === state.pending) ? state.pending : ''
  const inCore = !progress.done
  const needsGuess = inCore && options.length > 0

  // The spin: the highlighted chip index while the wheel runs. After it lands, `hold` keeps that
  // step's chips (with the odds, the landed chip highlighted) on screen for HOLD_MS.
  const [spinIndex, setSpinIndex] = useState(null)
  const [hold, setHold] = useState(null)
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
    setHold(null)
  }

  // `step` is { options, total } of the step being resolved (null for a free start word).
  function land(word, guess, step) {
    stopSpin()
    const grade = step ? gradeGuess(step, guess, word) : null
    if (step) {
      setHold({ options: step.options, total: step.total, picked: word, guess })
      timersRef.current.push(setTimeout(() => setHold(null), HOLD_MS))
    }
    onChange?.((prev) => applyStep(normalizeNextWordState(task, prev), word, guess, grade))
  }

  function press() {
    if (watching || spinning || hold || !model) return
    // Nothing to choose between yet (a new sentence, or the sentence hit a dead end): the
    // first word is just given, with no guess.
    if (options.length === 0) {
      land(startWordOf(model), '', null)
      return
    }
    if (needsGuess && !pending) return
    const picked = pickOption(options, temperature).word
    const target = options.findIndex((option) => option.word === picked)
    const step = { options, total: info.total }
    if (prefersReducedMotion() || options.length < 2) {
      land(picked, pending, step)
      return
    }
    const steps = options.length * 2 + target
    for (let k = 0; k <= steps; k++) {
      timersRef.current.push(
        setTimeout(
          () => {
            if (k === steps) land(picked, pending, step)
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
    update({ voice: id, sentence: '', pending: '', last: null })
  }

  function startAgain() {
    stopSpin()
    update({ sentence: '', pending: '', last: null })
  }

  const last = state.last
  const words = state.sentence.split(' ').filter(Boolean)
  const ownWords = ownWordsOf(state)
  const buttonLabel = ended
    ? 'New sentence'
    : options.length === 0
      ? 'Start a sentence'
      : 'Next word'
  const disabled = watching || spinning || Boolean(hold) || !model || (needsGuess && !pending)

  // What the chips show: during a guess the odds are hidden (one size, alphabetical, no counts).
  const hideOdds = !watching && inCore && options.length > 0 && !spinning && !hold
  const shown = hold ? hold.options : options
  const shownTotal = hold ? hold.total : (info?.total ?? 0)
  const chips = hideOdds ? [...shown].sort((a, b) => a.word.localeCompare(b.word)) : shown
  const marked = hold ? hold.guess : pending
  // The stats panel never shows the step being guessed: while it is pending it shows the step
  // before (if any). A tutor, and bonus play, see the current step.
  const statsPrevious = !watching && inCore && !spinning
  const statsSentence = statsPrevious
    ? last
      ? withoutLastToken(state.sentence)
      : ''
    : state.sentence

  return (
    <div className="act-panel act-nw" data-testid="next_word-activity">
      <div className="act-nw-top">
        <GuessDots
          task={task}
          state={state}
          goal={goal}
          core={progress.core}
          right={progress.right}
        />
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
            <>
              <p data-testid="next_word-own-count">
                {ownWords === 0
                  ? 'No sentences written yet.'
                  : `Wrote ${ownWords} ${ownWords === 1 ? 'word' : 'words'} of their own:`}
              </p>
              {state?.own ? (
                <p className="act-nw-own-readonly" data-testid="next_word-own-text">
                  {state.own}
                </p>
              ) : null}
            </>
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

        {shown.length > 0 && (
          <>
            <p className="act-nw-ask">
              {inCore
                ? 'Which word is most likely to come next? Tap it, then press the button.'
                : 'Bonus: tap a guess if you like, then press the button.'}
            </p>
            <div
              className="act-nw-chips"
              role="group"
              aria-label={
                hideOdds
                  ? 'Words that might come next'
                  : 'Words that might come next, biggest is most likely'
              }
            >
              {chips.map((option, i) => (
                <button
                  key={option.word}
                  type="button"
                  className={[
                    'act-nw-chip',
                    'act-nw-chip--big',
                    spinIndex === i ? 'act-nw-chip--spin' : '',
                    hold?.picked === option.word ? 'act-nw-chip--landed' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={{
                    fontSize: hideOdds ? PLAIN_SIZE : `${(1 + option.share * 0.9).toFixed(2)}rem`,
                  }}
                  aria-pressed={marked === option.word}
                  aria-label={
                    hideOdds
                      ? spoken(option.word)
                      : describeCount(spoken(option.word), option.count, shownTotal)
                  }
                  disabled={watching || spinning || Boolean(hold)}
                  onClick={() => update({ pending: pending === option.word ? '' : option.word })}
                >
                  {chipText(option.word)}
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
            {last.ok ? <SpinTick /> : <span aria-hidden="true">✗</span>} {momentText(last)}
          </p>
        )}

        {ended && words.length > 0 && !spinning && !hold && (
          <p className="act-result act-result--pass" role="status" data-testid="next_word-end">
            The end! 🎉
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
          <StatsPanel model={model} sentence={statsSentence} previous={statsPrevious} />
        </section>
      )}
    </div>
  )
}

// Teacher surfaces fall back to this StudentView with readOnly: the tutor sees the sentence so
// far, the odds, the guess the student has tapped, the tick or cross, the slider, the voice and
// the student's own sentences. The card summary comes from definition.summarize.
export default {
  StudentView: NextWordStudentView,
  BuilderEditor: NextWordBuilderEditor,
}
