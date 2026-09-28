import React, { useState } from 'react'
import definition from './definition.js'
import { MOUSE_ACTIONS, TARGET_SIZES, TOUCH_POLICIES } from './mouse.js'
import {
  ChoiceCards,
  Field,
  InlineField,
  RowListEditor,
  ValidationMessages,
  nextItemId,
  readNumber,
  useActivityValidation,
} from '../ui/builderKit.jsx'

// Builder editor for Mouse tasks (plan step 2.4): the touch-screen policy, the stage targets
// (with a placement preview: pick a target, then click the stage to move it) and the list of
// actions. validateTask messages show under the target or item they are about.

const TOUCH_OPTIONS = {
  equivalent: { label: 'Touch counts', hint: 'Tap, double-tap, hold… (hover skipped)' },
  skip: { label: 'Skip hover', hint: 'Same, without the hover warning' },
  block: { label: 'Needs a mouse', hint: 'Touch screens see a notice' },
}

const ACTION_LABELS = {
  click: 'Click',
  double_click: 'Double-click',
  right_click: 'Right-click',
  drag: 'Drag to…',
  scroll: 'Scroll',
  hover: 'Hover',
}

const round = (value) => Math.round(Math.min(1, Math.max(0, value)) * 100) / 100

// Renaming a target keeps the items that point at it.
export function renameMouseTarget(task, index, oldId, newId) {
  const targets = (task.targets ?? []).map((target, i) =>
    i === index ? { ...target, id: newId } : target
  )
  const stillUsed = targets.some((target, i) => i !== index && target.id === oldId)
  const items = stillUsed
    ? task.items
    : (task.items ?? []).map((item) => ({
        ...item,
        ...(item.target === oldId ? { target: newId } : {}),
        ...(item.to === oldId ? { to: newId } : {}),
      }))
  return { ...task, targets, items }
}

function nextTarget(targets) {
  const used = new Set((targets ?? []).map((target) => target?.id))
  let n = (targets?.length ?? 0) + 1
  while (used.has(`target${n}`)) n += 1
  const id = `target${n}`
  return { id, label: id, emoji: '⭐', x: 0.5, y: 0.5, size: 'large' }
}

export function PlacementPreview({ targets, selected, onSelect, onPlace }) {
  function handleStageClick(event) {
    if (selected == null) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    onPlace(
      selected,
      round((event.clientX - rect.left) / rect.width),
      round((event.clientY - rect.top) / rect.height)
    )
  }
  return (
    <div className="te-act-stage-wrap">
      <div
        className="te-act-stage"
        data-testid="mouse-placement-preview"
        onClick={handleStageClick}
        aria-label="Stage preview"
        role="group"
      >
        {(targets ?? []).map((target, index) => (
          <button
            key={index}
            type="button"
            className={
              index === selected
                ? `te-act-stage-target te-act-stage-target--${target.size ?? 'large'} te-act-stage-target--selected`
                : `te-act-stage-target te-act-stage-target--${target.size ?? 'large'}`
            }
            style={{ left: `${(target.x ?? 0.5) * 100}%`, top: `${(target.y ?? 0.5) * 100}%` }}
            aria-pressed={index === selected}
            aria-label={`Select ${target.label || target.id || `target ${index + 1}`} to move it`}
            onClick={(event) => {
              event.stopPropagation()
              onSelect(index === selected ? null : index)
            }}
          >
            <span aria-hidden="true">{target.emoji || '●'}</span>
            <span className="te-act-stage-label">{target.label || target.id}</span>
          </button>
        ))}
      </div>
      <span className="te-act-note">
        {selected == null
          ? 'Select a target, then click the stage to move it.'
          : 'Click the stage to move the selected target.'}
      </span>
    </div>
  )
}

