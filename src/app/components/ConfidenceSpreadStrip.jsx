import React, { useState } from 'react'
import {
  confidenceColour,
  confidenceGroup,
  confidenceTextColour,
} from '../../shared/confidenceScale'

/**
 * The class's confidence spread on the current confidence check, above the student grid: one
 * column per level (1 to 10, red to green) with how many students chose it, and how many have
 * answered. Built from tallyConfidenceSpread (src/shared/confidenceScale.js). Like
 * CommonHintsStrip it is collapsible, and clicking a level outlines those students' cards
 * (the grid's shared highlight, group `confidence:<level>`); hover lists the names. Renders
 * nothing when `spread` is null (the current task is not a confidence check).
 */
export default function ConfidenceSpreadStrip({ spread, names, highlighted, onHighlight }) {
  const [open, setOpen] = useState(true)
  if (!spread) return null
  const max = Math.max(1, ...spread.levels.map((entry) => entry.count))
  return (
    <div style={s.wrap} data-testid="confidence-spread">
      <button
        type="button"
        style={s.toggle}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? '▾' : '▸'} Class confidence · {spread.respondedCount} of {spread.total} answered
      </button>
      {open && (
        <div style={s.columns} role="group" aria-label="How many students chose each level">
          {spread.levels.map((entry) => {
            const group = confidenceGroup(entry.level)
            const on = highlighted === group
            const colour = confidenceColour(entry.level)
            return (
              <button
                key={entry.level}
                type="button"
                style={{ ...s.column, ...(on ? s.columnOn : null) }}
                aria-pressed={on}
                aria-label={`${entry.count} chose ${entry.level}`}
                disabled={entry.count === 0}
                title={
                  entry.count > 0
                    ? entry.studentIds.map((id) => names[id] ?? 'a student').join(', ')
                    : undefined
                }
                onClick={() => onHighlight(on ? null : group)}
              >
                <span style={s.count}>{entry.count}</span>
                <span style={s.track} aria-hidden="true">
                  <span
                    style={{
                      ...s.fill,
                      height: `${Math.round((entry.count / max) * 100)}%`,
                      background: colour,
                    }}
                  />
                </span>
                <span
                  style={{
                    ...s.level,
                    background: colour,
                    color: confidenceTextColour(entry.level),
                  }}
                >
                  {entry.level}
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
  columns: {
    display: 'grid',
    gridTemplateColumns: 'repeat(10, minmax(28px, 1fr))',
    gap: 4,
    maxWidth: 520,
  },
  column: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    padding: '4px 2px',
    borderRadius: 6,
    border: '1px solid var(--ui-border)',
    background: 'var(--ui-surface-neutral-sunk)',
    cursor: 'pointer',
    minHeight: 44,
  },
  columnOn: {
    borderColor: 'var(--colour-primary)',
    boxShadow: '0 0 0 2px var(--colour-primary)',
  },
  count: {
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--colour-ink-strong)',
    lineHeight: 1,
  },
  track: {
    display: 'flex',
    alignItems: 'flex-end',
    width: 10,
    height: 28,
    borderRadius: 3,
    background: 'var(--ui-surface-neutral)',
    overflow: 'hidden',
  },
  fill: {
    display: 'block',
    width: '100%',
  },
  level: {
    minWidth: 20,
    padding: '1px 4px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 700,
    textAlign: 'center',
    lineHeight: 1.3,
  },
}
