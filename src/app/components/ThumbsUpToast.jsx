import React from 'react'

// The student's side of a teacher's 👍 (see useThumbsUp). Non-blocking: no button, no focus
// change, clicks pass through, and it announces politely to screen readers. Keyed on the push so
// a second 👍 pops in again.
export default function ThumbsUpToast({ shownAt }) {
  if (shownAt == null) return null
  return (
    <div style={s.wrap}>
      <div
        key={shownAt}
        className="motion-pop-in"
        style={s.toast}
        role="status"
        aria-live="polite"
        data-testid="thumbs-up-toast"
      >
        <span style={s.icon} aria-hidden="true">
          👍
        </span>
        <span style={s.text}>You&apos;re on the right track!</span>
      </div>
    </div>
  )
}

const s = {
  // The positioned wrapper keeps the centring off the animated element, whose keyframes set
  // their own transform.
  wrap: {
    position: 'fixed',
    top: 72,
    left: 0,
    right: 0,
    // Above the badge card layer (1240), below the nudge banner (1250).
    zIndex: 1245,
    display: 'flex',
    justifyContent: 'center',
    pointerEvents: 'none',
    padding: '0 16px',
  },
  toast: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: '#ecfdf5',
    border: '2px solid #10b981',
    borderRadius: 999,
    padding: '8px 18px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
    fontFamily: 'var(--font-body)',
    maxWidth: '100%',
  },
  icon: { fontSize: '1.5rem', lineHeight: 1 },
  text: { fontWeight: 700, color: '#065f46' },
}
