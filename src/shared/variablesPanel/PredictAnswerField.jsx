import { predictChoiceText } from './variablesPanel.js'
import { numberInputProps, sanitizeNumberText } from './answerFields.js'

/**
 * The answer control of one predict tag (showVariables.predict, p6-27), chosen by what the
 * author said the tag takes (`spec`: `{ answer, choices }` from getShowVariables' `answers`):
 *
 * - `choices` → one button per choice (the choice as the panel writes values: "red", 3, True)
 * - `boolean` → **True** and **False** buttons (words, never colour alone)
 * - `number`  → a number field (whole numbers and decimals; numeric keypad on touch screens)
 * - `text`    → the text box, shown between quote marks so it reads as text
 * - none (a plain name) → today's free text box, unchanged (it takes any kind of value)
 *
 * Every pick or entry reaches `onChange(text)` as the text the forgiving comparison reads
 * (predictionMatches), so `variables_predicted` judges typed and picked answers alike. Buttons
 * call `onCommit` straight after (one tap, one write); the boxes commit on blur. Buttons and
 * boxes are at least 44 px on touch screens (NameTagPanel.css).
 */
export default function PredictAnswerField({
  id,
  name,
  spec = null,
  value = '',
  onChange,
  onCommit,
  describedBy,
}) {
  const answer = spec?.answer ?? null
  if (Array.isArray(spec?.choices) && spec.choices.length > 0) {
    const options = spec.choices.map((choice) => {
      const text = predictChoiceText(choice)
      return { value: text, text }
    })
    return (
      <ChoiceButtons
        label={`${name}: predict one of ${options.map((option) => option.text).join(', ')}`}
        options={options}
        value={value}
        onPick={(picked) => {
          onChange(picked)
          onCommit?.()
        }}
        describedBy={describedBy}
      />
    )
  }
  if (answer === 'boolean') {
    return (
      <ChoiceButtons
        label={`${name}: predict True or False`}
        options={[
          { value: 'True', text: 'True' },
          { value: 'False', text: 'False' },
        ]}
        value={value}
        onPick={(picked) => {
          onChange(picked)
          onCommit?.()
        }}
        describedBy={describedBy}
      />
    )
  }
  if (answer === 'number') {
    return (
      <NumberAnswerField
        id={id}
        value={value}
        onChange={onChange}
        onCommit={onCommit}
        describedBy={describedBy}
        placeholder="A number"
      />
    )
  }
  const box = (
    <input
      id={id}
      className="ntp-input"
      type="text"
      value={value}
      placeholder={answer === 'text' ? 'Some text' : 'Your prediction'}
      autoComplete="off"
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      aria-describedby={describedBy}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onCommit}
    />
  )
  if (answer !== 'text') return box
  // Text: the box sits between quote marks, so it reads as text ("5" is not 5).
  return (
    <span className="ntp-text-answer">
      <span className="ntp-quote" aria-hidden="true">
        &quot;
      </span>
      {box}
      <span className="ntp-quote" aria-hidden="true">
        &quot;
      </span>
    </span>
  )
}

/**
 * A number answer box: whole numbers and decimals (`whole` for counts: digits only), anything
 * else filtered out as it is typed (sanitizeNumberText), with the numeric keypad on touch
 * screens. Shared with the run-count box's logic (./answerFields.js).
 */
export function NumberAnswerField({
  id,
  value = '',
  onChange,
  onCommit,
  whole = false,
  ariaLabel,
  describedBy,
  placeholder,
  className = 'ntp-input ntp-input--number',
}) {
  return (
    <input
      id={id}
      className={className}
      {...numberInputProps({ whole })}
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      aria-describedby={describedBy}
      onChange={(event) => onChange(sanitizeNumberText(event.target.value, { whole }))}
      onBlur={onCommit}
    />
  )
}

/**
 * A row of answer buttons (True / False, an author's choices, or type labels): words on every
 * button, the picked one pressed (aria-pressed) and marked with a ● as well as its colour.
 */
export function ChoiceButtons({ label, options, value, onPick, describedBy }) {
  return (
    <div className="ntp-choices" role="group" aria-label={label} aria-describedby={describedBy}>
      {options.map((option) => {
        const picked = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            className={`ntp-choice${picked ? ' is-picked' : ''}`}
            aria-pressed={picked}
            onClick={() => onPick(option.value)}
          >
            {picked && (
              <span className="ntp-choice-mark" aria-hidden="true">
                ●{' '}
              </span>
            )}
            {option.text}
          </button>
        )
      })}
    </div>
  )
}
