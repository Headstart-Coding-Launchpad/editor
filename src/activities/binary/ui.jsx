import React, { useState } from 'react'
import ItemNav from '../ui/ItemNav.jsx'
import { DEFAULT_BITS, fromBits, gradeItem, placeValues } from './binary.js'

// Binary activity UI. State shape (see definition.js): { v, items: { [id]: { bits, carries } } }
// for make_number / to_binary / add, and { answer } for to_decimal. Toggling a bit is a
// discrete change; typing a decimal answer is continuous (only synced while watched).

const MODE_PROMPTS = {
  make_number: (item) => `Make the number ${item.target}`,
  to_binary: (item) => `Write ${item.target} in binary`,
  to_decimal: () => 'What is this binary number in decimal?',
  add: () => 'Add these two binary numbers',
}

function itemStateOf(state, item, bits, mode) {
  const saved = state?.items?.[item.id]
  if (mode === 'to_decimal') return { answer: saved?.answer ?? '' }
  return {
    bits:
      typeof saved?.bits === 'string' && saved.bits.length === bits ? saved.bits : '0'.repeat(bits),
    carries:
      typeof saved?.carries === 'string' && saved.carries.length === bits
        ? saved.carries
        : '0'.repeat(bits),
  }
}

function flip(bitString, index) {
  return (
    bitString.slice(0, index) + (bitString[index] === '1' ? '0' : '1') + bitString.slice(index + 1)
  )
}

// Left/Right arrow keys move between the tiles of one row.
function moveFocus(event) {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  const row = event.currentTarget.closest('[data-bit-row]')
  const buttons = row ? [...row.querySelectorAll('button:not([disabled])')] : []
  const index = buttons.indexOf(event.currentTarget)
  const next = buttons[index + (event.key === 'ArrowRight' ? 1 : -1)]
  if (next) {
    event.preventDefault()
    next.focus()
  }
}

