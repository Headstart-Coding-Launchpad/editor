import { ActSegmented } from '../ui/ActivityLayout.jsx'

// The look-back control: one segmented switch, 1 / 2 / 3 words. `value` is the number of words
// the model looks back. Shared by the guessing round and write mode.
export default function LookBackPanel({ value, max, disabled, onPick }) {
  const label = value === 1 ? '1 word' : `${value} words`
  return (
    <section className="act-nw-card" aria-label="Look back" data-testid="next_word-lookback">
      <h3 className="act-nw-heading">How many words back should it look?</h3>
      <ActSegmented
        label="Words to look back"
        value={value}
        disabled={disabled}
        onChange={onPick}
        options={Array.from({ length: max }, (_, i) => i + 1).map((n) => ({
          value: n,
          label: n === 1 ? '1 word' : `${n} words`,
          ariaLabel: n === 1 ? 'Look back 1 word' : `Look back ${n} words`,
        }))}
      />
      <p data-testid="next_word-lookback-label">It looks back {label}.</p>
    </section>
  )
}
