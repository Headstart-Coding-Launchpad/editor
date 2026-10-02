import React from 'react'

/**
 * The teacher's one-line class summary above the student grid: what students are doing right
 * now ("👀 6 looking at Sam’s work · 🤝 Ali → Sam · 📖 1 reading a topic"; see
 * summariseClassActivities). Clicking a part outlines those students' cards; clicking it again
 * clears it. Hover lists the names.
 */
export default function ClassActivityStrip({ entries, names, highlighted, onHighlight }) {
  if (!entries?.length) return null
  return (
    <div style={s.strip} role="group" aria-label="What the class is doing">
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
            {entry.icon} {entry.text}
          </button>
        )
      })}
    </div>
  )
}

const s = {
  strip: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    padding: '6px 2px 8px',
  },
  item: {
    fontSize: 12,
    fontWeight: 600,
    padding: '3px 10px',
    borderRadius: 999,
    border: '1px solid var(--ui-border-strong)',
    background: 'var(--ui-surface)',
    color: 'var(--colour-ink-strong)',
    cursor: 'pointer',
  },
  itemOn: {
    background: 'var(--colour-secondary)',
    borderColor: 'var(--colour-secondary-dark)',
    color: '#fff',
  },
}
