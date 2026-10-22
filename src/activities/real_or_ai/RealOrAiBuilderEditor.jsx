import React from 'react'
import definition from './definition.js'
import { ITEM_KINDS, SIDES, sideLabel, tellLabel } from './real_or_ai.js'
import {
  Field,
  InlineField,
  RowListEditor,
  ValidationMessages,
  nextItemId,
  useActivityValidation,
} from '../ui/builderKit.jsx'

// Builder editor for Real or AI tasks: the list of clues (`tells`: add, remove, rename) and the
// pairs (`items`: add, remove, reorder; kind, a, b, alt text, which side is AI, the clue,
// whether it is reliable, the reveal text). validateTask messages show under the pair they are
// about. Controls are at least 44px.

const KIND_LABELS = { image: 'Pictures', text: 'Texts' }

// Renaming a clue keeps the pairs that point at it.
export function renameTell(task, index, newTell) {
  const tells = [...(task.tells ?? [])]
  const oldTell = tells[index]
  tells[index] = newTell
  const stillUsed = tells.some((tell, i) => i !== index && tell === oldTell)
  const items = stillUsed
    ? task.items
    : (task.items ?? []).map((item) => (item.tell === oldTell ? { ...item, tell: newTell } : item))
  return { ...task, tells, items }
}

function nextTell(tells) {
  const used = new Set(tells ?? [])
  let n = (tells?.length ?? 0) + 1
  while (used.has(`clue_${n}`)) n += 1
  return `clue_${n}`
}

function ItemFields({ task, item, update, index }) {
  const n = index + 1
  const kind = item.kind === 'text' ? 'text' : 'image'
  const tells = task.tells ?? []
  const tellKnown = tells.includes(item.tell)
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
      <InlineField label="Clue">
        <select
          className="te-select te-act-tap-input"
          value={item.tell ?? ''}
          aria-label={`Item ${n} clue`}
          onChange={(e) => update({ tell: e.target.value })}
        >
          {!tellKnown && (
            <option value={item.tell ?? ''}>{item.tell ? `${item.tell} (missing)` : '—'}</option>
          )}
          {tells.map((tell, i) => (
            <option key={`${tell}-${i}`} value={tell}>
              {tellLabel(tell)}
            </option>
          ))}
        </select>
      </InlineField>
      <label className="te-act-inline">
        <input
          type="checkbox"
          checked={item.reliable === true}
          aria-label={`Item ${n} clue is reliable`}
          onChange={(e) => update({ reliable: e.target.checked })}
        />
        <span>Clue can be trusted on its own</span>
      </label>
      <InlineField label="Reveal" wide>
        <textarea
          className="te-input te-act-tap-input"
          rows={2}
          value={item.reveal ?? ''}
          placeholder="Shown after the student reveals the pair"
          aria-label={`Item ${n} reveal text`}
          onChange={(e) => update({ reveal: e.target.value })}
        />
      </InlineField>
    </>
  )
}

export default function RealOrAiBuilderEditor({ task, onUpdate }) {
  const validation = useActivityValidation(definition, task)
  const tells = task.tells ?? []

  return (
    <div className="te-act-editor" data-activity-editor="real_or_ai">
      <ValidationMessages messages={validation.general} />

      <Field label="Clues" hint="the 'tells' the student chooses from (at least two)">
        <div className="te-act-rows">
          {tells.map((tell, index) => (
            <div key={index} className="te-act-row" data-row={`tell-${index + 1}`}>
              <div className="te-act-row__head">
                <span className="te-quiz-answer-badge">{index + 1}</span>
                <input
                  className="te-input te-act-tap-input"
                  value={tell}
                  aria-label={`Clue ${index + 1}`}
                  onChange={(e) => onUpdate(renameTell(task, index, e.target.value))}
                />
                <button
                  type="button"
                  className="te-remove-btn te-act-tap"
                  onClick={() => onUpdate({ ...task, tells: tells.filter((_, i) => i !== index) })}
                  aria-label={`Remove clue ${index + 1}`}
                  title="Remove clue"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="te-add-check-btn te-act-tap"
            onClick={() => onUpdate({ ...task, tells: [...tells, nextTell(tells)] })}
          >
            + Add clue
          </button>
        </div>
      </Field>

      <RowListEditor
        label="Pairs"
        hint="done one at a time, in order"
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
          tell: tells[0] ?? '',
          reliable: false,
          reveal: '',
        })}
        renderRow={(item, update, index) => (
          <ItemFields task={task} item={item} update={update} index={index} />
        )}
      />
    </div>
  )
}
