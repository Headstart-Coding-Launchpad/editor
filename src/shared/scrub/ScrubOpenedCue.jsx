import React from 'react'

/**
 * "Now make it yours" — shown above the editor when a `scrub.afterPass` task has just been
 * passed and its scrub boxes and #@lock-values values have opened (useScrubAfterPass). It goes
 * when the student scrubs a value or leaves the task.
 */
export default function ScrubOpenedCue({ show, style }) {
  if (!show) return null
  return (
    <p role="status" data-testid="scrub-opened-cue" style={{ ...s.note, ...style }}>
      <span aria-hidden="true" style={s.icon}>
        ✨
      </span>
      Now make it yours: change the values in the dashed boxes.
    </p>
  )
}

const s = {
  note: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    margin: '0 0 6px',
    padding: '4px 10px',
    flexShrink: 0,
    borderRadius: 8,
    background: '#f5f3ff',
    border: '1px solid #d8c4f5',
    color: '#4c1d95',
    fontFamily: 'var(--font-body)',
    fontSize: '0.85rem',
    fontWeight: 600,
    overflowWrap: 'anywhere',
  },
  icon: { flexShrink: 0 },
}
