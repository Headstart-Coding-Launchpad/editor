import definition from './definition.js'
import { Field, ValidationMessages, readNumber, useActivityValidation } from '../ui/builderKit.jsx'

// Builder editor for Learning Tree tasks: the features and labels (comma lists), the three
// numbers (maxExamples, maxDepth, passAt) and the test items (name, true features, label).
// validateTask messages show at the top. Controls are at least 44px.

const asList = (value) => (Array.isArray(value) ? value : [])

function NumberField({ task, onUpdate, name, label, hint, step = '1', min, max }) {
  return (
    <Field label={label} hint={hint}>
      <input
        className="te-input te-act-narrow"
        type="number"
        min={min}
        max={max}
        step={step}
        value={task[name] ?? ''}
        aria-label={label}
        onChange={(e) => {
          const value = readNumber(e.target.value)
          const { [name]: _drop, ...rest } = task
          onUpdate(value == null ? rest : { ...rest, [name]: value })
        }}
      />
    </Field>
  )
}

export default function LearningTreeBuilderEditor({ task, onUpdate }) {
  const validation = useActivityValidation(definition, task)
  const features = asList(task.features)
  const labels = asList(task.labels)
  const items = asList(task.testItems)

  const setList = (name) => (e) =>
    onUpdate({ ...task, [name]: e.target.value.split(',').map((text) => text.trim()) })
  const updateItem = (index, patch) =>
    onUpdate({
      ...task,
      testItems: items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    })

  return (
    <div className="te-act-editor" data-activity-editor="learning_tree">
      <ValidationMessages messages={validation.general} />

      <Field
        label="Features"
        hint="yes/no questions, 1 to 6, separated by commas (has_fur, can_fly)"
      >
        <input
          className="te-input te-act-tap-input"
          value={features.join(', ')}
          aria-label="Features"
          onChange={setList('features')}
        />
      </Field>
      <Field
        label="Labels"
        hint="2 to 6 answers, separated by commas (pet, wild). A tie goes to the first."
      >
        <input
          className="te-input te-act-tap-input"
          value={labels.join(', ')}
          aria-label="Labels"
          onChange={setList('labels')}
        />
      </Field>
      <NumberField
        task={task}
        onUpdate={onUpdate}
        name="maxExamples"
        label="Max examples"
        hint="Blank means 20."
        min="4"
        max="40"
      />
      <NumberField
        task={task}
        onUpdate={onUpdate}
        name="maxDepth"
        label="Max depth"
        hint="Most questions in a row. Blank means 3."
        min="1"
        max="5"
      />
      <label className="te-check-toggle">
        <input
          type="checkbox"
          checked={task.studentDepth !== false}
          onChange={(e) => {
            const { studentDepth: _drop, ...rest } = task
            onUpdate(e.target.checked ? rest : { ...rest, studentDepth: false })
          }}
        />
        Student can change the depth
      </label>
      <NumberField
        task={task}
        onUpdate={onUpdate}
        name="studentPicksFeatures"
        label="Student picks features"
        hint="Blank means the tree uses every feature. A number lets the student choose up to that many."
        min="1"
        max="6"
      />
      <NumberField
        task={task}
        onUpdate={onUpdate}
        name="passAt"
        label="Pass at"
        hint="A share (0.8) or a number of test items. Blank means 0.8 (4 of 5)."
        step="any"
        min="0"
      />

      <Field label="Test items" hint="unseen items the tree is tested on (2 to 12)">
        <div className="te-act-rows">
          {items.map((item, index) => {
            const yes = asList(item?.yes)
            return (
              <div key={index} className="te-act-row" data-row={`item-${index + 1}`}>
                <div className="te-act-row__head">
                  <span className="te-quiz-answer-badge">{index + 1}</span>
                  <input
                    className="te-input te-act-tap-input"
                    value={item?.name ?? ''}
                    placeholder="Name"
                    aria-label={`Test item ${index + 1} name`}
                    onChange={(e) => updateItem(index, { name: e.target.value })}
                  />
                  <select
                    className="te-select te-act-tap-input"
                    value={item?.label ?? ''}
                    aria-label={`Test item ${index + 1} label`}
                    onChange={(e) => updateItem(index, { label: e.target.value })}
                  >
                    {!labels.includes(item?.label) && <option value="">Label...</option>}
                    {labels.filter(Boolean).map((label) => (
                      <option key={label} value={label}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="te-remove-btn"
                    disabled={items.length <= 2}
                    aria-label={`Remove test item ${index + 1}`}
                    onClick={() =>
                      onUpdate({ ...task, testItems: items.filter((_, i) => i !== index) })
                    }
                  >
                    ✕
                  </button>
                </div>
                <div className="te-act-row__fields">
                  {features.filter(Boolean).map((feature) => (
                    <label key={feature} className="te-act-inline">
                      <input
                        type="checkbox"
                        checked={yes.includes(feature)}
                        aria-label={`Test item ${index + 1} ${feature}`}
                        onChange={(e) =>
                          updateItem(index, {
                            yes: e.target.checked
                              ? [...yes, feature]
                              : yes.filter((f) => f !== feature),
                          })
                        }
                      />
                      <span>{feature}</span>
                    </label>
                  ))}
                </div>
                <ValidationMessages messages={validation.rows[`item:${index}`]} />
              </div>
            )
          })}
          <button
            type="button"
            className="te-add-check-btn"
            disabled={items.length >= 12}
            onClick={() =>
              onUpdate({
                ...task,
                testItems: [...items, { name: '', yes: [], label: labels[0] ?? '' }],
              })
            }
          >
            + Add test item
          </button>
        </div>
      </Field>
    </div>
  )
}
