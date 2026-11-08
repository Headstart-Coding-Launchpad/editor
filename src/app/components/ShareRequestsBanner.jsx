import React from 'react'

/**
 * Students asking to share their work with the class (students.{id}.shareRequestedAt), as a
 * prompt above the student grid rather than only a small 📤 chip on their card (HSC Audit,
 * Visual Review 23). "Review" opens the student, whose modal shows the frozen copy with
 * Approve / Decline (ShareRequestPanel), so the tutor always sees what the class would get
 * before approving; "Not now" declines straight away. Oldest request first.
 */
export default function ShareRequestsBanner({
  students = [],
  onReview,
  onDecline,
  // One slim line per request, as it sits in the compact student list below the help rows.
  compact = false,
}) {
  const requests = students
    .filter((student) => student.shareRequestedAt != null)
    .sort((a, b) => Number(a.shareRequestedAt) - Number(b.shareRequestedAt))
  if (requests.length === 0) return null
  return (
    <div style={compact ? s.wrapCompact : s.wrap} role="region" aria-label="Share requests">
      {requests.map((student) => (
        <div
          key={student.anonymousId}
          style={compact ? s.rowCompact : s.row}
          data-testid="share-request-banner"
          title={`${student.displayName} wants to share their work with the class`}
        >
          <span style={compact ? s.textCompact : s.text}>
            <span aria-hidden="true">📤</span> <strong>{student.displayName}</strong> wants to share
            {compact ? '' : ' their work with the class'}
          </span>
          <span style={s.actions}>
            <button
              type="button"
              className="btn-secondary"
              style={compact ? s.btnCompact : s.btn}
              onClick={() => onReview?.(student)}
              title="Open their share to check it, then approve or decline"
            >
              Review
            </button>
            {onDecline && (
              <button
                type="button"
                className="btn-ghost-outline"
                style={compact ? s.btnCompact : s.btn}
                onClick={() => onDecline(student.anonymousId)}
                aria-label="Not now"
                title="Not now: decline this share"
              >
                {compact ? '✕' : 'Not now'}
              </button>
            )}
          </span>
        </div>
      ))}
    </div>
  )
}

const s = {
  wrap: {
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '6px 8px',
    background: '#f0fdfa',
    borderBottom: '1px solid #99f6e4',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  text: {
    flex: '1 1 140px',
    minWidth: 0,
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    color: '#115e59',
    lineHeight: 1.3,
  },
  actions: { display: 'flex', gap: 4, flexShrink: 0 },
  btn: { fontSize: 12, padding: '5px 10px', minHeight: 32 },
  wrapCompact: { flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 },
  rowCompact: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    height: 28,
    padding: '0 4px 0 8px',
    borderRadius: 6,
    background: '#ccfbf1',
    border: '1px solid #99f6e4',
  },
  textCompact: {
    flex: 1,
    minWidth: 0,
    fontFamily: 'var(--font-body)',
    fontSize: '0.76rem',
    color: '#115e59',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  btnCompact: { fontSize: 11, padding: '1px 7px', minHeight: 22, height: 22 },
}