function TargetFields({ target, update, index }) {
  const n = index + 1
  return (
    <>
      <InlineField label="Label">
        <input
          className="te-input"
          value={target.label ?? ''}
          aria-label={`Target ${n} label`}
          onChange={(e) => update({ label: e.target.value || undefined })}
        />
      </InlineField>
      <InlineField label="Emoji">
        <input
          className="te-input te-act-narrow"
          value={target.emoji ?? ''}
          aria-label={`Target ${n} emoji`}
          onChange={(e) => update({ emoji: e.target.value || undefined })}
        />
      </InlineField>
      {['x', 'y'].map((axis) => (
        <InlineField key={axis} label={axis}>
          <input
            className="te-input te-act-narrow"
            type="number"
            min="0"
            max="1"
            step="0.05"
            value={target[axis] ?? ''}
            aria-label={`Target ${n} ${axis}`}
            onChange={(e) => update({ [axis]: readNumber(e.target.value) })}
          />
        </InlineField>
      ))}
      <InlineField label="Size">
        <select
          className="te-select"
          value={target.size ?? 'large'}
          aria-label={`Target ${n} size`}
          onChange={(e) => update({ size: e.target.value })}
        >
          {TARGET_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </InlineField>
    </>
  )
}

function TargetSelect({ value, targets, onChange, ariaLabel }) {
  const ids = (targets ?? []).map((target) => target.id).filter(Boolean)
  return (
    <select
      className="te-select"
      value={value ?? ''}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
    >
      {!ids.includes(value) && (
        <option value={value ?? ''}>{value ? `${value} (missing)` : '—'}</option>
      )}
      {(targets ?? []).map((target, i) =>
        target.id ? (
          <option key={`${target.id}-${i}`} value={target.id}>
            {target.emoji ? `${target.emoji} ` : ''}
            {target.label || target.id}
          </option>
        ) : null
      )}
    </select>
  )
}

function ItemFields({ task, item, update, index }) {
  const n = index + 1
  return (
    <>
      <InlineField label="Action">
        <select
          className="te-select"
          value={item.action ?? 'click'}
          aria-label={`Item ${n} action`}
          onChange={(e) => {
            const action = e.target.value
            update(
              action === 'drag'
                ? { action, to: item.to ?? task.targets?.find((t) => t.id !== item.target)?.id }
                : { action, to: undefined }
            )
          }}
        >
          {MOUSE_ACTIONS.map((action) => (
            <option key={action} value={action}>
              {ACTION_LABELS[action] ?? action}
            </option>
          ))}
        </select>
      </InlineField>
      <InlineField label="Target">
        <TargetSelect
          value={item.target}
          targets={task.targets}
          ariaLabel={`Item ${n} target`}
          onChange={(target) => update({ target })}
        />
      </InlineField>
      {item.action === 'drag' && (
        <InlineField label="To">
          <TargetSelect
            value={item.to}
            targets={task.targets}
            ariaLabel={`Item ${n} drop target`}
            onChange={(to) => update({ to })}
          />
        </InlineField>
      )}
      <InlineField label="Prompt" wide>
        <input
          className="te-input"
          value={item.prompt ?? ''}
          placeholder="Optional: replaces the generated instruction"
          aria-label={`Item ${n} prompt`}
          onChange={(e) => update({ prompt: e.target.value || undefined })}
        />
      </InlineField>
    </>
  )
}

export default function MouseBuilderEditor({ task, onUpdate }) {
  const validation = useActivityValidation(definition, task)
  const [selected, setSelected] = useState(null)
  const targets = task.targets ?? []

  function placeTarget(index, x, y) {
    onUpdate({
      ...task,
      targets: targets.map((target, i) => (i === index ? { ...target, x, y } : target)),
    })
  }

  return (
    <div className="te-act-editor" data-activity-editor="mouse">
      <ValidationMessages messages={validation.general} />

      <Field label="On a touch screen">
        <ChoiceCards
          ariaLabel="Touch screen policy"
          value={task.touch ?? 'equivalent'}
          options={TOUCH_POLICIES.map((value) => ({ value, ...TOUCH_OPTIONS[value] }))}
          onChange={(touch) => onUpdate({ ...task, touch })}
        />
      </Field>

      <Field label="Stage">
        <PlacementPreview
          targets={targets}
          selected={selected != null && selected < targets.length ? selected : null}
          onSelect={setSelected}
          onPlace={placeTarget}
        />
      </Field>

      <RowListEditor
        label="Targets"
        hint="x and y are fractions of the stage, 0 to 1"
        kind="target"
        rows={targets}
        validation={validation}
        addLabel="+ Add target"
        onChange={(next) => {
          setSelected(null)
          onUpdate({ ...task, targets: next })
        }}
        onRenameId={(index, oldId, newId) => onUpdate(renameMouseTarget(task, index, oldId, newId))}
        makeRow={nextTarget}
        renderRow={(target, update, index) => (
          <TargetFields target={target} update={update} index={index} />
        )}
      />

      <RowListEditor
        label="Items"
        hint="done one at a time, in order"
        rows={task.items}
        validation={validation}
        onChange={(items) => onUpdate({ ...task, items })}
        makeRow={(items) => ({
          id: nextItemId(items),
          action: 'click',
          target: targets[0]?.id ?? '',
        })}
        renderRow={(item, update, index) => (
          <ItemFields task={task} item={item} update={update} index={index} />
        )}
      />
    </div>
  )
}
