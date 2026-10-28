import definition from './definition.js'
import { DATASET_LABELS, maxNeuronsOf, startLayersOf, targetOf } from './network_playground.js'
import {
  ChoiceCards,
  Field,
  InlineField,
  ValidationMessages,
  readNumber,
  useActivityValidation,
} from '../ui/builderKit.jsx'

// Builder editor for Network Playground tasks: the dots, the starting layers, the limits and the
// accuracy to pass. validateTask messages show at the top.

const DATASET_OPTIONS = [
  { value: 'two_blobs', label: DATASET_LABELS.two_blobs, hint: 'Easy: one straight line sorts it' },
  { value: 'circle', label: DATASET_LABELS.circle, hint: 'Needs a hidden layer to crack' },
  { value: 'spiral', label: DATASET_LABELS.spiral, hint: 'Hard: wants two layers' },
]

export default function NetworkPlaygroundBuilderEditor({ task, onUpdate }) {
  const validation = useActivityValidation(definition, task)
  const set = (patch) => onUpdate({ ...task, ...patch })
  const layers = startLayersOf(task)
  const text = Array.isArray(task.layers) ? task.layers.join(', ') : layers.join(', ')

  return (
    <div className="te-act-editor" data-activity-editor="network_playground">
      <ValidationMessages messages={validation.general} />

      <p className="te-act-note">
        Students train a tiny neural network to sort orange and blue dots, watching its neurons and
        the colours it guesses. They can add neurons and a layer until it reaches the target.
      </p>

      <Field label="Dots">
        <ChoiceCards
          ariaLabel="Dots"
          value={task.dataset}
          options={DATASET_OPTIONS}
          onChange={(value) => set({ dataset: value })}
        />
      </Field>

      <Field
        label="Starting layers"
        hint="Neurons in each hidden layer, 1 or 2 layers (e.g. 3 or 4, 3)."
      >
        <input
          type="text"
          aria-label="Starting layers"
          defaultValue={text}
          onBlur={(event) => {
            const list = event.target.value
              .split(',')
              .map((part) => part.trim())
              .filter(Boolean)
              .map(Number)
            set({ layers: list })
          }}
        />
      </Field>

      <div className="te-act-inline-row">
        <InlineField label="Most neurons in a layer">
          <input
            type="number"
            min={1}
            max={8}
            aria-label="Most neurons in a layer"
            value={task.maxNeurons ?? ''}
            placeholder={String(maxNeuronsOf(task))}
            onChange={(event) => set({ maxNeurons: readNumber(event.target.value) })}
          />
        </InlineField>
        <InlineField label="Accuracy to pass (0 to 1)">
          <input
            type="number"
            min={0.5}
            max={1}
            step={0.05}
            aria-label="Accuracy to pass"
            value={task.target ?? ''}
            placeholder={String(targetOf(task))}
            onChange={(event) => set({ target: readNumber(event.target.value) })}
          />
        </InlineField>
      </div>

      <label className="te-check-toggle">
        <input
          type="checkbox"
          checked={task.allowAddLayer !== false}
          onChange={(event) => set({ allowAddLayer: event.target.checked })}
        />
        Students can add a layer
      </label>
    </div>
  )
}
