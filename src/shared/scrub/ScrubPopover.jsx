import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  SCRUB_COMMON_COLOURS,
  SCRUB_SAFE_COLOURS,
  clampScrubValue,
  formatScrubColour,
  formatScrubNumber,
  normaliseHexInput,
} from './literals.js'
import { beginScrub, cancelScrub, commitScrub, previewScrub } from './scrubExtension.js'

const POPOVER_WIDTH = 300
const MARGIN = 8

/**
 * The popover beside a scrubbed literal (./scrubExtension.js openPopover): a slider for a number
 * (touch, or Alt-Enter), or the colour picker. Its changes preview live; Done, Enter, choosing a
 * colour or tapping outside keeps the value as one edit, Escape puts the original back.
 * `request` is `{ view, literal, range, step, settleSteps }`. With `settleSteps` (the task's
 * scrub.checkOnRelease) each finished slider step — lifting a finger or the mouse off the
 * slider, letting go of an arrow key, a − or + tap — is kept as its own edit at once, so the
 * task's checks run on it (a drag that has ended); Escape still puts the value from before the
 * popover opened back.
 */
export default function ScrubPopover({ request, onClose }) {
  const { view, literal } = request
  const sessionRef = useRef(null)
  if (!sessionRef.current) sessionRef.current = beginScrub(view, literal)
  const rootRef = useRef(null)
  const [position, setPosition] = useState(null)

  function close(keep) {
    const session = sessionRef.current
    if (keep) {
      commitScrub(view, session)
    } else if (session.original !== literal.text) {
      // Steps were already kept as edits: putting the first value back is an edit too.
      previewScrub(view, session, literal.text)
      commitScrub(view, session)
    } else {
      cancelScrub(view, session)
    }
    onClose()
    view.focus()
  }

  // Keeps the current value as an edit and carries on scrubbing from it (settleSteps).
  function settle() {
    const session = sessionRef.current
    if (!request.settleSteps || session.dead || session.current === session.original) return
    const { from, current, kind } = session
    if (!commitScrub(view, session)) return
    sessionRef.current = beginScrub(view, { from, text: current, kind })
  }
  const closeRef = useRef(close)
  closeRef.current = close

  // Beside the literal: below it when there is room, else above; always inside the viewport.
  useLayoutEffect(() => {
    const coords = view.coordsAtPos(literal.from)
    const height = rootRef.current?.offsetHeight ?? 200
    const width = Math.min(POPOVER_WIDTH, window.innerWidth - MARGIN * 2)
    if (!coords) {
      setPosition({ left: MARGIN, top: MARGIN, width })
      return
    }
    const below = coords.bottom + 6
    const top =
      below + height > window.innerHeight - MARGIN
        ? Math.max(MARGIN, coords.top - height - 6)
        : below
    const left = Math.min(Math.max(MARGIN, coords.left - 16), window.innerWidth - width - MARGIN)
    setPosition({ left, top, width })
  }, [view, literal.from])

  // Tapping outside keeps the value.
  useEffect(() => {
    function onPointerDown(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) closeRef.current(true)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [])

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close(false)
    } else if (
      event.key === 'Enter' &&
      event.target?.tagName !== 'BUTTON' &&
      !event.target?.dataset?.hexInput
    ) {
      // Enter on the slider keeps the value (the hex field's Enter submits its own form).
      event.preventDefault()
      close(true)
    }
  }

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-label={literal.kind === 'number' ? 'Change the number' : 'Choose a colour'}
      className="scrub-popover"
      style={{
        ...s.root,
        ...(position ?? { left: -9999, top: -9999, width: POPOVER_WIDTH }),
      }}
      onKeyDown={onKeyDown}
    >
      {literal.kind === 'number' ? (
        <NumberSlider
          request={request}
          sessionRef={sessionRef}
          onSettle={settle}
          onDone={() => close(true)}
        />
      ) : (
        <ColourPicker
          request={request}
          session={sessionRef.current}
          onPick={() => close(true)}
          onCancel={() => close(false)}
        />
      )}
    </div>,
    document.body
  )
}

