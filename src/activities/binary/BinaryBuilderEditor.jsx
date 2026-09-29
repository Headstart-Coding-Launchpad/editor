import React from 'react'
import definition, { BINARY_MODE_LABELS } from './definition.js'
import {
  ASCII_CODE_FORMATS,
  ASCII_DIRECTIONS,
  BINARY_MODES,
  DEFAULT_BITS,
  HEX_BASES,
  MAX_BITS,
  MAX_PIXELS_SIDE,
  MIN_BITS,
  PIXEL_DIRECTIONS,
  toBits,
} from './binary.js'
import {
  Field,
  InlineField,
  RowListEditor,
  ValidationMessages,
  nextItemId,
  readNumber,
  useActivityValidation,
} from '../ui/builderKit.jsx'

// Builder editor for Binary tasks (plan step 2.4): mode, bits, display options and a per-mode
// items editor (with a small pixel-grid editor for `pixels`). Validation comes from the
// definition's validateTask and shows next to the field it is about.

const DEFAULT_PIXEL_SIDE = 5
const BIT_MODES = ['make_number', 'to_binary', 'to_decimal', 'add', 'overflow', 'hex']
const DECIMAL_TOGGLE_MODES = ['make_number', 'to_binary', 'add', 'overflow', 'hex']
const CARRY_MODES = ['add', 'overflow']

const bitsOf = (task) => (Number.isInteger(task?.bits) ? task.bits : DEFAULT_BITS)
const sideOf = (value) => (Number.isInteger(value) && value > 0 ? value : DEFAULT_PIXEL_SIDE)

function blankRows(width, height) {
  return Array.from({ length: height }, () => '0'.repeat(width))
}

// A valid starting item for a mode (keeps the id).
export function defaultBinaryItem(mode, task, id) {
  const bits = Math.min(Math.max(bitsOf(task), MIN_BITS), MAX_BITS)
  switch (mode) {
    case 'to_decimal':
      return { id, value: toBits(1, bits) }
    case 'add':
      return { id, a: toBits(1, bits), b: toBits(1, bits) }
    case 'overflow':
      return { id, a: '1'.repeat(bits), b: toBits(1, bits) }
    case 'hex':
      return { id, value: 'F', from: 'hex', to: 'binary' }
    case 'ascii':
      return { id, text: 'Hi', direction: 'encode' }
    case 'pixels':
      return {
        id,
        direction: 'draw',
        rows: blankRows(sideOf(task?.width), sideOf(task?.height)),
      }
    default:
      return { id, target: 1 }
  }
}

// Switching mode: keep the item ids, replace their fields with the new mode's defaults, and drop
// task options the new mode doesn't use.
export function changeBinaryMode(task, mode) {
  const next = { ...task, mode }
  if (mode === 'pixels') {
    next.width = sideOf(task.width)
    next.height = sideOf(task.height)
  } else {
    delete next.width
    delete next.height
  }
  if (mode !== 'ascii') {
    delete next.codeFormat
    delete next.showTable
  }
  if (!CARRY_MODES.includes(mode)) delete next.requireCarries
  if (!DECIMAL_TOGGLE_MODES.includes(mode)) delete next.showDecimal
  if (BIT_MODES.includes(mode)) next.bits = bitsOf(task)
  const ids = (task.items ?? []).map((item) => item?.id).filter((id) => id != null && id !== '')
  next.items = (ids.length ? ids : ['a']).map((id) => defaultBinaryItem(mode, next, id))
  return next
}

// Resize every pixel item's rows to width x height (new squares are empty).
export function resizePixelRows(task, width, height) {
  const items = (task.items ?? []).map((item) => {
    const rows = Array.isArray(item.rows) ? item.rows : []
    return {
      ...item,
      rows: Array.from({ length: height }, (_, r) =>
        String(rows[r] ?? '')
          .slice(0, width)
          .padEnd(width, '0')
      ),
    }
  })
  return { ...task, width, height, items }
}

function toggleCell(rows, r, c) {
  return rows.map((row, i) =>
    i === r ? `${row.slice(0, c)}${row[c] === '1' ? '0' : '1'}${row.slice(c + 1)}` : row
  )
}

