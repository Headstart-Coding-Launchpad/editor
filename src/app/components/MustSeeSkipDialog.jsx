import React from 'react'
import { createPortal } from 'react-dom'

/**
 * Asks the tutor before the class skips a task marked `mustSee`. "Go to it" moves the class to
 * that task instead; "Skip anyway" carries on with the original move. See src/shared/mustSee.js.
 *
 * @param {object} props
 * @param {string} props.taskTitle
 * @param {() => void} props.onGoToIt
 * @param {() => void} props.onSkip
 * @param {() => void} props.onClose
 */
export default function MustSeeSkipDialog({ taskTitle, onGoToIt, onSkip, onClose }) {
  return createPortal(
    <div
      className="ui-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="must-see-skip-title"
      data-testid="must-see-skip-dialog"
      style={s.overlay}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          onClose()
        }
      }}
    >
      <div style={s.dialog}>
        <h2 id="must-see-skip-title" style={s.title}>
          Skip “{taskTitle}”?
        </h2>
        <p style={s.note}>It's marked must-see: students run it to see the error on purpose.</p>
        <div style={s.actions}>
          <button
            type="button"
            className="btn-primary"
            onClick={onGoToIt}
            data-testid="must-see-go"
            autoFocus
          >
            Go to it
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={onSkip}
            data-testid="must-see-skip"
          >
            Skip anyway
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    zIndex: 1200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  dialog: {
    background: 'var(--ui-surface)',
    color: 'var(--colour-text)',
    borderRadius: 10,
    width: 'min(460px, 100%)',
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  title: { margin: 0, fontSize: '1.05rem' },
  note: { margin: 0, fontSize: '0.9rem', color: 'var(--colour-text-muted, #6b7280)' },
  actions: { display: 'flex', flexWrap: 'wrap', gap: 8 },
}
