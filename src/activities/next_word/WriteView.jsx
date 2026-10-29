import { Fragment, useEffect, useId, useRef, useState } from 'react'
import ActivityLayout, { ActButton, ActChip, ActFold } from '../ui/ActivityLayout.jsx'
import RoundProgress, { BonusBanner } from '../ui/RoundProgress.jsx'
import LookBackPanel from './LookBackPanel.jsx'
import { prefersReducedMotion } from '../../shared/motion.js'
import {
  MAX_CARDS,
  OWN_VOICE,
  activeModel,
  cardOf,
  gradeTask,
  initialNextWordState,
  isCopiedSentence,
  keepCard,
  lookBackOf,
  maxLookBackOf,
  maxWordsOf,
  maxPacksOf,
  modelBodyOf,
  normalizeNextWordState,
  openingWordsOf,
  packVoicesOf,
  ownWordsOf,
  panelsOf,
  passAtOf,
  sillyLabel,
  voiceOf,
  voicesOf,
  whyWord,
  writeTokens,
} from './next_word.js'
import {
  DEFAULT_TEMPERATURE,
  MAX_PASTE_CHARS,
  MAX_TEMPERATURE,
  MIN_TEMPERATURE,
  describeCount,
  joinTokens,
  nextOptions,
  normaliseWord,
} from './ngram.js'

// Next Word, write mode: the bot writes a sentence word by word from a start word the student
// picks (Go!), shown on a styled card. Same contract as the guessing view (controlled: `state`,
// `onChange(prev => next)`, `readOnly`, `teacher`); never writes to Firebase itself. The tutor
// sees the sentence as it grows, the copy badge and the kept cards (all in the state).

const WORD_MS = 330
const CARD_ICON = { headline: '📰', post: '💬', commentary: '🎙' }

const quote = (text) => `“${text}”`

// "after “the big”: dog 2 of 3 times", or the first word / a word it can no longer explain.
function whyText(why) {
  if (!why) return ''
  if (why.first) return `${quote(why.word)} is where it started.`
  if (why.count === 0 || why.total === 0) {
    return `It can’t explain ${quote(why.word)} now (what it reads has changed).`
  }
  const base = `after ${quote(why.context)}: ${describeCount(why.word, why.count, why.total)}`
  return why.fellBack ? `${base} (it had never seen the longer words, so it used fewer)` : base
}

