import React, { useState } from 'react'
import ItemNav from '../ui/ItemNav.jsx'
import {
  ASCII_MAX_TEXT,
  DEFAULT_BITS,
  asciiCode,
  asciiTable,
  charName,
  fromBits,
  gradeItem,
  placeValues,
} from './binary.js'
import { emptyItemState } from './definition.js'
import BinaryBuilderEditor from './BinaryBuilderEditor.jsx'

// Binary activity UI. State shape (see definition.js): { v, items: { [id]: { bits, carries } } }
// for make_number / to_binary / add, and { answer } for to_decimal. The follow-up modes add
// { bits, carries, overflow } (overflow), { bits } or { answer } (hex), { codes } or
// { answer } (ascii) and { cells } or { rows } (pixels). Toggling a bit, a pixel or yes/no is a
// discrete change; typing is continuous (only synced while watched).

const NEW_MODES = ['overflow', 'hex', 'ascii', 'pixels']
const BASE_NAMES = { binary: 'binary', hex: 'hex', decimal: 'decimal' }

const MODE_PROMPTS = {
  make_number: (item) => `Make the number ${item.target}`,
  to_binary: (item) => `Write ${item.target} in binary`,
  to_decimal: () => 'What is this binary number in decimal?',
  add: () => 'Add these two binary numbers',
  overflow: () => 'Add these two binary numbers. Did it overflow?',
  hex: (item) =>
    `Change this ${BASE_NAMES[item.from] ?? ''} number to ${BASE_NAMES[item.to] ?? ''}`,
  ascii: (item) =>
    item.direction === 'decode'
      ? 'Decode these ASCII codes into text'
      : 'Write the ASCII code for each character',
  pixels: (item) =>
    item.direction === 'encode'
      ? 'Write the bits for each row of the picture (1 = filled)'
      : 'Draw the picture: fill the squares that are 1',
}

const isStr = (value) => typeof value === 'string'

// Saved state for one item of a follow-up mode, repaired to the shape the item needs.
function newModeItemState(saved, item, task, bits) {
  const empty = emptyItemState(task, item)
  const out = {}
  for (const [key, blank] of Object.entries(empty)) {
    const value = saved?.[key]
    if (key === 'carries') {
      out.carries = isStr(value) && value.length === bits ? value : '0'.repeat(bits)
    } else if (key === 'overflow') {
      out.overflow = value === 'yes' || value === 'no' ? value : ''
    } else if (Array.isArray(blank)) {
      out[key] = blank.map((cell, i) =>
        isStr(value?.[i]) && (key !== 'cells' || value[i].length === cell.length) ? value[i] : cell
      )
    } else {
      out[key] = isStr(value) && (key !== 'bits' || value.length === blank.length) ? value : blank
    }
  }
  return out
}

function itemStateOf(state, item, task) {
  const bits = task?.bits ?? DEFAULT_BITS
  const mode = task?.mode ?? 'make_number'
  const saved = state?.items?.[item.id]
  if (NEW_MODES.includes(mode)) return newModeItemState(saved, item, task, bits)
  if (mode === 'to_decimal') return { answer: saved?.answer ?? '' }
  return {
    bits:
      typeof saved?.bits === 'string' && saved.bits.length === bits ? saved.bits : '0'.repeat(bits),
    // Only addition uses the carry row; other modes keep whatever was stored ('' initially).
    carries:
      mode !== 'add'
        ? (saved?.carries ?? '')
        : typeof saved?.carries === 'string' && saved.carries.length === bits
          ? saved.carries
          : '0'.repeat(bits),
  }
}

function flip(bitString, index) {
  return (
    bitString.slice(0, index) + (bitString[index] === '1' ? '0' : '1') + bitString.slice(index + 1)
  )
}

