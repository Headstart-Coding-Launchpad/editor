import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'

// The StudentModal's "Only you see" strip: the tutor-only facts about this student, one line of
// chips in priority order (Help needed, error, hint, carry, live, then the rest). Chips that do
// not fit go behind a "+N" chip that lists them. While a mode is on (waiting for the student,
// editing their code or answers, highlighting tiles) the mode row takes the strip over so it
// can always be switched off.

const GAP = 8
const MORE_WIDTH = 52

/**
 * How many chips fit in `available` px, keeping room for the "+N" chip when some must go.
 * No layout (width 0, as in tests) shows them all.
 */
export function fitChipCount(widths, available, { gap = GAP, moreWidth = MORE_WIDTH } = {}) {
  const n = widths.length
  if (!(available > 0) || n === 0) return n
  const total = widths.reduce((sum, w) => sum + w, 0) + gap * (n - 1)
  if (total <= available) return n
  let used = 0
  let count = 0
  for (let i = 0; i < n; i += 1) {
    const next = used + (i > 0 ? gap : 0) + widths[i]
    if (next + gap + moreWidth > available) break
    used = next
    count = i + 1
  }
  return count
}

const TONES = {
  help: { background: '#fbbf24', color: '#3b2200', borderColor: '#d97706' },
  error: { background: '#fef2f2', color: '#991b1b', borderColor: '#fca5a5' },
  info: { background: '#eff6ff', color: '#1e40af', borderColor: '#93c5fd' },
  good: { background: '#f0fdf4', color: '#166534', borderColor: '#86efac' },
  live: { background: '#dc2626', color: '#fff', borderColor: '#b91c1c' },
  muted: { background: '#f9fafb', color: '#4b5563', borderColor: '#d1d5db' },
}

/** One chip; `chip` is { key, tone, title, testId, content }. */
function StripChip({ chip, style }) {
  return (
    <span
      style={{ ...s.chip, ...(TONES[chip.tone] ?? TONES.muted), ...style }}
      title={chip.title}
      data-testid={chip.testId ?? `strip-chip-${chip.key}`}
    >
      {chip.content}
    </span>
  )
}

export default function ModalStrip({ chips, mode = null }) {
  const rowRef = useRef(null)
  const chipRefs = useRef([])
  const [count, setCount] = useState(chips.length)
  const [overflowOpen, setOverflowOpen] = useState(false)
  // The popover opens towards the side with room (the "+N" chip is usually far right).
  const [alignRight, setAlignRight] = useState(false)
  const keys = chips.map((c) => c.key).join('|')

  // Every chip stays in the DOM (the hidden ones out of the flow) so each one can be measured.
  useLayoutEffect(() => {
    if (mode) return undefined
    const row = rowRef.current
    if (!row) return undefined
    const measure = () => {
      const widths = chips.map((_, i) => chipRefs.current[i]?.offsetWidth ?? 0)
      setCount(fitChipCount(widths, row.clientWidth))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    // The row and every chip: a chip's text can change width without the list changing
    // ("Last run 12 s ago" becoming "Last run 3 min ago").
    const observer = new ResizeObserver(measure)
    observer.observe(row)
    chips.forEach((_, i) => chipRefs.current[i] && observer.observe(chipRefs.current[i]))
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys, mode])

  useEffect(() => {
    if (!overflowOpen) return undefined
    const close = (event) => {
      if (!rowRef.current?.contains(event.target)) setOverflowOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [overflowOpen])

  const shown = Math.min(count, chips.length)
  const hidden = chips.slice(shown)

  return (
    <div style={s.strip} data-testid="student-modal-strip">
      <span style={s.label}>Only you see</span>
      {mode ? (
        <div style={s.mode} data-testid="strip-mode" role="status">
          {mode}
        </div>
      ) : (
        <div ref={rowRef} style={s.row}>
          {chips.map((chip, i) => (
            <span
              key={chip.key}
              ref={(el) => {
                chipRefs.current[i] = el
                // A chip behind "+N" keeps its buttons out of the tab order (it is listed again,
                // live, in the popover).
                if (el) el.inert = i >= shown
              }}
              style={i < shown ? s.slot : s.slotHidden}
              aria-hidden={i < shown ? undefined : true}
            >
              <StripChip chip={chip} />
            </span>
          ))}
          {hidden.length > 0 && (
            <span style={s.moreWrap}>
              <button
                type="button"
                style={s.more}
                aria-expanded={overflowOpen}
                aria-label={`${hidden.length} more`}
                onClick={(event) => {
                  const box = event.currentTarget.getBoundingClientRect()
                  setAlignRight(box.right > s.popover.width + 24)
                  setOverflowOpen((open) => !open)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape' && overflowOpen) {
                    event.stopPropagation()
                    setOverflowOpen(false)
                  }
                }}
              >
                +{hidden.length}
              </button>
              {overflowOpen && (
                <div
                  style={alignRight ? { ...s.popover, left: 'auto', right: 0 } : s.popover}
                  className="ui-popover"
                  data-testid="strip-overflow"
                >
                  <div style={s.popoverHeading}>More, only you see</div>
                  {hidden.map((chip) => (
                    <StripChip
                      key={chip.key}
                      chip={{ ...chip, testId: `strip-overflow-${chip.key}` }}
                      style={s.popoverChip}
                    />
                  ))}
                </div>
              )}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

const s = {
  strip: {
    height: 48,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    gap: GAP,
    padding: '0 12px',
    background: '#fff',
    borderBottom: '1px solid #e6e0f0',
    fontFamily: 'var(--font-body)',
  },
  label: {
    width: 58,
    flexShrink: 0,
    fontSize: 11.5,
    fontWeight: 700,
    lineHeight: 1.1,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  row: {
    position: 'relative',
    flex: 1,
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: GAP,
    whiteSpace: 'nowrap',
  },
  slot: { display: 'inline-flex', flexShrink: 0 },
  slotHidden: {
    display: 'inline-flex',
    position: 'absolute',
    left: 0,
    top: 0,
    visibility: 'hidden',
    pointerEvents: 'none',
  },
  chip: {
    height: 32,
    boxSizing: 'border-box',
    borderRadius: 999,
    border: '1px solid',
    padding: '0 12px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 13,
    fontWeight: 700,
    whiteSpace: 'nowrap',
    maxWidth: 320,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  mode: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    height: 36,
    padding: '0 6px 0 12px',
    borderRadius: 8,
    border: '1px dashed var(--colour-primary)',
    background: '#faf7ff',
    color: 'var(--colour-primary)',
    fontWeight: 700,
    fontSize: 13.5,
    whiteSpace: 'nowrap',
  },
  moreWrap: { position: 'relative', flexShrink: 0, display: 'inline-flex' },
  more: {
    height: 32,
    minWidth: 44,
    padding: '0 12px',
    borderRadius: 999,
    border: '1.5px dashed var(--colour-primary)',
    background: '#fff',
    color: 'var(--colour-primary)',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
  },
  popover: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: 0,
    zIndex: 210,
    width: 300,
    padding: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    background: '#fff',
    border: '1px solid #d9d0ee',
    borderRadius: 12,
    boxShadow: '0 16px 40px rgba(40,22,78,0.28)',
  },
  popoverHeading: {
    fontSize: 11,
    fontWeight: 700,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  popoverChip: { alignSelf: 'flex-start', maxWidth: '100%' },
}
