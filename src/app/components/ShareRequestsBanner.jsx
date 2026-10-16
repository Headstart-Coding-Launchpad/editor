import React from 'react'

/**
 * Students asking to share their work with the class (students.{id}.shareRequestedAt), as a
 * prompt above the student grid rather than only a small 📤 chip on their card (HSC Audit,
 * Visual Review 23). "Review" opens the student, whose modal shows the frozen copy with
 * Approve / Decline (ShareRequestPanel), so the tutor always sees what the class would get
 * before approving; "Not now" declines straight away. Oldest request first.
 */
export default function ShareRequestsBanner({ students = [], onReview, onDecline }) {
  const requests = students
    .filter((student) => student.shareRequestedAt != null)
    .sort((a, b) => Number(a.shareRequestedAt) - Number(b.shareRequestedAt))
  if (requests.length === 0) return null
  return (
    <div style={s.wrap} role="region" aria-label="Share requests">
      {requests.map((student) => (
        <div key={student.anonymousId} style={s.row} data-testid="share-request-banner">
          <span style={s.text}>
            <span aria-hidden="true">📤</span> <strong>{student.displayName}</strong> wants to share
            their work with the class
          </span>
          <span style={s.actions}>
            <button
              type="button"
              className="btn-secondary"
              style={s.btn}
              onClick={() => onReview?.(student)}
              title="Open their share to check it, then approve or decline"
            >
              Review
            </button>
            {onDecline && (
              <button
                type="button"
                className="btn-ghost-outline"
                style={s.btn}
                onClick={() => onDecline(student.anonymousId)}
              >
                Not now
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
}
