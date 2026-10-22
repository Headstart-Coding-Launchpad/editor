import { useState } from 'react'
import definition from './definition.js'
import {
  DEFAULT_LIVE_TEST_SIZE,
  DEFAULT_MIN_EXAMPLES,
  DEFAULT_TARGET_ACCURACY,
  HELD_OUT_EVERY,
  MAX_LABEL_LENGTH,
  strokesToFlat,
  teacherTestItems,
} from './classifier.js'
import { DrawPad, GridThumb } from './DrawPad.jsx'
import {
  ChoiceCards,
  Field,
  InlineField,
  ValidationMessages,
  readNumber,
  useActivityValidation,
} from '../ui/builderKit.jsx'

// Builder editor for Classifier tasks: who names the classes, how the model is tested, the
// numbers, and (for a teacher test set) the test drawings, which are drawn on a pad right here.
// validateTask messages show at the top.

const TEST_SET_OPTIONS = [
  {
    value: 'held_out',
    label: 'Kept back',
    hint: `Every ${HELD_OUT_EVERY}th drawing the student makes is kept back for the test`,
  },
  { value: 'teacher', label: 'My test drawings', hint: 'The same test for every student' },
  { value: 'live', label: 'Live', hint: 'The student draws new test drawings' },
]

const CLASS_OPTIONS = [
  { value: 'set', label: 'I set the classes', hint: 'For example cat, fish, rocket' },
  { value: 'students', label: 'Students name their own', hint: '2 to 6 classes' },
]

const parseClasses = (text) =>
  text
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)

