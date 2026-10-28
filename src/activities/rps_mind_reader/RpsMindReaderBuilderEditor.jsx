import definition from './definition.js'
import {
  DEFAULT_LOOK_BACK,
  DEFAULT_ROUNDS,
  PANELS,
  lookBackOf,
  panelsOf,
  passAtOf,
  roundsOf,
} from './rps_mind_reader.js'
import {
  InlineField,
  ValidationMessages,
  readNumber,
  useActivityValidation,
} from '../ui/builderKit.jsx'

// Builder editor for Mind Reader tasks: rounds, how far back it looks, what to show and when the
// task passes. validateTask messages show at the top.

const PANEL_LABELS = {
  network: 'Show the brain (network diagram)',
  history: 'Show how often it read them (chart)',
  lookback: 'Let students change how many moves it remembers (1 to 5)',
}

export default function RpsMindReaderBuilderEditor({ task, onUpdate }) {
  const validation = useActivityValidation(definition, task)
  const set = (patch) => onUpdate({ ...task, ...patch })
  const panels = panelsOf(task)

  return (
    <div className="te-act-editor" data-activity-editor="rps_mind_reader">
      <ValidationMessages messages={validation.general} />

      <p className="te-act-note">
        Students play rock-paper-scissors against a tiny neural network that locks in its pick, then
        learns their moves one round at a time.
      </p>

      <div className="te-act-inline-row">
        <InlineField label="Rounds (5 to 100)">
          <input
            type="number"
            min={5}
            max={100}
            aria-label="Rounds"
            value={task.rounds ?? ''}
            placeholder={String(roundsOf({}) || DEFAULT_ROUNDS)}
            onChange={(event) => set({ rounds: readNumber(event.target.value) })}
          />
        </InlineField>
        <InlineField label="It sees their last moves (1 to 5)">
          <input
            type="number"
            min={1}
            max={5}
            aria-label="Moves it sees"
            value={task.lookBack ?? ''}
            placeholder={String(lookBackOf({}) || DEFAULT_LOOK_BACK)}
            onChange={(event) => set({ lookBack: readNumber(event.target.value) })}
          />
        </InlineField>
        <InlineField label="Pass after rounds played">
          <input
            type="number"
            min={1}
            aria-label="Pass after"
            value={task.passAt ?? ''}
            placeholder={String(passAtOf(task))}
            onChange={(event) => set({ passAt: readNumber(event.target.value) })}
          />
        </InlineField>
      </div>

      {PANELS.map((id) => (
        <label key={id} className="te-check-toggle">
          <input
            type="checkbox"
            checked={panels.includes(id)}
            onChange={(event) =>
              set({
                panels: PANELS.filter((p) =>
                  p === id ? event.target.checked : panels.includes(p)
                ),
              })
            }
          />
          {PANEL_LABELS[id]}
        </label>
      ))}
    </div>
  )
}