// Keys that move a range input: letting go of one ends a step.
const SLIDER_KEYS = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'PageUp',
  'PageDown',
  'Home',
  'End',
])

function NumberSlider({ request, sessionRef, onSettle, onDone }) {
  const { view, literal, range, step } = request
  const [value, setValue] = useState(literal.value)
  const sliderRef = useRef(null)
  useEffect(() => sliderRef.current?.focus(), [])

  function change(next) {
    const clamped = clampScrubValue(next, range, step)
    setValue(clamped)
    previewScrub(view, sessionRef.current, formatScrubNumber(clamped, literal))
  }

  function stepBy(delta) {
    change(value + delta)
    onSettle()
  }

  const shown = formatScrubNumber(value, literal)
  return (
    <div style={s.column}>
      <div style={s.headerRow}>
        <span style={s.title}>Line {literal.line}</span>
        <output style={s.value} aria-live="polite">
          {shown}
        </output>
      </div>
      <div style={s.sliderRow}>
        <button
          type="button"
          style={s.stepBtn}
          aria-label={`Smaller (minus ${step})`}
          onClick={() => stepBy(-step)}
        >
          −
        </button>
        <input
          ref={sliderRef}
          type="range"
          style={s.slider}
          min={range.min}
          max={range.max}
          step={step}
          value={value}
          aria-label={`Number on line ${literal.line}`}
          aria-valuetext={shown}
          onChange={(event) => change(Number(event.target.value))}
          onPointerUp={onSettle}
          onKeyUp={(event) => {
            if (SLIDER_KEYS.has(event.key)) onSettle()
          }}
        />
        <button
          type="button"
          style={s.stepBtn}
          aria-label={`Bigger (plus ${step})`}
          onClick={() => stepBy(step)}
        >
          +
        </button>
      </div>
      <div style={s.footerRow}>
        <span style={s.rangeText}>
          {formatScrubNumber(range.min, literal)} to {formatScrubNumber(range.max, literal)}
        </span>
        <button type="button" className="btn-primary" style={s.doneBtn} onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  )
}

function ColourPicker({ request, session, onPick, onCancel }) {
  const { view, literal } = request
  const [hexDraft, setHexDraft] = useState(literal.hex)
  const [hexError, setHexError] = useState(false)
  const firstRef = useRef(null)
  useEffect(() => firstRef.current?.focus(), [])
  const current = useMemo(() => literal.hex?.toLowerCase(), [literal.hex])

  function pick(choice) {
    previewScrub(view, session, formatScrubColour(choice, literal))
    onPick()
  }

  function applyHex() {
    const hex = normaliseHexInput(hexDraft)
    if (!hex) {
      setHexError(true)
      return
    }
    pick({ hex, name: null })
  }

  const swatch = (choice, index, ref) => (
    <button
      key={`${choice.label}-${choice.hex}`}
      ref={index === 0 ? ref : undefined}
      type="button"
      style={{
        ...s.swatchBtn,
        ...(choice.hex === current ? s.swatchBtnCurrent : null),
      }}
      aria-label={`${choice.label} (${choice.name ?? choice.hex})`}
      aria-pressed={choice.hex === current}
      onClick={() => pick(choice)}
    >
      <span aria-hidden="true" style={{ ...s.swatchChip, background: choice.hex }} />
      <span style={s.swatchLabel}>{choice.label}</span>
    </button>
  )

  return (
    <div style={s.column}>
      <span style={s.title} id="scrub-safe-colours">
        Colour-blind-safe colours
      </span>
      <div style={s.swatchGrid} role="group" aria-labelledby="scrub-safe-colours">
        {SCRUB_SAFE_COLOURS.map((choice, index) => swatch(choice, index, firstRef))}
      </div>
      <span style={s.title} id="scrub-common-colours">
        More colours
      </span>
      <div style={s.swatchGrid} role="group" aria-labelledby="scrub-common-colours">
        {SCRUB_COMMON_COLOURS.map((choice, index) => swatch(choice, index + 1, null))}
      </div>
      <form
        style={s.hexRow}
        onSubmit={(event) => {
          event.preventDefault()
          applyHex()
        }}
      >
        <label style={s.hexLabel} htmlFor="scrub-hex-input">
          Hex
        </label>
        <input
          id="scrub-hex-input"
          data-hex-input="true"
          style={{ ...s.hexInput, ...(hexError ? s.hexInputError : null) }}
          value={hexDraft}
          spellCheck={false}
          aria-invalid={hexError}
          aria-describedby={hexError ? 'scrub-hex-error' : undefined}
          onChange={(event) => {
            setHexDraft(event.target.value)
            setHexError(false)
          }}
        />
        <button type="submit" className="btn-primary" style={s.doneBtn}>
          Use
        </button>
      </form>
      {hexError && (
        <span id="scrub-hex-error" style={s.hexErrorText}>
          Write a hex colour like #ff0000
        </span>
      )}
      <button type="button" className="btn-ghost-outline" style={s.cancelBtn} onClick={onCancel}>
        Cancel
      </button>
    </div>
  )
}

