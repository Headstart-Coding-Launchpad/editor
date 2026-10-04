import React from 'react'
import { Field } from './BuilderField.jsx'

// Small building blocks for activity BuilderEditors (binary, keyboard, mouse...): validation
// shown next to the field it is about, and a list editor for `items` / `targets`. Builder
// styling uses the te- class namespace (src/index.css, "Activity editors").

export { Field }

// validateTask messages look like "Task 3: ...", "Task 3 item 2: ..." or "Task 3 target 1: ...".
const MESSAGE = /^Task [^:]*?(?: (item|target) (\d+))?: (.*)$/s

/**
 * Split a definition's `validateTask` result into task-level messages and per-row messages
 * (`rows['item:0']`, `rows['target:1']`, zero-based), with the "Task n ..." prefix removed.
 */
export function splitValidation(result) {
  const general = { errors: [], warnings: [] }
  const rows = {}
  for (const tone of ['errors', 'warnings']) {
    for (const message of result?.[tone] ?? []) {
      const match = MESSAGE.exec(String(message))
      if (match?.[1]) {
        const key = `${match[1]}:${Number(match[2]) - 1}`
        rows[key] ??= { errors: [], warnings: [] }
        rows[key][tone].push(match[3])
      } else {
        general[tone].push(match ? match[3] : String(message))
      }
    }
  }
  return { general, rows }
}

// Validation for the task being edited, split for inline display. `n` only feeds the prefix
// that splitValidation strips.
export function useActivityValidation(definition, task) {
  return React.useMemo(() => {
    try {
      return splitValidation(definition.validateTask(task, { n: 1 }))
    } catch {
      return splitValidation(null)
    }
  }, [definition, task])
}

/** Inline errors (red) and warnings (amber) for one field or row. */
export function ValidationMessages({ messages }) {
  const errors = messages?.errors ?? []
  const warnings = messages?.warnings ?? []
  if (errors.length === 0 && warnings.length === 0) return null
  return (
    <ul className="te-act-messages">
      {errors.map((text, i) => (
        <li key={`e${i}`} className="te-act-message te-act-message--error" role="alert">
          {text}
        </li>
      ))}
      {warnings.map((text, i) => (
        <li key={`w${i}`} className="te-act-message te-act-message--warning">
          {text}
        </li>
      ))}
    </ul>
  )
}

// Next free short id: a, b, ... z, then item-27, item-28 ...
export function nextItemId(items, prefix = '') {
  const used = new Set((items ?? []).map((item) => String(item?.id ?? '')))
  for (let i = 0; i < 26; i += 1) {
    const id = `${prefix}${String.fromCharCode(97 + i)}`
    if (!used.has(id)) return id
  }
  let n = (items?.length ?? 0) + 1
  while (used.has(`${prefix || 'item-'}${n}`)) n += 1
  return `${prefix || 'item-'}${n}`
}

/**
 * Editable list of rows (`items` or `targets`). Each row gets an id input, the fields from
 * `renderRow(row, update, index)`, a remove button (not below `min` rows) and its own
 * validation messages (`validation.rows['<kind>:<index>']`).
 */
export function RowListEditor({
  label,
  hint,
  kind = 'item',
  rows,
  onChange,
  makeRow,
  renderRow,
  validation,
  min = 1,
  addLabel = '+ Add item',
  onRenameId,
}) {
  const list = Array.isArray(rows) ? rows : []
  function update(index, patch) {
    onChange(list.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }
  return (
    <Field label={label} hint={hint}>
      <div className="te-act-rows">
        {list.map((row, index) => (
          <div key={index} className="te-act-row" data-row={`${kind}-${index + 1}`}>
            <div className="te-act-row__head">
              <span className="te-quiz-answer-badge">{index + 1}</span>
              <label className="te-act-inline">
                <span>id</span>
                <input
                  className="te-input te-act-id"
                  value={row?.id ?? ''}
                  aria-label={`${kind} ${index + 1} id`}
                  onChange={(e) => {
                    const id = e.target.value
                    if (onRenameId) onRenameId(index, row?.id, id)
                    else update(index, { id })
                  }}
                />
              </label>
              <button
                type="button"
                className="te-remove-btn"
                onClick={() => onChange(list.filter((_, i) => i !== index))}
                disabled={list.length <= min}
                title={`Remove ${kind}`}
                aria-label={`Remove ${kind} ${index + 1}`}
              >
                ✕
              </button>
            </div>
            <div className="te-act-row__fields">
              {renderRow(row ?? {}, (patch) => update(index, patch), index)}
            </div>
            <ValidationMessages messages={validation?.rows?.[`${kind}:${index}`]} />
          </div>
        ))}
        <button
          type="button"
          className="te-add-check-btn"
          onClick={() => onChange([...list, makeRow(list)])}
        >
          {addLabel}
        </button>
      </div>
    </Field>
  )
}

/** Labelled inline control inside a row. */
export function InlineField({ label, children, wide = false }) {
  return (
    <label className={wide ? 'te-act-inline te-act-inline--wide' : 'te-act-inline'}>
      <span>{label}</span>
      {children}
    </label>
  )
}

// Number input value → stored value: blank → undefined, otherwise a Number (validation reports
// anything that is not a whole number or out of range).
export function readNumber(value) {
  if (value === '' || value == null) return undefined
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

/** A row of radio-card buttons for a small set of mutually exclusive values. */
export function ChoiceCards({ value, options, onChange, ariaLabel }) {
  return (
    <div className="te-info-type-grid te-act-choices" role="radiogroup" aria-label={ariaLabel}>
      {options.map((option) => {
        const active = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            className={active ? 'te-info-type-btn te-info-type-btn--active' : 'te-info-type-btn'}
            onClick={() => onChange(option.value)}
          >
            <span className="te-info-type-label">{option.label}</span>
            {option.hint && <span className="te-info-type-hint">{option.hint}</span>}
          </button>
        )
      })}
    </div>
  )
}