const replaceAt = (list, index, value) => list.map((entry, i) => (i === index ? value : entry))

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
  nibbles,
}) {
  return (
    <div className="act-row" style={{ alignItems: 'flex-end' }}>
      <span style={{ minWidth: 72, fontWeight: 600 }}>{label}</span>
      <div className="act-bits" data-bit-row={testId} role="group" aria-label={label}>
        {[...bits].map((bit, index) => {
          const place = places[index]
          // Hex work groups the bits in fours (nibbles), counted from the right.
          const nibbleGap =
            nibbles && index > 0 && (bits.length - index) % 4 === 0 ? { marginLeft: 12 } : null
          if (hideLast && index === bits.length - 1) {
            return <span key={index} aria-hidden="true" />
          }
          const on = bit === '1'
          return (
            <div
              key={index}
              style={{ display: 'flex', flexDirection: 'column', gap: 2, ...nibbleGap }}
              data-nibble-start={nibbleGap ? 'true' : undefined}
            >
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

// A labelled text box for typed answers. Enter checks, like the to_decimal box.
function AnswerInput({ label, value, onValue, readOnly, onEnter, filter, maxLength, ...rest }) {
  return (
    <input
      className="act-number-input"
      type="text"
      autoComplete="off"
      spellCheck={false}
      value={value}
      disabled={readOnly}
      aria-label={label}
      maxLength={maxLength}
      onChange={(event) => onValue(event.target.value.replace(filter, '').slice(0, maxLength))}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && !readOnly) onEnter?.()
      }}
      {...rest}
    />
  )
}

function OverflowQuestion({ value, onAnswer, readOnly }) {
  return (
    <div className="act-row" role="group" aria-label="Did it overflow?">
      <span style={{ fontWeight: 600 }}>Did it overflow?</span>
      {['yes', 'no'].map((choice) => (
        <button
          key={choice}
          type="button"
          className={`${value === choice ? 'btn-primary' : 'btn-ghost-outline'} act-btn`}
          aria-pressed={value === choice}
          disabled={readOnly}
          onClick={() => onAnswer(value === choice ? '' : choice)}
        >
          {choice === 'yes' ? 'Yes' : 'No'}
        </button>
      ))}
    </div>
  )
}

function HexValue({ item, bits, showPlaceValues }) {
  const value = String(item.value ?? '').trim()
  if (item.from === 'binary') {
    return (
      <BitRow
        label="Binary"
        bits={value}
        places={placeValues(value.length)}
        showPlaceValues={showPlaceValues}
        testId="value"
        nibbles
      />
    )
  }
  return (
    <p className="act-row" style={{ fontSize: '1.5rem' }}>
      <span style={{ fontWeight: 600, fontSize: '1rem', minWidth: 72 }}>
        {item.from === 'hex' ? 'Hex' : 'Decimal'}
      </span>
      <strong style={{ fontFamily: 'var(--font-code)' }} data-testid="hex-value">
        {item.from === 'hex' ? value.toUpperCase() : value}
      </strong>
      <span className="act-bit-place">
        ({bits} bits{item.from === 'hex' ? ` = ${Math.ceil(bits / 4)} hex digits max` : ''})
      </span>
    </p>
  )
}

function AsciiTable({ format }) {
  return (
    <details className="act-ascii-table">
      <summary className="act-btn" style={{ display: 'inline-flex', alignItems: 'center' }}>
        ASCII table
      </summary>
      <div
        role="list"
        aria-label="ASCII table"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: 4,
          maxHeight: 260,
          overflow: 'auto',
          fontFamily: 'var(--font-code)',
          fontSize: '0.9rem',
          padding: 4,
        }}
      >
        {asciiTable().map(({ char, code, binary }) => (
          <span role="listitem" key={code}>
            <strong>{char === ' ' ? '␣' : char}</strong> {code}
            {format === 'binary' ? ` ${binary}` : ''}
          </span>
        ))}
      </div>
    </details>
  )
}

// Arrow keys move around the pixel grid; Space / Enter toggle (native button behaviour).
function moveInGrid(event) {
  const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }
  const move = moves[event.key]
  if (!move) return
  const grid = event.currentTarget.closest('[data-pixel-grid]')
  const row = Number(event.currentTarget.dataset.row) + move[0]
  const col = Number(event.currentTarget.dataset.col) + move[1]
  const next = grid?.querySelector(`[data-row="${row}"][data-col="${col}"]`)
  if (next) {
    event.preventDefault()
    next.focus()
  }
}

const CELL = 44