function BitRow({
  label,
  bits,
  places,
  showPlaceValues,
  onToggle,
  readOnly,
  small,
  testId,
  hideLast,
}) {
  return (
    <div className="act-row" style={{ alignItems: 'flex-end' }}>
      <span style={{ minWidth: 72, fontWeight: 600 }}>{label}</span>
      <div className="act-bits" data-bit-row={testId} role="group" aria-label={label}>
        {[...bits].map((bit, index) => {
          const place = places[index]
          if (hideLast && index === bits.length - 1) {
            return <span key={index} aria-hidden="true" />
          }
          const on = bit === '1'
          return (
            <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {showPlaceValues && <span className="act-bit-place">{place}</span>}
              {onToggle ? (
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={`${label} ${place} column`}
                  className={`act-bit${small ? ' act-bit--small' : ''}`}
                  disabled={readOnly}
                  onClick={() => onToggle(index)}
                  onKeyDown={moveFocus}
                  data-testid={`${testId}-bit-${index}`}
                >
                  {bit}
                </button>
              ) : (
                <span
                  className={`act-bit act-bit--static${small ? ' act-bit--small' : ''}`}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                  aria-label={`${place} column: ${bit}`}
                >
                  {bit}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function BinaryStudentView({ task, state, onChange, onSubmit, readOnly = false }) {
  const bits = task?.bits ?? DEFAULT_BITS
  const mode = task?.mode ?? 'make_number'
  const items = task?.items ?? []
  const places = placeValues(bits)
  const showPlaceValues = task?.showPlaceValues !== false
  // make_number shows the running total (that is the exercise); to_binary hides it so the
  // student converts rather than searches. Authors can override with showDecimal.
  const showDecimal =
    typeof task?.showDecimal === 'boolean' ? task.showDecimal : mode === 'make_number'
  const [index, setIndex] = useState(0)
  // Results captured when Check was pressed: { [itemId]: { correct, hint } }. An item's result
  // is cleared as soon as the student changes it, so marks never grade work live.
  const [results, setResults] = useState({})
  const current = items[Math.min(index, items.length - 1)]
  if (!current) return <p>This binary task has no questions yet.</p>
  const itemState = itemStateOf(state, current, bits, mode)
  const liveResult = readOnly ? gradeItem(task, current, itemState) : results[current.id]

  function update(patch) {
    if (readOnly) return
    setResults((prev) => {
      if (!(current.id in prev)) return prev
      const { [current.id]: _dropped, ...rest } = prev
      return rest
    })
    onChange?.((prev) => ({
      ...(prev ?? { v: 1 }),
      items: {
        ...(prev?.items ?? {}),
        [current.id]: { ...itemStateOf(prev, current, bits, mode), ...patch },
      },
    }))
  }

  async function handleCheck() {
    const outcome = await onSubmit?.()
    const next = {}
    for (const item of items) {
      next[item.id] = gradeItem(task, item, itemStateOf(state, item, bits, mode))
    }
    setResults(next)
    if (!outcome?.passed) {
      const firstWrong = items.findIndex((item) => !next[item.id]?.correct)
      if (firstWrong >= 0) setIndex(firstWrong)
    }
  }

  const statusFor = (item) => {
    const result = readOnly
      ? gradeItem(task, item, itemStateOf(state, item, bits, mode))
      : results[item.id]
    if (!result) return null
    return result.correct ? 'done' : 'wrong'
  }

  const value = fromBits(itemState.bits ?? '') ?? 0

  return (
    <div className="act-panel" data-testid="binary-activity">
      <ItemNav items={items} currentIndex={index} onSelect={setIndex} statusFor={statusFor} />
      <p className="act-prompt">{MODE_PROMPTS[mode]?.(current) ?? 'Binary'}</p>

      {mode === 'to_decimal' ? (
        <>
          <BitRow
            label="Binary"
            bits={String(current.value ?? '')}
            places={placeValues(String(current.value ?? '').length)}
            showPlaceValues={showPlaceValues}
            testId="value"
          />
          <label className="act-row">
            <span style={{ fontWeight: 600 }}>Decimal</span>
            <input
              className="act-number-input"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={itemState.answer}
              disabled={readOnly}
              aria-label="Your answer in decimal"
              onChange={(event) => update({ answer: event.target.value.replace(/[^\d]/g, '') })}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !readOnly) handleCheck()
              }}
            />
          </label>
        </>
      ) : mode === 'add' ? (
        <>
          <BitRow
            label="Carries"
            bits={itemState.carries}
            places={places}
            showPlaceValues={false}
            onToggle={(i) => update({ carries: flip(itemState.carries, i) })}
            readOnly={readOnly}
            small
            hideLast
            testId="carries"
          />
          <BitRow
            label=""
            bits={String(current.a ?? '')}
            places={places}
            showPlaceValues={showPlaceValues}
            testId="a"
          />
          <BitRow
            label="+"
            bits={String(current.b ?? '')}
            places={places}
            showPlaceValues={false}
            testId="b"
          />
          <BitRow
            label="Answer"
            bits={itemState.bits}
            places={places}
            showPlaceValues={false}
            onToggle={(i) => update({ bits: flip(itemState.bits, i) })}
            readOnly={readOnly}
            testId="answer"
          />
        </>
      ) : (
        <BitRow
          label="Bits"
          bits={itemState.bits}
          places={places}
          showPlaceValues={showPlaceValues}
          onToggle={(i) => update({ bits: flip(itemState.bits, i) })}
          readOnly={readOnly}
          testId="answer"
        />
      )}

      {showDecimal && mode !== 'to_decimal' && (
        <p aria-live="polite" style={{ fontSize: '1.1rem' }}>
          Your bits make <strong data-testid="live-decimal">{value}</strong>
        </p>
      )}

      {liveResult && !liveResult.correct && liveResult.hint && (
        <p className="act-hint" role="status">
          💡 {liveResult.hint}
        </p>
      )}
      {liveResult?.correct && (
        <p className="act-result act-result--pass" role="status">
          ✓ Correct
        </p>
      )}

      {!readOnly && (
        <div className="act-row">
          <button type="button" className="btn-primary act-btn" onClick={handleCheck}>
            Check answers
          </button>
        </div>
      )}
    </div>
  )
}

// One-line card summary text comes from definition.summarize; no custom card needed.
export default {
  StudentView: BinaryStudentView,
}
