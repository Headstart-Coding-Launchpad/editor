import React from 'react'

// Tutor-only item picker for read-only views (the student card modal, presentation, review).
// Students never see it: their round moves on by itself (ui/RoundProgress.jsx). It lets a tutor
// look at any item's state, e.g. what a student typed on item 2 after moving on. `statusFor(item)`
// returns 'done', 'wrong' or null.
export default function TutorItemPicker({ items, currentId, onSelect, statusFor, noun = 'Item' }) {
  if (!items?.length || items.length < 2) return null
  return (
    <nav className="act-round" aria-label={`${noun}s (tutor view)`} data-testid="tutor-item-picker">
      {items.map((item, index) => {
        const status = statusFor?.(item) ?? null
        const label = `${noun} ${index + 1}${status === 'done' ? ', done' : status === 'wrong' ? ', not right yet' : ''}`
        return (
          <button
            key={item.id}
            type="button"
            className="btn-ghost-outline act-btn"
            aria-current={item.id === currentId ? 'step' : undefined}
            aria-label={label}
            title={label}
            onClick={() => onSelect(item.id)}
          >
            {status === 'done' ? '✓' : index + 1}
          </button>
        )
      })}
    </nav>
  )
}