export default function ClassifierBuilderEditor({ task, onUpdate }) {
  const validation = useActivityValidation(definition, task)
  const classes = Array.isArray(task.classes) ? task.classes : []
  const named = classes.length > 0
  // Stays on "I set the classes" while the names are being retyped (an empty list is valid there).
  const [setByMe, setSetByMe] = useState(named)
  const testSet = task.testSet ?? 'held_out'
  const [classText, setClassText] = useState(classes.join(', '))
  const [newLabel, setNewLabel] = useState('')
  const [strokes, setStrokes] = useState([])
  const set = (patch) => onUpdate({ ...task, ...patch })
  const items = Array.isArray(task.testItems) ? task.testItems : []
  const label = newLabel && classes.includes(newLabel) ? newLabel : (classes[0] ?? '')

  function chooseTestSet(value) {
    const patch = { testSet: value }
    if (value === 'held_out') {
      patch.minExamplesPerClass = Math.max(
        HELD_OUT_EVERY,
        task.minExamplesPerClass ?? DEFAULT_MIN_EXAMPLES
      )
    }
    if (value === 'teacher' && !Array.isArray(task.testItems)) patch.testItems = []
    onUpdate({
      ...task,
      ...patch,
      ...(value !== 'teacher' ? { testItems: undefined } : {}),
      ...(value !== 'live' ? { liveTestSize: undefined } : {}),
    })
  }

  return (
    <div className="te-act-editor" data-activity-editor="classifier">
      <ValidationMessages messages={validation.general} />

      <p className="te-act-note">
        Students draw examples, train a model and test it. Only drawing mode is built (sound is not
        built yet).
      </p>

      <Field label="Classes">
        <ChoiceCards
          ariaLabel="Who names the classes"
          value={setByMe ? 'set' : 'students'}
          options={CLASS_OPTIONS}
          onChange={(value) => {
            setSetByMe(value === 'set')
            if (value === 'students') {
              set({ classes: [] })
              setClassText('')
            } else {
              const next = ['circle', 'square']
              set({ classes: next })
              setClassText(next.join(', '))
            }
          }}
        />
        {setByMe && (
          <InlineField label="Class names (separated by commas)" wide>
            <input
              className="te-input"
              value={classText}
              maxLength={6 * (MAX_LABEL_LENGTH + 2)}
              aria-label="Class names"
              onChange={(event) => {
                setClassText(event.target.value)
                set({ classes: parseClasses(event.target.value) })
              }}
            />
          </InlineField>
        )}
      </Field>

      <Field label="Test the model on">
        <ChoiceCards
          ariaLabel="Test set"
          value={testSet}
          options={TEST_SET_OPTIONS}
          onChange={chooseTestSet}
        />
      </Field>

      <div className="te-act-inline-row">
        <InlineField label="Drawings needed per class">
          <input
            className="te-input te-act-narrow"
            type="number"
            min="2"
            max="40"
            value={task.minExamplesPerClass ?? ''}
            placeholder={String(DEFAULT_MIN_EXAMPLES)}
            aria-label="Drawings needed per class"
            onChange={(event) => set({ minExamplesPerClass: readNumber(event.target.value) })}
          />
        </InlineField>
        <InlineField label="Target accuracy (%)">
          <input
            className="te-input te-act-narrow"
            type="number"
            min="1"
            max="100"
            value={task.targetAccuracy == null ? '' : Math.round(task.targetAccuracy * 100)}
            placeholder={String(Math.round(DEFAULT_TARGET_ACCURACY * 100))}
            aria-label="Target accuracy (%)"
            onChange={(event) => {
              const percent = readNumber(event.target.value)
              set({ targetAccuracy: percent == null ? undefined : percent / 100 })
            }}
          />
        </InlineField>
        {testSet === 'live' && (
          <InlineField label="Test drawings">
            <input
              className="te-input te-act-narrow"
              type="number"
              min="3"
              max="20"
              value={task.liveTestSize ?? ''}
              placeholder={String(DEFAULT_LIVE_TEST_SIZE)}
              aria-label="Number of live test drawings"
              onChange={(event) => set({ liveTestSize: readNumber(event.target.value) })}
            />
          </InlineField>
        )}
      </div>

      {testSet === 'teacher' && (
        <Field
          label="Test drawings"
          hint="The model has never seen these. Add at least two, and some for every class."
        >
          {!named && <p className="te-act-note">Set the class names first.</p>}
          <div className="act-cls-gallery" aria-label="Test drawings">
            {items.map((item, index) => {
              const grid = teacherTestItems({ testItems: [item] })[0]?.grid
              const name = `Test drawing ${index + 1}: ${item.label}`
              return (
                <div key={index} className="te-act-row">
                  <div className="act-cls-thumb" style={{ cursor: 'default' }}>
                    {grid && <GridThumb grid={grid} title={name} />}
                  </div>
                  <span>{item.label}</span>
                  <button
                    type="button"
                    className="te-remove-btn"
                    aria-label={`Remove test drawing ${index + 1}`}
                    title="Remove test drawing"
                    onClick={() => set({ testItems: items.filter((_, i) => i !== index) })}
                  >
                    ✕
                  </button>
                </div>
              )
            })}
          </div>
          {named && (
            <div className="te-act-rows">
              <InlineField label="Draw a test drawing of">
                <select
                  className="te-input"
                  value={label}
                  aria-label="Class of the new test drawing"
                  onChange={(event) => setNewLabel(event.target.value)}
                >
                  {classes.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </InlineField>
              <DrawPad strokes={strokes} onStrokes={setStrokes} label="New test drawing pad" />
              <div>
                <button
                  type="button"
                  className="te-add-check-btn"
                  disabled={strokes.length === 0 || !label}
                  onClick={() => {
                    set({ testItems: [...items, { label, strokes: strokesToFlat(strokes) }] })
                    setStrokes([])
                  }}
                >
                  + Add test drawing
                </button>
                <button
                  type="button"
                  className="te-add-check-btn"
                  disabled={strokes.length === 0}
                  onClick={() => setStrokes([])}
                >
                  Clear the pad
                </button>
              </div>
            </div>
          )}
        </Field>
      )}
    </div>
  )
}
