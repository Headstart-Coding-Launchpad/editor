import React from 'react'
import definition from './definition.js'
import { ITEM_KINDS, SIDES, sideLabel } from './real_or_ai.js'
import {
  Field,
  InlineField,
  RowListEditor,
  ValidationMessages,
  nextItemId,
  readNumber,
  useActivityValidation,
} from '../ui/builderKit.jsx'

// Builder editor for Real or AI tasks: the pairs (`items`: add, remove, reorder; kind, a, b, alt
// text, which side is AI, the tell shown after the tap, whether it is reliable, an optional extra
// note) and `coreItems`. validateTask messages show under the pair they are about. Controls are
// at least 44px.

const KIND_LABELS = { image: 'Pictures', text: 'Texts' }

function ItemFields({ item, update, index }) {
  const n = index + 1
  const kind = item.kind === 'text' ? 'text' : 'image'
  return (
    <>
      <InlineField label="Shows">
        <select
          className="te-select te-act-tap-input"
          value={kind}
          aria-label={`Item ${n} kind`}
          onChange={(e) => update({ kind: e.target.value })}
        >
          {ITEM_KINDS.map((value) => (
            <option key={value} value={value}>
              {KIND_LABELS[value]}
            </option>
          ))}
        </select>
      </InlineField>
      {SIDES.map((side) => (
        <InlineField key={side} label={`Side ${sideLabel(side)}`} wide>
          {kind === 'text' ? (
            <textarea
              className="te-input te-act-tap-input"
              rows={2}
              value={item[side] ?? ''}
              aria-label={`Item ${n} side ${sideLabel(side)} text`}
              onChange={(e) => update({ [side]: e.target.value })}
            />
          ) : (
            <input
              className="te-input te-act-tap-input"
              value={item[side] ?? ''}
              placeholder="Image URL or path"
              aria-label={`Item ${n} side ${sideLabel(side)} image`}
              onChange={(e) => update({ [side]: e.target.value })}
            />
          )}
        </InlineField>
      ))}
      {kind === 'image' &&
        SIDES.map((side) => {
          const key = side === 'a' ? 'altA' : 'altB'
          return (
            <InlineField key={key} label={`Alt text ${sideLabel(side)}`} wide>
              <input
                className="te-input te-act-tap-input"
                value={item[key] ?? ''}
                placeholder="Describe the picture, not whether it is AI"
                aria-label={`Item ${n} alt text ${sideLabel(side)}`}
                onChange={(e) => update({ [key]: e.target.value || undefined })}
              />
            </InlineField>
          )
        })}
      <InlineField label="AI is">
        <select
          className="te-select te-act-tap-input"
          value={item.answer ?? ''}
          aria-label={`Item ${n} answer`}
          onChange={(e) => update({ answer: e.target.value })}
        >
          {!SIDES.includes(item.answer) && <option value="">Choose...</option>}
          {SIDES.map((side) => (
            <option key={side} value={side}>
              Side {sideLabel(side)}
            </option>
          ))}
        </select>
      </InlineField>
      <InlineField label="Tell" wide>
        <input
          className="te-input te-act-tap-input"
          value={item.tell ?? ''}
          placeholder="The clue to look for, e.g. too smooth (shown after the tap)"
          aria-label={`Item ${n} tell`}
          onChange={(e) => update({ tell: e.target.value || undefined })}
        />
      </InlineField>
      <InlineField label="Tell is">
        <select
          className="te-select te-act-tap-input"
          value={item.reliable === true ? 'yes' : item.reliable === false ? 'no' : ''}
          aria-label={`Item ${n} tell is reliable`}
          onChange={(e) =>
            update({ reliable: e.target.value === '' ? undefined : e.target.value === 'yes' })
          }
        >
          <option value="">Not said</option>
          <option value="yes">Reliable</option>
          <option value="no">Not reliable on its own</option>
        </select>
      </InlineField>
      <InlineField label="Extra note" wide>
        <textarea
          className="te-input te-act-tap-input"
          rows={2}
          value={item.reveal ?? ''}
          placeholder="Optional. One more sentence shown under the tell"
          aria-label={`Item ${n} reveal text`}
          onChange={(e) => update({ reveal: e.target.value || undefined })}
        />
      </InlineField>
    </>
  )
}

export default function RealOrAiBuilderEditor({ task, onUpdate }) {
  const validation = useActivityValidation(definition, task)

  return (
    <div className="te-act-editor" data-activity-editor="real_or_ai">
      <ValidationMessages messages={validation.general} />

      <Field
        label="Core pairs (rest are bonus)"
        hint="How many make the round. The task passes at this many; later pairs are bonus. Blank means all."
      >
        <input
          className="te-input te-act-narrow"
          type="number"
          min="1"
          max={(task.items ?? []).length || undefined}
          step="1"
          value={task.coreItems ?? ''}
          aria-label="Core items"
          onChange={(e) => {
            const value = readNumber(e.target.value)
            const { coreItems: _drop, ...rest } = task
            onUpdate(value == null ? rest : { ...rest, coreItems: value })
          }}
        />
      </Field>

      <RowListEditor
        label="Pairs"
        hint="played one at a time, in order"
        rows={task.items}
        validation={validation}
        movable
        addLabel="+ Add pair"
        onChange={(items) => onUpdate({ ...task, items })}
        makeRow={(items) => ({
          id: nextItemId(items, 'p'),
          kind: items[items.length - 1]?.kind ?? 'image',
          a: '',
          b: '',
          answer: 'b',
        })}
        renderRow={(item, update, index) => (
          <ItemFields item={item} update={update} index={index} />
        )}
      />
    </div>
  )
}
