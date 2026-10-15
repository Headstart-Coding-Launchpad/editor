/**
 * The words beside a Run button that predict mode's lock disabled (getPredictRunLock in
 * ./variablesPanel.js): always shown as text, not only a tooltip, so touch screens see it too.
 * The Run button points at it with aria-describedby={PREDICT_RUN_LOCK_NOTE_ID}.
 */
export const PREDICT_RUN_LOCK_NOTE_ID = 'predict-run-lock-note'

export default function PredictRunLockNote({ lock }) {
  if (!lock) return null
  return (
    <span id={PREDICT_RUN_LOCK_NOTE_ID} role="status" style={s.note}>
      <span aria-hidden="true">✏️ </span>
      {lock.message}
    </span>
  )
}

const s = {
  note: {
    alignSelf: 'center',
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--colour-muted)',
    whiteSpace: 'nowrap',
  },
}