const s = {
  root: {
    position: 'fixed',
    zIndex: 2000,
    background: '#fff',
    border: '1px solid #d8c4f5',
    borderRadius: 12,
    boxShadow: '0 10px 30px rgba(17, 24, 39, 0.18)',
    padding: 12,
    fontFamily: 'var(--font-body)',
    color: 'var(--colour-text, #1f2937)',
    boxSizing: 'border-box',
    maxHeight: 'calc(100vh - 16px)',
    overflowY: 'auto',
  },
  column: { display: 'flex', flexDirection: 'column', gap: 8 },
  headerRow: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' },
  title: { fontSize: '0.8rem', fontWeight: 700, color: 'var(--colour-primary, #5b21b6)' },
  value: { fontFamily: "'JetBrains Mono', monospace", fontSize: '1.1rem', fontWeight: 700 },
  sliderRow: { display: 'flex', alignItems: 'center', gap: 8 },
  slider: { flex: 1, minWidth: 0, height: 44, accentColor: '#7c3aed', cursor: 'pointer' },
  stepBtn: {
    width: 44,
    height: 44,
    flexShrink: 0,
    fontSize: '1.3rem',
    fontWeight: 700,
    background: '#f5f3ff',
    color: '#5b21b6',
    border: '1px solid #d8c4f5',
    borderRadius: 10,
    cursor: 'pointer',
  },
  footerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rangeText: { fontSize: '0.78rem', color: '#6b7280' },
  doneBtn: { minHeight: 44, padding: '0 18px', fontSize: 14 },
  cancelBtn: { minHeight: 44, fontSize: 14, borderRadius: 8 },
  swatchGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 },
  swatchBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    padding: '0 8px',
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    fontSize: '0.85rem',
    color: 'var(--colour-text, #1f2937)',
    textAlign: 'left',
  },
  swatchBtnCurrent: { borderColor: '#7c3aed', boxShadow: '0 0 0 2px rgba(124, 58, 237, 0.25)' },
  swatchChip: {
    width: 22,
    height: 22,
    flexShrink: 0,
    borderRadius: 6,
    border: '1px solid rgba(0, 0, 0, 0.3)',
  },
  swatchLabel: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' },
  hexRow: { display: 'flex', alignItems: 'center', gap: 8 },
  hexLabel: { fontSize: '0.85rem', fontWeight: 600 },
  hexInput: {
    flex: 1,
    minWidth: 0,
    height: 44,
    padding: '0 10px',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.95rem',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    boxSizing: 'border-box',
  },
  hexInputError: { borderColor: '#b91c1c' },
  hexErrorText: { fontSize: '0.8rem', color: '#b91c1c' },
}
