import React from 'react'

// Numbered item navigation shared by activity UIs: "Question 2 of 5", Previous/Next and one
// 44px dot per item (ticked when done, marked when checked and wrong). Keyboard accessible:
// every control is a real button.
export default function ItemNav({ items, currentIndex, onSelect, statusFor, noun = 'Question' }) {
  if (!items?.length || items.length < 2) return null
  const last = items.length - 1
  return (
    <nav className="act-item-nav" aria-label={`${noun}s`}>
      <button
        type="button"
        className="btn-ghost-outline act-btn"
        onClick={() => onSelect(Math.max(0, currentIndex - 1))}
        disabled={currentIndex <= 0}
      >
        ← Previous
      </button>
      <span className="act-prompt" style={{ fontSize: '1rem' }} aria-live="polite">
        {noun} {currentIndex + 1} of {items.length}
      </span>
      {items.length <= 12 &&
        items.map((item, index) => {
          const status = statusFor?.(item) ?? null
          const label = `${noun} ${index + 1}${status === 'done' ? ', done' : status === 'wrong' ? ', not right yet' : ''}`
          return (
            <button
              key={item.id}
              type="button"
              className={`act-item-dot${status === 'done' ? ' act-item-dot--done' : ''}${status === 'wrong' ? ' act-item-dot--wrong' : ''}`}
              aria-current={index === currentIndex ? 'step' : undefined}
              aria-label={label}
              title={label}
              onClick={() => onSelect(index)}
            >
              {status === 'done' ? '✓' : index + 1}
            </button>
          )
        })}
      <button
        type="button"
        className="btn-ghost-outline act-btn"
        onClick={() => onSelect(Math.min(last, currentIndex + 1))}
        disabled={currentIndex >= last}
      >
        Next →
      </button>
    </nav>
  )
}
