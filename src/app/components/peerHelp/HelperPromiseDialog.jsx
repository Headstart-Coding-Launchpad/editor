import React from 'react'

const HELPER_PROMISE_POINTS = [
  'Be kind. Talk about the code, never the person.',
  'Help them learn: give a nudge, not the whole answer.',
  'Your teacher sees everything you send.',
]

/** Agreed once per session, before a student's first go at helping a classmate. */
export default function HelperPromiseDialog({ onAgree, onCancel }) {
  return (
    <div style={s.backdrop} role="dialog" aria-modal="true" aria-label="Helper promise">
      <div style={s.card}>
        <h2 style={s.title}>🤝 The helper promise</h2>
        <ul style={s.list}>
          {HELPER_PROMISE_POINTS.map((point) => (
            <li key={point} style={s.item}>
              {point}
            </li>
          ))}
        </ul>
        <div style={s.actions}>
          <button type="button" className="btn-ghost-outline" onClick={onCancel}>
            Not now
          </button>
          <button type="button" className="btn-primary" onClick={onAgree}>
            I promise
          </button>
        </div>
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
    color: 'var(--colour-text, inherit)',
    borderRadius: 12,
    padding: 20,
    maxWidth: 420,
    width: '100%',
    boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
  },
  title: { margin: '0 0 10px', fontSize: 18 },
  list: { margin: '0 0 16px', paddingLeft: 20 },
  item: { marginBottom: 6, fontSize: 14 },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 8 },
}
