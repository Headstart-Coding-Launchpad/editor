import React from 'react'

/**
 * The bar a student sees while the teacher has a classmate's work on "Show to class (keep
 * coding)". Unlike the full Go Live takeover nothing is locked: the student keeps working and
 * chooses to watch the broadcast or open a throwaway copy they can run.
 */
export default function StudentLivePanelBar({
  sourceStudentName,
  watching,
  copyOpen,
  onWatch,
  onStopWatching,
  onTryCopy,
}) {
  const name = sourceStudentName ?? 'A classmate'
  return (
    <div style={s.bar} role="status" data-testid="student-live-panel-bar">
      <span style={s.text}>
        📺 {name}&apos;s work is on show
        {watching || copyOpen ? '' : ' — keep coding, or take a look'}
      </span>
      <div style={s.actions}>
        {watching ? (
          <button type="button" className="btn-primary" style={s.btn} onClick={onStopWatching}>
            ← Back to my work
          </button>
        ) : (
          !copyOpen && (
            <button type="button" className="btn-ghost-outline" style={s.btn} onClick={onWatch}>
              👀 Watch
            </button>
          )
        )}
        {!copyOpen && (
          <button type="button" className="btn-ghost-outline" style={s.btn} onClick={onTryCopy}>
            ▶ Try a copy
          </button>
        )}
      </div>
    </div>
  )
}

const s = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
    padding: '6px 12px',
    background: 'rgba(124, 58, 237, 0.08)',
    borderBottom: '2px solid #7c3aed',
    flexShrink: 0,
  },
  text: { fontSize: 13, fontWeight: 600 },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  btn: { fontSize: 13, padding: '4px 12px' },
}
