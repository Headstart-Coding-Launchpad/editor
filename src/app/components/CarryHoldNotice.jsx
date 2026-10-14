// Shown in place of the workspace while a live task with a cross-lesson carry
// (carryCodeFromLesson / carryBlocksFromLesson) waits for the tutor to find the student's work
// from an earlier lesson (src/shared/roster/crossLessonCarry.js). The workspace opens on its own
// as soon as the tutor's client has written the student's carry status.
export default function CarryHoldNotice({ sourceLabel = null }) {
  const source = sourceLabel ? `your ${sourceLabel} work` : 'your work from last lesson'
  return (
    <div style={s.wrap} role="status" aria-live="polite" data-testid="carry-hold-notice">
      <div style={s.card}>
        <span style={s.icon} aria-hidden="true">
          ⏳
        </span>
        <p style={s.title}>Waiting for your tutor to find {source}…</p>
        <p style={s.text}>
          Your program from last time will open here in a moment, so you can carry on building it.
          While you wait, have a read of the task.
        </p>
      </div>
    </div>
  )
}

const s = {
  wrap: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    maxWidth: 440,
    textAlign: 'center',
    background: 'var(--colour-surface, #fff)',
    color: 'var(--colour-text)',
    border: '1px solid var(--colour-border, #e5e7eb)',
    borderRadius: 12,
    padding: '24px 28px',
  },
  icon: { fontSize: 36, display: 'block', marginBottom: 8 },
  title: { margin: '0 0 8px', fontWeight: 700, fontSize: '1.1rem' },
  text: { margin: 0, color: 'var(--colour-muted)', fontSize: '0.95rem', lineHeight: 1.5 },
}