export function PixelGridEditor({ rows, width, height, onChange, label }) {
  const grid = Array.from({ length: height }, (_, r) =>
    String(rows?.[r] ?? '')
      .slice(0, width)
      .padEnd(width, '0')
  )
  return (
    <div
      className="te-act-pixels"
      role="group"
      aria-label={label}
      style={{ gridTemplateColumns: `repeat(${width}, 22px)` }}
    >
      {grid.map((row, r) =>
        [...row].map((bit, c) => (
          <button
            key={`${r}-${c}`}
            type="button"
            className={bit === '1' ? 'te-act-pixel te-act-pixel--on' : 'te-act-pixel'}
            aria-pressed={bit === '1'}
            aria-label={`Row ${r + 1} square ${c + 1}`}
            onClick={() => onChange(toggleCell(grid, r, c))}
          />
        ))
      )}
    </div>
  )
}

function Select({ value, options, onChange, ariaLabel }) {
  return (
    <select
      className="te-select"
      value={value ?? ''}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

const words = (list) => list.map((value) => ({ value, label: value }))

function ItemFields({ task, item, update, index }) {
  const bits = bitsOf(task)
  const n = index + 1
  switch (task.mode) {
    case 'to_decimal':
      return (
        <InlineField label={`Value (${bits} bits)`} wide>
          <input
            className="te-input te-act-code"
            value={item.value ?? ''}
            aria-label={`Item ${n} value`}
            onChange={(e) => update({ value: e.target.value.trim() })}
          />
        </InlineField>
      )
    case 'add':
    case 'overflow':
      return (
        <>
          <InlineField label="a">
            <input
              className="te-input te-act-code"
              value={item.a ?? ''}
              aria-label={`Item ${n} a`}
              onChange={(e) => update({ a: e.target.value.trim() })}
            />
          </InlineField>
          <InlineField label="b">
            <input
              className="te-input te-act-code"
              value={item.b ?? ''}
              aria-label={`Item ${n} b`}
              onChange={(e) => update({ b: e.target.value.trim() })}
            />
          </InlineField>
        </>
      )
    case 'hex':
      return (
        <>
          <InlineField label="Value">
            <input
              className="te-input te-act-code"
              value={item.value ?? ''}
              aria-label={`Item ${n} value`}
              onChange={(e) => update({ value: e.target.value.trim() })}
            />
          </InlineField>
          <InlineField label="From">
            <Select
              value={item.from}
              options={words(HEX_BASES)}
              ariaLabel={`Item ${n} from`}
              onChange={(from) => update({ from })}
            />
          </InlineField>
          <InlineField label="To">
            <Select
              value={item.to}
              options={words(HEX_BASES)}
              ariaLabel={`Item ${n} to`}
              onChange={(to) => update({ to })}
            />
          </InlineField>
        </>
      )
    case 'ascii':
      return (
        <>
          <InlineField label="Text" wide>
            <input
              className="te-input"
              value={item.text ?? ''}
              aria-label={`Item ${n} text`}
              onChange={(e) => update({ text: e.target.value })}
            />
          </InlineField>
          <InlineField label="Direction">
            <Select
              value={item.direction}
              options={words(ASCII_DIRECTIONS)}
              ariaLabel={`Item ${n} direction`}
              onChange={(direction) => update({ direction })}
            />
          </InlineField>
        </>
      )
    case 'pixels': {
      const width = sideOf(task.width)
      const height = sideOf(task.height)
      return (
        <>
          <InlineField label="Direction">
            <Select
              value={item.direction}
              options={[
                { value: 'draw', label: 'draw (students fill squares)' },
                { value: 'encode', label: 'encode (students type the bits)' },
              ].filter((option) => PIXEL_DIRECTIONS.includes(option.value))}
              ariaLabel={`Item ${n} direction`}
              onChange={(direction) => update({ direction })}
            />
          </InlineField>
          <PixelGridEditor
            rows={item.rows}
            width={width}
            height={height}
            label={`Item ${n} picture`}
            onChange={(rows) => update({ rows })}
          />
        </>
      )
    }
    default:
      return (
        <InlineField label={`Target (0 to ${2 ** bits - 1})`}>
          <input
            className="te-input"
            type="number"
            min="0"
            max={2 ** bits - 1}
            step="1"
            value={item.target ?? ''}
            aria-label={`Item ${n} target`}
            onChange={(e) => update({ target: readNumber(e.target.value) })}
          />
        </InlineField>
      )
  }
}

function Toggle({ checked, onChange, children }) {
  return (
    <label className="te-check-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  )
}

export default function BinaryBuilderEditor({ task, onUpdate }) {
  const validation = useActivityValidation(definition, task)
  const mode = task.mode ?? 'make_number'
  const set = (patch) => onUpdate({ ...task, ...patch })
  const setOptional = (field, value) => {
    const next = { ...task }
    if (value === undefined) delete next[field]
    else next[field] = value
    onUpdate(next)
  }

  return (
    <div className="te-act-editor" data-activity-editor="binary">
      <ValidationMessages messages={validation.general} />

      <Field label="Mode">
        <select
          className="te-select"
          value={mode}
          aria-label="Binary mode"
          onChange={(e) => onUpdate(changeBinaryMode(task, e.target.value))}
        >
          {BINARY_MODES.map((value) => (
            <option key={value} value={value}>
              {BINARY_MODE_LABELS[value] ?? value}
            </option>
          ))}
        </select>
      </Field>

      {BIT_MODES.includes(mode) && (
        <Field label="Bits" hint={`${MIN_BITS} to ${MAX_BITS}`}>
          <input
            className="te-input te-act-narrow"
            type="number"
            min={MIN_BITS}
            max={MAX_BITS}
            step="1"
            value={task.bits ?? ''}
            aria-label="Bits"
            onChange={(e) => set({ bits: readNumber(e.target.value) })}
          />
        </Field>
      )}

      {mode === 'pixels' && (
        <Field label="Picture size" hint={`1 to ${MAX_PIXELS_SIDE} squares each way`}>
          <div className="te-act-inline-row">
            {['width', 'height'].map((side) => (
              <InlineField key={side} label={side === 'width' ? 'Width' : 'Height'}>
                <input
                  className="te-input te-act-narrow"
                  type="number"
                  min="1"
                  max={MAX_PIXELS_SIDE}
                  step="1"
                  value={task[side] ?? ''}
                  aria-label={side === 'width' ? 'Width' : 'Height'}
                  onChange={(e) => {
                    const value = readNumber(e.target.value)
                    const ok = Number.isInteger(value) && value >= 1 && value <= MAX_PIXELS_SIDE
                    if (!ok) {
                      set({ [side]: value })
                      return
                    }
                    const width = side === 'width' ? value : sideOf(task.width)
                    const height = side === 'height' ? value : sideOf(task.height)
                    onUpdate(resizePixelRows(task, width, height))
                  }}
                />
              </InlineField>
            ))}
          </div>
        </Field>
      )}

      <Field label="Display">
        <div className="te-act-inline-row">
          {mode !== 'ascii' && mode !== 'pixels' && (
            <Toggle
              checked={task.showPlaceValues !== false}
              onChange={(checked) => set({ showPlaceValues: checked })}
            >
              Show place values
            </Toggle>
          )}
          {DECIMAL_TOGGLE_MODES.includes(mode) && (
            <InlineField label="Running decimal">
              <select
                className="te-select"
                aria-label="Running decimal"
                value={
                  typeof task.showDecimal === 'boolean'
                    ? task.showDecimal
                      ? 'show'
                      : 'hide'
                    : 'default'
                }
                onChange={(e) =>
                  setOptional(
                    'showDecimal',
                    e.target.value === 'default' ? undefined : e.target.value === 'show'
                  )
                }
              >
                <option value="default">
                  Default ({mode === 'make_number' ? 'shown' : 'hidden'})
                </option>
                <option value="show">Show</option>
                <option value="hide">Hide</option>
              </select>
            </InlineField>
          )}
          {CARRY_MODES.includes(mode) && (
            <Toggle
              checked={task.requireCarries === true}
              onChange={(checked) => setOptional('requireCarries', checked ? true : undefined)}
            >
              Carries must be filled in
            </Toggle>
          )}
          {mode === 'ascii' && (
            <>
              <InlineField label="Codes">
                <select
                  className="te-select"
                  aria-label="Code format"
                  value={task.codeFormat ?? 'binary'}
                  onChange={(e) => set({ codeFormat: e.target.value })}
                >
                  {ASCII_CODE_FORMATS.map((value) => (
                    <option key={value} value={value}>
                      {value === 'binary' ? '8-bit binary' : 'decimal'}
                    </option>
                  ))}
                </select>
              </InlineField>
              <Toggle
                checked={task.showTable === true}
                onChange={(checked) => setOptional('showTable', checked ? true : undefined)}
              >
                Show ASCII table
              </Toggle>
            </>
          )}
        </div>
      </Field>

      <RowListEditor
        label="Items"
        hint="each needs a unique id"
        rows={task.items}
        validation={validation}
        onChange={(items) => set({ items })}
        makeRow={(items) => defaultBinaryItem(mode, task, nextItemId(items))}
        renderRow={(item, update, index) => (
          <ItemFields task={task} item={item} update={update} index={index} />
        )}
      />
    </div>
  )
}
