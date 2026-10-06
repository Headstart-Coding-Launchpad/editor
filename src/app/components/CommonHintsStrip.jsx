import React, { useState } from 'react'

/**
 * The hints two or more students are seeing on the current task, above the student grid
 * ("💬 Remember the quotes… · 6"; see summariseCommonHints in src/app/studentHints.js) — a
 * quick way to spot a whole-class misconception. Collapsible; clicking a row outlines those
 * students' cards (sharing the grid's highlight with ClassActivityStrip), clicking it again
 * clears it. Hover lists the names. Renders nothing when no hint is shared.
 */
export default function CommonHintsStrip({ entries, names, highlighted, onHighlight }) {
  const [open, setOpen] = useState(true)
  if (!entries?.length) return null
  const total = entries.length
  return (
    <div style={s.wrap} data-testid="common-hints">
      <button
        type="button"
        style={s.toggle}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? '▾' : '▸'} Common hints right now ({total})
      </button>
      {open && (
        <div style={s.list} role="group" aria-label="Hints several students are seeing">
          {entries.map((entry) => {
            const on = highlighted === entry.group
            return (
              <button
                key={entry.group}
                type="button"
                style={{ ...s.item, ...(on ? s.itemOn : null) }}
                aria-pressed={on}
                title={entry.studentIds.map((id) => names[id] ?? 'a student').join(', ')}
                onClick={() => onHighlight(on ? null : entry.group)}
              >
                <span style={s.text}>💬 {entry.text}</span>
                <span style={{ ...s.count, ...(on ? s.countOn : null) }}>
                  {entry.studentIds.length}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

const s = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '2px 2px 8px',
  },
  toggle: {
    alignSelf: 'flex-start',
    background: 'none',
    border: 'none',
    padding: '2px 0',
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--colour-ink-strong)',
    cursor: 'pointer',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    textAlign: 'left',
    fontSize: 12,
    fontWeight: 600,
    padding: '4px 10px',
    borderRadius: 8,
    border: '1px solid #fde68a',
    background: '#fffbeb',
    color: '#92400e',
    cursor: 'pointer',
  },
  itemOn: {
    background: 'var(--colour-secondary)',
    borderColor: 'var(--colour-secondary-dark)',
    color: '#fff',
  },
  text: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  count: {
    flexShrink: 0,
    minWidth: 20,
    textAlign: 'center',
    padding: '0 6px',
    borderRadius: 999,
    background: '#92400e',
    color: '#fff',
  },
  countOn: {
    background: '#fff',
    color: 'var(--colour-secondary-dark)',
  },
}
