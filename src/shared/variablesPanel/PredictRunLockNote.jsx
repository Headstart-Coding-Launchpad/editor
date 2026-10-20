/**
 * The words beside a Run button that predict mode's lock disabled (getPredictRunLock in
 * ./variablesPanel.js): always shown as text, not only a tooltip, so touch screens see it too.
 * The Run button points at it with aria-describedby={PREDICT_RUN_LOCK_NOTE_ID}.
 *
 * The words are a button: it takes the student to the first empty tag (data-predict-tag, in
 * NameTagPanel) and puts the focus in it. `onReveal` runs first, so a workspace can bring the
 * tags into view (unfold the output, switch to the Tags tab) before the focus moves.
 */
export const PREDICT_RUN_LOCK_NOTE_ID = 'predict-run-lock-note'

/**
 * Focuses the answer box (or first answer button) of the first tag in `missing` (the lock's
 * names) found inside `root`. Returns true when something took the focus.
 */
export function focusFirstMissingPrediction(missing, root = document) {
  for (const key of Array.isArray(missing) ? missing : []) {
    const tag = root?.querySelector?.(`[data-predict-tag="${cssEscape(key)}"]`)
    const target = tag?.querySelector('input, textarea, select, button:not([disabled])')
    if (!target) continue
    tag.scrollIntoView?.({ block: 'nearest' })
    target.focus()
    return true
  }
  return false
}

function cssEscape(value) {
  const text = String(value)
  return typeof CSS !== 'undefined' && CSS.escape
    ? CSS.escape(text)
    : text.replace(/["\\]/g, '\\$&')
}

export default function PredictRunLockNote({ lock, onReveal }) {
  if (!lock) return null
  function handleClick() {
    onReveal?.()
    // After the reveal has rendered (a tab switch mounts the tags).
    requestAnimationFrame(() => focusFirstMissingPrediction(lock.missing))
  }
  return (
    <button
      type="button"
      id={PREDICT_RUN_LOCK_NOTE_ID}
      className="predict-run-lock-note"
      style={s.note}
      onClick={handleClick}
      title="Go to the first empty prediction"
    >
      <span aria-hidden="true">✏️ </span>
      {lock.message}
    </button>
  )
}

const s = {
  note: {
    alignSelf: 'center',
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--colour-primary)',
    whiteSpace: 'nowrap',
    background: 'none',
    border: 'none',
    padding: '4px 2px',
    textDecoration: 'underline',
    textUnderlineOffset: 3,
    cursor: 'pointer',
  },
}