function PixelGrid({ rows, onToggle, readOnly, label }) {
  const width = rows[0]?.length ?? 0
  return (
    <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
      <div
        role="group"
        aria-label={label}
        data-pixel-grid="true"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${width}, ${CELL}px)`,
          gap: 2,
          width: 'max-content',
        }}
      >
        {rows.flatMap((row, r) =>
          [...row].map((bit, c) => {
            const on = bit === '1'
            const name = `Row ${r + 1}, column ${c + 1}`
            return onToggle ? (
              <button
                key={`${r}-${c}`}
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={name}
                className="act-bit"
                style={{ minWidth: CELL, minHeight: CELL, width: CELL, height: CELL, padding: 0 }}
                disabled={readOnly}
                data-row={r}
                data-col={c}
                onClick={() => onToggle(r, c)}
                onKeyDown={moveInGrid}
              />
            ) : (
              <span
                key={`${r}-${c}`}
                role="img"
                aria-label={`${name}: ${on ? 'filled' : 'empty'}`}
                style={{
                  width: CELL,
                  height: CELL,
                  borderRadius: 4,
                  border: '2px solid var(--ui-border-strong)',
                  background: on ? 'var(--colour-ink-strong)' : 'var(--ui-surface)',
                }}
              />
            )
          })
        )}
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
  // Results captured when Check was pressed: { [itemId]: { correct, hint, snapshot } }. A result
  // only shows while the item and the student's entry still match its snapshot, so marks never
  // grade work live and vanish when anything changes it (an edit, a teacher reset, Start again,
  // or the author editing the answer).
  const [results, setResults] = useState({})
  const current = items[Math.min(index, items.length - 1)]
  if (!current) return <p>This binary task has no questions yet.</p>
  const itemState = itemStateOf(state, current, task)
  const snapshotOf = (item) => JSON.stringify([item, itemStateOf(state, item, task)])
  const checkedResult = (item) => {
    const result = results[item.id]
    return result && result.snapshot === snapshotOf(item) ? result : undefined
  }
  const liveResult = readOnly ? gradeItem(task, current, itemState) : checkedResult(current)

  function update(patch) {
    if (readOnly) return
    onChange?.((prev) => ({
      ...(prev ?? { v: 1 }),
      items: {
        ...(prev?.items ?? {}),
        [current.id]: { ...itemStateOf(prev, current, task), ...patch },
      },
    }))
  }

  async function handleCheck() {
    const outcome = await onSubmit?.()
    const next = {}
    for (const item of items) {
      next[item.id] = {
        ...gradeItem(task, item, itemStateOf(state, item, task)),
        snapshot: snapshotOf(item),
      }
    }
    setResults(next)
    if (!outcome?.passed) {
      const firstWrong = items.findIndex((item) => !next[item.id]?.correct)
      if (firstWrong >= 0) setIndex(firstWrong)
    }
  }

  const statusFor = (item) => {
    const result = readOnly
      ? gradeItem(task, item, itemStateOf(state, item, task))
      : checkedResult(item)
    if (!result) return null
    return result.correct ? 'done' : 'wrong'
  }

  const value = fromBits(itemState.bits ?? '') ?? 0
  const codeFormat = task?.codeFormat ?? 'binary'

  function renderAddition() {
    return (
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
    )
  }

  function renderHex() {
    return (
      <>
        <HexValue item={current} bits={bits} showPlaceValues={showPlaceValues} />
        {current.to === 'binary' ? (
          <BitRow
            label="Binary"
            bits={itemState.bits}
            places={places}
            showPlaceValues={showPlaceValues}
            onToggle={(i) => update({ bits: flip(itemState.bits, i) })}
            readOnly={readOnly}
            testId="answer"
            nibbles
          />
        ) : (
          <label className="act-row">
            <span style={{ fontWeight: 600, minWidth: 72 }}>
              {current.to === 'hex' ? 'Hex' : 'Decimal'}
            </span>
            <AnswerInput
              label={`Your answer in ${current.to === 'hex' ? 'hex' : 'decimal'}`}
              value={itemState.answer}
              onValue={(answer) => update({ answer })}
              readOnly={readOnly}
              onEnter={handleCheck}
              filter={current.to === 'hex' ? /[^0-9a-fA-FxX]/g : /[^\d]/g}
              maxLength={current.to === 'hex' ? 8 : 6}
              inputMode={current.to === 'hex' ? 'text' : 'numeric'}
              autoCapitalize={current.to === 'hex' ? 'characters' : undefined}
            />
          </label>
        )}
      </>
    )
  }

  function renderAscii() {
    const text = String(current.text ?? '')
    if (current.direction === 'decode') {
      return (
        <>
          <div className="act-row" role="list" aria-label="Codes">
            {[...text].map((ch, i) => (
              <code
                role="listitem"
                key={i}
                className="act-bit act-bit--static act-bit--small"
                style={{ display: 'inline-flex', alignItems: 'center', padding: '0 8px' }}
              >
                {asciiCode(ch, codeFormat)}
              </code>
            ))}
          </div>
          <label className="act-row">
            <span style={{ fontWeight: 600, minWidth: 72 }}>Text</span>
            <AnswerInput
              label="Your decoded text"
              value={itemState.answer}
              onValue={(answer) => update({ answer })}
              readOnly={readOnly}
              onEnter={handleCheck}
              filter={/[^\x20-\x7e]/g}
              maxLength={ASCII_MAX_TEXT + 4}
              style={{ width: '16em' }}
            />
          </label>
        </>
      )
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[...text].map((ch, i) => (
          <label className="act-row" key={i}>
            <span
              className="act-bit act-bit--static act-bit--small"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
              aria-hidden="true"
            >
              {ch === ' ' ? '␣' : ch}
            </span>
            <AnswerInput
              label={`Code for character ${i + 1}, ${charName(ch)}`}
              value={itemState.codes[i] ?? ''}
              onValue={(code) => update({ codes: replaceAt(itemState.codes, i, code) })}
              readOnly={readOnly}
              onEnter={handleCheck}
              filter={codeFormat === 'decimal' ? /[^\d]/g : /[^01]/g}
              maxLength={codeFormat === 'decimal' ? 3 : 8}
              inputMode="numeric"
            />
          </label>
        ))}
      </div>
    )
  }

  function renderPixels() {
    const rows = Array.isArray(current.rows) ? current.rows.map(String) : []
    if (current.direction === 'encode') {
      return (
        <div className="act-row" style={{ alignItems: 'flex-start', gap: 16 }}>
          <PixelGrid rows={rows} label="Picture" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {rows.map((row, r) => (
              <AnswerInput
                key={r}
                label={`Row ${r + 1} bits`}
                value={itemState.rows[r] ?? ''}
                onValue={(bitsText) => update({ rows: replaceAt(itemState.rows, r, bitsText) })}
                readOnly={readOnly}
                onEnter={handleCheck}
                filter={/[^01]/g}
                maxLength={row.length}
                inputMode="numeric"
                style={{ width: `${Math.max(row.length, 4) + 2}ch`, height: CELL, minHeight: CELL }}
              />
            ))}
          </div>
        </div>
      )
    }
    return (
      <PixelGrid
        rows={itemState.cells}
        label="Drawing grid"
        readOnly={readOnly}
        onToggle={(r, c) =>
          update({ cells: replaceAt(itemState.cells, r, flip(itemState.cells[r], c)) })
        }
      />
    )
  }

  function renderBody() {
    switch (mode) {
      case 'to_decimal':
        return (
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
        )
      case 'add':
        return renderAddition()
      case 'overflow':
        return (
          <>
            {renderAddition()}
            <OverflowQuestion
              value={itemState.overflow}
              onAnswer={(overflow) => update({ overflow })}
              readOnly={readOnly}
            />
          </>
        )
      case 'hex':
        return renderHex()
      case 'ascii':
        return (
          <>
            {renderAscii()}
            {task?.showTable && <AsciiTable format={codeFormat} />}
          </>
        )
      case 'pixels':
        return renderPixels()
      default:
        return (
          <BitRow
            label="Bits"
            bits={itemState.bits}
            places={places}
            showPlaceValues={showPlaceValues}
            onToggle={(i) => update({ bits: flip(itemState.bits, i) })}
            readOnly={readOnly}
            testId="answer"
          />
        )
    }
  }

  return (
    <div className="act-panel" data-testid="binary-activity">
      <ItemNav items={items} currentIndex={index} onSelect={setIndex} statusFor={statusFor} />
      <p className="act-prompt">{MODE_PROMPTS[mode]?.(current) ?? 'Binary'}</p>

      {renderBody()}

      {showDecimal && mode !== 'to_decimal' && itemState.bits != null && (
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
  BuilderEditor: BinaryBuilderEditor,
}
