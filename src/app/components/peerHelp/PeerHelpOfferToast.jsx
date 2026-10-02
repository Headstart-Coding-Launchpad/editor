import React from 'react'

/**
 * A quiet offer to a student who has finished the task: a classmate is stuck. Never names who,
 * never blocks the student's own work, and can be dismissed.
 */
export default function PeerHelpOfferToast({ offer, busy, error, onHelp, onDismiss }) {
  if (!offer) return null
  return (
    <div style={s.toast} role="status" data-testid="peer-help-offer">
      <span style={s.text}>
        🤝 A classmate is stuck on this task. You finished it: can you help?
      </span>
      {error && <span style={s.error}>{error}</span>}
      <div style={s.actions}>
        <button type="button" className="btn-ghost-outline" style={s.btn} onClick={onDismiss}>
          Not now
        </button>
        <button
          type="button"
          className="btn-primary"
          style={s.btn}
          onClick={onHelp}
          disabled={busy}
        >
          Help out
        </button>
      </div>
    </div>
  )
}

const s = {
  toast: {
    position: 'fixed',
    right: 16,
    bottom: 16,
    zIndex: 900,
    maxWidth: 'min(360px, calc(100vw - 32px))',
    background: 'var(--ui-surface)',
    border: '2px solid #0d9488',
    borderRadius: 12,
    padding: 12,
    boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  text: { fontSize: 14, fontWeight: 600 },
  error: { fontSize: 12, color: 'var(--colour-danger, #dc2626)' },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 8 },
  btn: { fontSize: 13, padding: '5px 12px' },
}
