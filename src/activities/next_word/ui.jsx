import { useId, useState } from 'react'
import NextWordBuilderEditor from './NextWordBuilderEditor.jsx'
import ItemNav from '../ui/ItemNav.jsx'
import ActivityCorrect from '../ui/ActivityCorrect.jsx'
import {
  chosenText,
  gradeItem,
  initialNextWordState,
  itemStateOf,
  optionsForPrompt,
  textsOf,
} from './next_word.js'
import {
  DEFAULT_TEMPERATURE,
  MAX_GENERATED_CHARS,
  MAX_PASTE_CHARS,
  MAX_TEMPERATURE,
  MIN_TEMPERATURE,
  describeCount,
  generateText,
  modelFor,
  nextOptions,
  normaliseWord,
  startingWords,
  temperatureLabel,
  tokenise,
} from './ngram.js'

// Next Word UI. Controlled view: ActivityHost passes `state`, `onChange(next | prev =>
// next)`, `onSubmit()` (grades and reports; resolves to { passed }), `readOnly` (teacher views
// and review) and `device`. Never write to Firebase or storage here: useActivityState owns
// persistence and live sync. The model is rebuilt in the browser from the chosen text (cached
// in ngram.js); nothing leaves the device.

const MAX_BARS = 8

// The probability bars for one word. Every row says the number in words, so the bar is only a
// picture of it.
function NextWordBars({ info, label }) {
  if (!info) return null
  if (info.total === 0) {
    return <p className="act-nw-none">In this text, no word comes after “{info.word}”.</p>
  }
  const shown = info.options.slice(0, MAX_BARS)
  const hidden = info.options.length - shown.length
  return (
    <div>
      <p className="act-nw-bars-title" style={{ fontWeight: 600 }}>
        {label ?? `After “${info.word}”, the next word was:`}
      </p>
      <ul className="act-nw-bars" aria-label={`Words that come after ${info.word}`}>
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

export function NextWordStudentView({ task, state, onChange, onSubmit, readOnly = false }) {
  const groupId = useId()
  const texts = textsOf(task)
  const items = task?.items ?? []
  const text = chosenText(task, state)
  const [index, setIndex] = useState(0)
  const [pasteOpen, setPasteOpen] = useState(state?.source === 'paste')
  const [draft, setDraft] = useState(state?.pasted ?? '')
  const [checked, setChecked] = useState({})
  const [notice, setNotice] = useState('')
  const current = items[Math.min(index, items.length - 1)]
  const model = text ? modelFor(text.body) : null
  const probe = String(state?.probe ?? '')
  const temperature = Number.isFinite(state?.temperature) ? state.temperature : DEFAULT_TEMPERATURE

  function update(patch) {
    if (readOnly) return
    onChange?.((prev) => ({ ...(prev ?? initialNextWordState(task)), ...patch }))
  }

  function updateItem(id, patch) {
    if (readOnly) return
    onChange?.((prev) => {
      const base = prev ?? initialNextWordState(task)
      return {
        ...base,
        items: { ...(base.items ?? {}), [id]: { ...itemStateOf(base, { id }), ...patch } },
      }
    })
  }

  function chooseText(i) {
    setPasteOpen(false)
    setNotice('')
    update({ source: 'text', index: i })
  }

  function usePasted() {
    const cleaned = draft.trim().slice(0, MAX_PASTE_CHARS)
    if (tokenise(cleaned).length < 2) {
      setNotice('Paste at least two words first.')
      return
    }
    setNotice('')
    update({ source: 'paste', pasted: cleaned })
  }

  function handleGenerate() {
    if (!model) {
      setNotice('Pick a text first.')
      return
    }
    setNotice('')
    let generated = generateText(model, { start: probe, temperature })
    if (generated.length > MAX_GENERATED_CHARS) {
      generated = generated.slice(0, MAX_GENERATED_CHARS).replace(/\s+\S*$/, '')
    }
    update({ generated })
  }

  function handleReveal() {
    if (!current) return
    const own = itemStateOf(state, current)
    if (!text || tokenise(own.guess).length !== 1) {
      setNotice(gradeItem(task, current, state).hint)
      return
    }
    setNotice('')
    updateItem(current.id, { revealed: true })
  }

  async function handleCheck() {
    const outcome = await onSubmit?.()
    setChecked(Object.fromEntries(items.map((item) => [item.id, true])))
    if (!outcome?.passed) {
      const firstWrong = items.findIndex((item) => !gradeItem(task, item, state).correct)
      if (firstWrong >= 0) setIndex(firstWrong)
    }
  }

  const statusFor = (item) => {
    const result = gradeItem(task, item, state)
    if (result.correct) return 'done'
    return itemStateOf(state, item).revealed ? 'wrong' : null
  }

  const probeInfo = model && normaliseWord(probe) ? nextOptions(model, probe) : null
  const starters = model ? startingWords(model, 10) : []
  const own = current ? itemStateOf(state, current) : null
  const result = current ? gradeItem(task, current, state) : null
  const promptInfo = current && own?.revealed ? optionsForPrompt(task, state, current.prompt) : null
  const hint =
    result && !result.correct && (own.revealed || checked[current.id]) ? result.hint : null

  return (
    <div className="act-panel" data-testid="next_word-activity">
      <section className="act-nw-section" aria-labelledby={`${groupId}-pick`}>
        <h3 className="act-nw-heading" id={`${groupId}-pick`}>
          1. Pick a text
        </h3>
        <div role="radiogroup" aria-labelledby={`${groupId}-pick`} className="act-nw-choices">
          {texts.map((entry, i) => (
            <label key={i} className="act-nw-choice">
              <input
                type="radio"
                name={`${groupId}-text`}
                checked={!pasteOpen && state?.source === 'text' && state?.index === i}
                disabled={readOnly}
                onChange={() => chooseText(i)}
              />
              {entry.title}
            </label>
          ))}
          {task?.allowPaste === true && (
            <label className="act-nw-choice">
              <input
                type="radio"
                name={`${groupId}-text`}
                checked={pasteOpen || state?.source === 'paste'}
                disabled={readOnly}
                onChange={() => setPasteOpen(true)}
              />
              Paste my own text
            </label>
          )}
        </div>
        {task?.allowPaste === true && (pasteOpen || state?.source === 'paste') && !readOnly && (
          <div className="act-nw-paste">
            <label htmlFor={`${groupId}-paste`} style={{ fontWeight: 600 }}>
              Your text
            </label>
            <textarea
              id={`${groupId}-paste`}
              className="act-nw-textarea"
              value={draft}
              maxLength={MAX_PASTE_CHARS}
              onChange={(event) => setDraft(event.target.value)}
            />
            <div className="act-row">
              <button type="button" className="btn-primary act-btn" onClick={usePasted}>
                Use my text
              </button>
              <span>
                {draft.length} of {MAX_PASTE_CHARS} letters
              </span>
            </div>
          </div>
        )}
        {text ? (
          <p className="act-nw-text" data-testid="next_word-text">
            <strong>{text.label}: </strong>
            {text.body}
          </p>
        ) : (
          <p>Choose a text to build the word-pair model.</p>
        )}
      </section>

      <section className="act-nw-section" aria-labelledby={`${groupId}-explore`}>
        <h3 className="act-nw-heading" id={`${groupId}-explore`}>
          2. What usually comes next?
        </h3>
        <div className="act-row">
          <label htmlFor={`${groupId}-probe`} style={{ fontWeight: 600 }}>
            Type a word
          </label>
          <input
            id={`${groupId}-probe`}
            className="act-nw-input"
            type="text"
            autoComplete="off"
            maxLength={40}
            value={probe}
            disabled={readOnly || !text}
            onChange={(event) => update({ probe: event.target.value })}
          />
        </div>
        {starters.length > 0 && (
          <div className="act-row" role="group" aria-label="Or choose a word">
            {starters.map((word) => (
              <button
                key={word}
                type="button"
                className="act-nw-chip"
                aria-pressed={normaliseWord(probe) === word}
                disabled={readOnly}
                onClick={() => update({ probe: word })}
              >
                {word}
              </button>
            ))}
          </div>
        )}
        {probeInfo ? (
          <NextWordBars info={probeInfo} />
        ) : (
          text && <p>Type a word, or choose one above, to see which word comes next.</p>
        )}
      </section>

      {current && (
        <section className="act-nw-section" aria-labelledby={`${groupId}-predict`}>
          <h3 className="act-nw-heading" id={`${groupId}-predict`}>
            3. Predict the next word
          </h3>
          <ItemNav
            items={items}
            currentIndex={Math.min(index, items.length - 1)}
            onSelect={(i) => {
              setIndex(i)
              setNotice('')
            }}
            statusFor={statusFor}
          />
          <p className="act-prompt">{current.prompt} …</p>
          <div className="act-row">
            <label htmlFor={`${groupId}-guess`} style={{ fontWeight: 600 }}>
              Your prediction
            </label>
            <input
              id={`${groupId}-guess`}
              className="act-nw-input"
              type="text"
              autoComplete="off"
              maxLength={40}
              value={own.guess}
              disabled={readOnly || own.revealed}
              onChange={(event) => {
                setChecked((prev) => ({ ...prev, [current.id]: false }))
                setNotice('')
                updateItem(current.id, { guess: event.target.value })
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !readOnly && !own.revealed) handleReveal()
              }}
            />
            {!readOnly && !own.revealed && (
              <button type="button" className="btn-primary act-btn" onClick={handleReveal}>
                Reveal
              </button>
            )}
            {!readOnly && own.revealed && !result.correct && (
              <button
                type="button"
                className="btn-ghost-outline act-btn"
                onClick={() => updateItem(current.id, { revealed: false })}
              >
                Try again
              </button>
            )}
          </div>
          {readOnly && !own.revealed && (
            <p>
              {own.guess ? `Guessing: “${own.guess}” (not revealed yet)` : 'No prediction yet.'}
            </p>
          )}
          {promptInfo && <NextWordBars info={promptInfo} />}
          {result?.correct && <ActivityCorrect />}
          {hint && (
            <p className="act-hint" role="status">
              💡 {hint}
            </p>
          )}
        </section>
      )}

      <section className="act-nw-section" aria-labelledby={`${groupId}-generate`}>
        <h3 className="act-nw-heading" id={`${groupId}-generate`}>
          4. Make some text
        </h3>
        {task?.showTemperature === true && (
          <div className="act-row">
            <label htmlFor={`${groupId}-temp`} style={{ fontWeight: 600 }}>
              Temperature
            </label>
            <input
              id={`${groupId}-temp`}
              className="act-nw-slider"
              type="range"
              min={MIN_TEMPERATURE}
              max={MAX_TEMPERATURE}
              step={0.1}
              value={temperature}
              disabled={readOnly}
              aria-valuetext={`${temperature.toFixed(1)}, ${temperatureLabel(temperature)}`}
              onChange={(event) => update({ temperature: Number(event.target.value) })}
            />
            <span>
              {temperature.toFixed(1)} ({temperatureLabel(temperature)})
            </span>
          </div>
        )}
        {!readOnly && (
          <div className="act-row">
            <button type="button" className="btn-primary act-btn" onClick={handleGenerate}>
              Generate
            </button>
            {normaliseWord(probe) && <span>Starts with “{normaliseWord(probe)}”.</span>}
          </div>
        )}
        <p className="act-nw-generated" aria-live="polite">
          {state?.generated || 'Press Generate to make text from the word pairs.'}
        </p>
      </section>

      {notice && (
        <p className="act-hint" role="status">
          💡 {notice}
        </p>
      )}

      {!readOnly && (
        <div className="act-row act-row--submit">
          <button type="button" className="btn-primary act-btn" onClick={handleCheck}>
            Check my work
          </button>
        </div>
      )}
    </div>
  )
}

// Teacher surfaces fall back to this StudentView with readOnly (the tutor sees the chosen text,
// the typed word, every prediction and its marks, and the generated text). The card summary
// text comes from definition.summarize.
export default {
  StudentView: NextWordStudentView,
  BuilderEditor: NextWordBuilderEditor,
}
