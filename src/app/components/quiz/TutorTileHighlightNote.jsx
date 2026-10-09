import React from 'react'

// The line under a blank the tutor highlighted (src/shared/tutorTileHighlights.js): "👀 Look
// again" and the tutor's note, if any. Always visible (no hover), so it works on touch; it sits
// beside the blank, never over it, so dragging is untouched. `children` names the tile when the
// blank alone would be ambiguous (a code line with several blanks, a Fill in the Gaps passage).
export default function TutorTileHighlightNote({
  note,
  children = null,
  testId = 'tutor-tile-highlight-note',
}) {
  return (
    <div style={styles.note} data-testid={testId} role="status">
      <span aria-hidden="true" style={styles.icon}>
        👀
      </span>
      <span>
        <strong>Look again</strong>
        {children ? <> at {children}</> : null}
        {note ? `: ${note}` : null}
      </span>
    </div>
  )
}

const styles = {
  // The tile-feedback hint's red (CodeArrangeTask flagHint), so both read as "this tile".
  note: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 6,
    border: '1px solid #fecaca',
    background: '#fee2e2',
    color: '#b91c1c',
    fontFamily: 'var(--font-body)',
    fontSize: '0.84rem',
    lineHeight: 1.4,
  },
  icon: {
    flexShrink: 0,
  },
}
