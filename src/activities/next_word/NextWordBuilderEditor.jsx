import definition from './definition.js'
import { MAX_TEXT_CHARS } from './ngram.js'
import {
  DEFAULT_GUESSES,
  DEFAULT_TEXT_EMOJI,
  MAX_GUESSES,
  MAX_LOOK_BACK,
  PANELS,
  maxLookBackOf,
  panelsOf,
  startLookBackOf,
} from './next_word.js'
import { Field, InlineField, ValidationMessages, useActivityValidation } from '../ui/builderKit.jsx'

// Builder editor for Next Word tasks: how many guesses make the round, which extra parts show
// (panels), and the texts the student can switch to as voices (only used with the voices panel).
// validateTask messages show at the top.

const CONTROL = { minHeight: 44 }

const PANEL_LABELS = {
  stats: 'Stats: bars of which words followed the last word',
  silly: 'Silly: a Sensible to Silly slider',
  voices: 'Voices: switch between the texts below and My writing',
  lookback: 'Look-back: the student picks how many words back it looks (1 to 3)',
}

function TextRows({ texts, onChange }) {
  const list = Array.isArray(texts) ? texts : []
  const update = (index, patch) =>
    onChange(list.map((text, i) => (i === index ? { ...text, ...patch } : text)))
  return (
    <Field label="Voices (texts)" hint="only used when the voices panel is on">
      <div className="te-act-rows">
        {list.map((text, index) => {
          const n = index + 1
          const length = String(text?.body ?? '').length
          return (
            <div key={index} className="te-act-row" data-row={`text-${n}`}>
              <div className="te-act-row__head">
                <span className="te-quiz-answer-badge">{n}</span>
                <label className="te-act-inline">
                  <span>Title</span>
                  <input
                    className="te-input"
                    style={CONTROL}
                    value={text?.title ?? ''}
                    aria-label={`Text ${n} title`}
                    onChange={(e) => update(index, { title: e.target.value })}
                  />
                </label>
                <label className="te-act-inline">
                  <span>Emoji</span>
                  <input
                    className="te-input"
                    style={{ ...CONTROL, width: 72 }}
                    value={text?.emoji ?? ''}
                    placeholder={DEFAULT_TEXT_EMOJI}
                    aria-label={`Text ${n} emoji`}
                    onChange={(e) => update(index, { emoji: e.target.value })}
                  />
                </label>
                <button
                  type="button"
                  className="te-remove-btn"
                  style={{ minWidth: 44, minHeight: 44 }}
                  onClick={() => onChange(list.filter((_, i) => i !== index))}
                  title="Remove text"
                  aria-label={`Remove text ${n}`}
                >
                  ✕
                </button>
              </div>
              <div className="te-act-row__fields">
                <InlineField label="Body" wide>
                  <textarea
                    className="te-input"
                    style={{ ...CONTROL, minHeight: 96 }}
                    value={text?.body ?? ''}
                    aria-label={`Text ${n} body`}
                    onChange={(e) => update(index, { body: e.target.value })}
                  />
                </InlineField>
                <span className="te-act-note" aria-live="polite">
                  {length} of {MAX_TEXT_CHARS} characters
                </span>
              </div>
            </div>
          )
        })}
        <button
          type="button"
          className="te-add-check-btn"
          style={CONTROL}
          onClick={() => onChange([...list, { title: `Text ${list.length + 1}`, body: '' }])}
        >
          + Add text
        </button>
      </div>
    </Field>
  )
}

function Switch({ label, checked, onChange }) {
  return (
    <label className="te-act-inline" style={CONTROL}>
      <input
        type="checkbox"
        style={{ width: 24, height: 24 }}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  )
}

export default function NextWordBuilderEditor({ task, onUpdate }) {
  const validation = useActivityValidation(definition, task)
  const panels = panelsOf(task)
  const togglePanel = (panel, on) =>
    onUpdate({
      ...task,
      panels: PANELS.filter((name) => (name === panel ? on : panels.includes(name))),
    })
  return (
    <div className="te-act-editor" data-activity-editor="next_word">
      <ValidationMessages messages={validation.general} />

      <Field label="Guesses" hint="the round: 'Guess what it says next' this many times">
        <input
          className="te-input"
          style={{ ...CONTROL, width: 96 }}
          type="number"
          min={1}
          max={MAX_GUESSES}
          value={task.guesses ?? DEFAULT_GUESSES}
          aria-label="Guesses"
          onChange={(e) => {
            const value = e.target.value === '' ? undefined : Number(e.target.value)
            onUpdate({ ...task, guesses: value })
          }}
        />
      </Field>

      <Field label="Parts to show" hint="keep it simple: only what this lesson needs">
        {PANELS.map((panel) => (
          <Switch
            key={panel}
            label={PANEL_LABELS[panel]}
            checked={panels.includes(panel)}
            onChange={(on) => togglePanel(panel, on)}
          />
        ))}
      </Field>

      {panels.includes('lookback') && (
        <Field
          label="Look-back"
          hint="starting value, and the most words back the student can pick"
        >
          <label className="te-act-inline">
            <span>Starts at</span>
            <input
              className="te-input"
              style={{ ...CONTROL, width: 80 }}
              type="number"
              min={1}
              max={maxLookBackOf(task)}
              value={startLookBackOf(task)}
              aria-label="Look-back start"
              onChange={(e) =>
                onUpdate({
                  ...task,
                  lookBack: e.target.value === '' ? undefined : Number(e.target.value),
                })
              }
            />
          </label>
          <label className="te-act-inline">
            <span>At most</span>
            <input
              className="te-input"
              style={{ ...CONTROL, width: 80 }}
              type="number"
              min={1}
              max={MAX_LOOK_BACK}
              value={maxLookBackOf(task)}
              aria-label="Look-back maximum"
              onChange={(e) =>
                onUpdate({
                  ...task,
                  maxLookBack: e.target.value === '' ? undefined : Number(e.target.value),
                })
              }
            />
          </label>
        </Field>
      )}

      <TextRows texts={task.texts} onChange={(texts) => onUpdate({ ...task, texts })} />
    </div>
  )
}
