import React from 'react'

const HELPER_PROMISE_POINTS = [
  { emoji: '😊', text: 'I will be kind' },
  { emoji: '💡', text: 'I will give clues, not answers' },
  { emoji: '👀', text: 'My teacher can see what I send' },
]

/** Agreed once per session, before a student's first go at helping a classmate. */
export default function HelperPromiseDialog({ onAgree, onCancel }) {
  return (
    <div
      className="ui-modal-backdrop"
      style={s.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Helper promise"
    >
      <div style={s.card}>
        <h2 style={s.title}>🤝 Helper promise</h2>
        <ul style={s.list}>
          {HELPER_PROMISE_POINTS.map((point) => (
            <li key={point.text} style={s.item}>
              <span style={s.emoji} aria-hidden="true">
                {point.emoji}
              </span>
              {point.text}
            </li>
          ))}
        </ul>
        <button type="button" className="btn-primary" style={s.promise} onClick={onAgree}>
          I promise
        </button>
        <button type="button" style={s.notNow} onClick={onCancel}>
          not now
        </button>
      </div>
    </div>
  )
}

const s = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1200,
    padding: 16,
  },
  card: {
    background: 'var(--ui-surface)',
    color: 'var(--colour-text)',
    borderRadius: 16,
    padding: 24,
    maxWidth: 380,
    width: '100%',
    boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  title: { margin: 0, fontSize: 22 },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  item: { display: 'flex', alignItems: 'center', gap: 12, fontSize: 18, fontWeight: 600 },
  emoji: { fontSize: 26 },
  promise: { fontSize: 18, padding: '10px 32px', marginTop: 6 },
  notNow: {
    background: 'transparent',
    border: 'none',
    color: 'var(--colour-muted)',
    fontSize: 14,
    textDecoration: 'underline',
    cursor: 'pointer',
  },
}