export default function NextWordWriteView({ task, state: rawState, onChange, readOnly, teacher }) {
  const watching = readOnly === true || teacher === true
  const id = useId()
  const state = normalizeNextWordState(task, rawState ?? initialNextWordState(task))
  const panels = panelsOf(task)
  const voices = voicesOf(task)
  const voice = voiceOf(task, state)
  const packVoices = packVoicesOf(task, state)
  const model = activeModel(task, state)
  const lookBack = lookBackOf(task, state)
  const temperature = panels.includes('silly') ? state.temperature : DEFAULT_TEMPERATURE
  const goal = passAtOf(task)
  const progress = gradeTask(task, state)
  const cardStyle = cardOf(task)

  const [writing, setWriting] = useState(false)
  const [whyIndex, setWhyIndex] = useState(null)
  const [foldPref, setFoldPref] = useState(null)
  const [startNote, setStartNote] = useState('')
  const timersRef = useRef([])
  useEffect(
    () => () => {
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
    },
    []
  )

  // A save from a run that was cut off (the tab closed mid-write) counts as finished.
  useEffect(() => {
    if (!watching && state.sentence && !state.finished) finish()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openers = model ? openingWordsOf(model) : []
  // Any word can be typed; only its first word counts. What it does with a word the bot has never
  // read (or that nothing follows) is told in go().
  const typedStart =
    String(state.startWord ?? '')
      .trim()
      .split(/\s+/)[0] ?? ''
  const startWord = normaliseWord(typedStart)

  function update(patch) {
    if (watching) return
    onChange?.((prev) => ({ ...normalizeNextWordState(task, prev), ...patch }))
  }

  // Marks the output finished: copy check, run count.
  function finish() {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    setWriting(false)
    const source = modelBodyOf(task, state)
    onChange?.((prev) => {
      const base = normalizeNextWordState(task, prev)
      if (base.finished || !base.sentence) return { ...base, finished: Boolean(base.sentence) }
      const copied = isCopiedSentence(source, base.sentence)
      return {
        ...base,
        finished: true,
        copied,
        runs: base.runs + 1,
        copies: base.copies + (copied ? 1 : 0),
      }
    })
  }

  function go() {
    if (watching || !model) return
    if (writing) {
      finish()
      return
    }
    if (startWord && nextOptions(model, startWord).total === 0) {
      setStartNote(
        model.successors.has(startWord)
          ? `Nothing comes after ${quote(typedStart)} in what it read. Try another word.`
          : `I’ve never read ${quote(typedStart)} yet. Try another word.`
      )
      return
    }
    setStartNote('')
    const tokens = writeTokens(model, {
      start: startWord,
      lookBack,
      temperature,
      maxWords: maxWordsOf(task),
    })
    if (tokens.length === 0) return
    setWhyIndex(null)
    const show = (k) =>
      onChange?.((prev) => ({
        ...normalizeNextWordState(task, prev),
        sentence: joinTokens(tokens.slice(0, k)),
        finished: false,
        copied: false,
        kept: false,
        usedLookBack: lookBack,
      }))
    if (prefersReducedMotion() || tokens.length < 2) {
      show(tokens.length)
      finish()
      return
    }
    setWriting(true)
    show(1)
    for (let k = 2; k <= tokens.length; k++) {
      timersRef.current.push(setTimeout(() => show(k), (k - 1) * WORD_MS))
    }
    timersRef.current.push(setTimeout(finish, tokens.length * WORD_MS))
  }

  function keep() {
    if (watching || writing) return
    onChange?.((prev) => keepCard(task, normalizeNextWordState(task, prev)))
  }

  // Packs are switched on and off (at least one stays on, at most maxPacks).
  function togglePack(voiceId) {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    setWriting(false)
    setWhyIndex(null)
    const on = packVoices.map((entry) => entry.id)
    const next = on.includes(voiceId)
      ? on.filter((id) => id !== voiceId)
      : [...on, voiceId].slice(-maxPacksOf(task))
    if (next.length === 0) return
    update({
      packs: next,
      voice: next[0],
      sentence: '',
      finished: false,
      copied: false,
      kept: false,
    })
  }

  const words = state.sentence.split(' ').filter(Boolean)
  const done = state.finished && !writing
  const canKeep = !watching && done && !state.kept && state.cards.length < MAX_CARDS
  const why =
    model && whyIndex != null
      ? whyWord(model, state.sentence, whyIndex, state.usedLookBack || lookBack)
      : null

  const showFold = panels.includes('silly') || panels.includes('voices')
  const foldOpen = foldPref ?? false
  const own = (
    <section className="act-nw-card" data-testid="next_word-own">
      {watching ? (
        <>
          <p data-testid="next_word-own-count">
            {ownWordsOf(state) === 0
              ? 'No sentences added yet.'
              : `Added ${ownWordsOf(state)} words of their own:`}
          </p>
          {state.own ? <p className="act-nw-own-readonly">{state.own}</p> : null}
        </>
      ) : (
        <>
          <label htmlFor={`${id}-own`} className="act-nw-heading">
            My writing: add your own sentences
          </label>
          <textarea
            id={`${id}-own`}
            className="act-nw-textarea"
            value={state.own}
            maxLength={MAX_PASTE_CHARS}
            placeholder="Type a few sentences. The bot will learn from them too."
            onChange={(event) => update({ own: event.target.value })}
          />
          <p className="act-nw-count">
            {ownWordsOf(state)} {ownWordsOf(state) === 1 ? 'word' : 'words'} added
          </p>
        </>
      )}
    </section>
  )

  const foldBody = (
    <>
      {panels.includes('voices') && voices.length > 1 && (
        <div className="act-nw-voices" role="group" aria-label="Voices" data-act-control="group">
          {voices.map((entry) => (
            <ActChip
              key={entry.id}
              pressed={packVoices.some((on) => on.id === entry.id) && entry.id !== OWN_VOICE}
              disabled={watching || writing}
              onClick={() => togglePack(entry.id)}
            >
              <span aria-hidden="true">{entry.emoji}</span> {entry.label}
            </ActChip>
          ))}
        </div>
      )}
      {panels.includes('silly') && (
        <>
          <label htmlFor={`${id}-silly`} className="act-nw-heading">
            How silly should it be?
          </label>
          <div className="act-nw-silly">
            <span aria-hidden="true">🧐 Sensible</span>
            <input
              id={`${id}-silly`}
              className="act-nw-slider"
              type="range"
              min={MIN_TEMPERATURE}
              max={MAX_TEMPERATURE}
              step={0.1}
              value={state.temperature}
              disabled={watching || writing}
              aria-valuetext={sillyLabel(state.temperature)}
              onChange={(event) => update({ temperature: Number(event.target.value) })}
            />
            <span aria-hidden="true">Silly 🤪</span>
          </div>
          <p data-testid="next_word-silly-label">{sillyLabel(state.temperature)}</p>
        </>
      )}
    </>
  )

  const controls = (
    <>
      <section className="act-nw-card">
        <label htmlFor={`${id}-start`} className="act-nw-heading">
          Start with
        </label>
        <input
          id={`${id}-start`}
          className="act-nw-select"
          type="text"
          list={`${id}-openers`}
          value={state.startWord}
          maxLength={24}
          placeholder="any word"
          autoComplete="off"
          disabled={watching || writing}
          onChange={(event) => {
            setStartNote('')
            update({ startWord: event.target.value })
          }}
        />
        <datalist id={`${id}-openers`}>
          {openers.map((word) => (
            <option key={word} value={word} />
          ))}
        </datalist>
      </section>

      {panels.includes('lookback') && (
        <LookBackPanel
          value={lookBack}
          max={maxLookBackOf(task)}
          disabled={watching || writing}
          onPick={(n) => update({ lookBack: Math.min(maxLookBackOf(task), Math.max(1, n)) })}
        />
      )}

      {own}

      {showFold && (
        <ActFold
          fold={{
            id: 'silly-reads',
            title: panels.includes('silly') ? '🤪 Silly / What it reads' : '📖 What it reads',
            summary: panels.includes('silly')
              ? sillyLabel(state.temperature)
              : voice.id === OWN_VOICE
                ? ''
                : packVoices.map((entry) => entry.label).join(' + '),
            children: foldBody,
          }}
          open={foldOpen}
          onToggle={setFoldPref}
        />
      )}
    </>
  )

  const outputWords =
    words.length === 0 ? (
      <span className="act-nw-placeholder">Press Go! and watch it write.</span>
    ) : done ? (
      <span role="group" aria-label="Words it wrote. Tap one to see why." data-act-control="group">
        {words.map((word, i) => (
          <Fragment key={i}>
            <button
              type="button"
              className={`act-nw-outword${whyIndex === i ? ' act-nw-outword--on' : ''}`}
              aria-pressed={whyIndex === i}
              onClick={() => setWhyIndex(whyIndex === i ? null : i)}
            >
              {word}
            </button>{' '}
          </Fragment>
        ))}
      </span>
    ) : (
      words.map((word, i) => (
        <span key={i} className={i === words.length - 1 ? 'act-nw-word act-nw-word--new' : ''}>
          {word}{' '}
        </span>
      ))
    )

  const stage = (
    <section className="act-nw-section act-nw-stage" aria-label="What the bot wrote">
      <div
        className={`act-nw-outcard act-nw-outcard--${cardStyle}`}
        data-testid="next_word-card"
        aria-live="polite"
      >
        <span className="act-nw-outcard__icon" aria-hidden="true">
          {CARD_ICON[cardStyle]}
        </span>
        <p className="act-nw-outcard__text" data-testid="next_word-sentence">
          {outputWords}
        </p>
      </div>
      {done && state.copied && (
        <p className="act-nw-copied" role="status" data-testid="next_word-copied">
          ⚠ Copied word for word!
        </p>
      )}
      {startNote && (
        <p className="act-nw-hint" role="status" data-testid="next_word-start-note">
          {startNote}
        </p>
      )}
      {done && words.length > 1 && !why && (
        <p className="act-nw-hint">Tap a word to see why it picked it.</p>
      )}
      {why && (
        <p className="act-nw-why" role="status" data-testid="next_word-why">
          {whyText(why)}
        </p>
      )}
      <div className="act-nw-cards" data-testid="next_word-cards">
        <h3 className="act-nw-heading">
          ⭐ My cards: {Math.min(state.cards.length, goal)} of {goal}
        </h3>
        {state.cards.length === 0 ? (
          <p className="act-nw-none">Keep the cards you like best.</p>
        ) : (
          <ul className="act-nw-cardlist">
            {state.cards.map((card, i) => (
              <li
                key={i}
                className={`act-nw-minicard act-nw-minicard--${cardStyle}`}
                data-testid="next_word-keptcard"
              >
                <span className="act-nw-minicard__icon" aria-hidden="true">
                  {CARD_ICON[cardStyle]}
                </span>
                <span className="act-nw-minicard__text">{card.text}</span>
                {card.copied && <span className="act-nw-minicard__copied">copied</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )

  const action = watching ? null : (
    <>
      <ActButton
        main={{
          label: writing ? 'Stop' : 'Go!',
          icon: writing ? '⏸' : '▶',
          disabled: !model,
          onClick: go,
          testId: 'next_word-go',
        }}
        secondary={
          canKeep
            ? { label: 'Keep this card', icon: '⭐', onClick: keep, testId: 'next_word-keep' }
            : null
        }
      />
      {done && state.kept && (
        <p className="act-result act-result--good" role="status" data-testid="next_word-kept">
          Kept! ⭐
        </p>
      )}
      {!model && <p className="act-nw-none">Add a few sentences so it has something to read.</p>}
    </>
  )

  return (
    <div className="act-panel act-nw" data-testid="next_word-activity">
      <ActivityLayout
        progress={
          <>
            <RoundProgress done={progress.core} total={goal} core={goal} />
            {progress.done && <BonusBanner />}
          </>
        }
        stage={stage}
        action={action}
        actionUnderStage
        controls={controls}
      />
    </div>
  )
}
