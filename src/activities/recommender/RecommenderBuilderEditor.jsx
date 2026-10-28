import definition from './definition.js'
import { DEFAULT_MIN_RATED } from './recommender.js'
import {
  Field,
  InlineField,
  RowListEditor,
  ValidationMessages,
  nextItemId,
  readNumber,
  useActivityValidation,
} from '../ui/builderKit.jsx'

// Builder editor for Recommender tasks: the items (emoji, label, group), the two switches
// (Why? button, bubble meter) and how many the student must rate. validateTask messages show
// under the item they are about. Controls are at least 44px.

export default function RecommenderBuilderEditor({ task, onUpdate }) {
  const validation = useActivityValidation(definition, task)
  const items = task.items ?? []

  function setFlag(key, value) {
    onUpdate({ ...task, [key]: value })
  }

  return (
    <div className="te-act-editor" data-activity-editor="recommender">
      <ValidationMessages messages={validation.general} />

      <Field
        label="Rate at least"
        hint={`How many items the student must rate before the task can pass. Blank means ${DEFAULT_MIN_RATED}.`}
      >
        <input
          className="te-input te-act-narrow"
          type="number"
          min="1"
          max={items.length || undefined}
          step="1"
          value={task.minRated ?? ''}
          aria-label="Minimum rated"
          onChange={(e) => {
            const value = readNumber(e.target.value)
            const { minRated: _drop, ...rest } = task
            onUpdate(value == null ? rest : { ...rest, minRated: value })
          }}
        />
      </Field>

      <label className="te-act-inline">
        <input
          type="checkbox"
          checked={task.showWhy !== false}
          aria-label="Show Why? buttons"
          onChange={(e) => setFlag('showWhy', e.target.checked)}
        />
        <span>Why? button on each recommendation</span>
      </label>
      <label className="te-act-inline">
        <input
          type="checkbox"
          checked={task.bubble === true}
          aria-label="Show the bubble meter"
          onChange={(e) => setFlag('bubble', e.target.checked)}
        />
        <span>Bubble meter under the feed</span>
      </label>

      <RowListEditor
        label="Items"
        hint="12 to 20 things to rate, in 3 to 5 groups (kinds)"
        rows={task.items}
        validation={validation}
        movable
        min={1}
        addLabel="+ Add item"
        onChange={(next) => onUpdate({ ...task, items: next })}
        makeRow={(rows) => ({
          id: nextItemId(rows, 'i'),
          emoji: '',
          label: '',
          group: rows[rows.length - 1]?.group ?? '',
        })}
        renderRow={(item, update, index) => (
          <>
            <InlineField label="Emoji">
              <input
                className="te-input te-act-tap-input te-act-narrow"
                value={item.emoji ?? ''}
                aria-label={`Item ${index + 1} emoji`}
                onChange={(e) => update({ emoji: e.target.value })}
              />
            </InlineField>
            <InlineField label="Label">
              <input
                className="te-input te-act-tap-input"
                value={item.label ?? ''}
                aria-label={`Item ${index + 1} label`}
                onChange={(e) => update({ label: e.target.value })}
              />
            </InlineField>
            <InlineField label="Group">
              <input
                className="te-input te-act-tap-input"
                value={item.group ?? ''}
                placeholder="e.g. sport"
                aria-label={`Item ${index + 1} group`}
                onChange={(e) => update({ group: e.target.value })}
              />
            </InlineField>
          </>
        )}
      />
    </div>
  )
}
