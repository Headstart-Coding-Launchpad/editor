import React, { useState } from 'react'
import { canShowNudgeNotification, NUDGE_NOTIFICATIONS_DISMISSED_KEY } from '../nudgeAlert'

// In-page half of a teacher nudge (the tab flash / chime / OS notification
// are driven by useNudgeAlert).
export function NudgeBanner({ onDismiss }) {
  return (
    <div style={s.banner} role="alert">
      <span style={s.bannerIcon}>👋</span>
      <span style={s.bannerText}>Your teacher is asking for your attention.</span>
      <button className="btn-primary" style={s.bannerBtn} onClick={onDismiss}>
        I&apos;m here!
      </button>
    </div>
  )
}

function readDismissed() {
  try {
    return localStorage.getItem(NUDGE_NOTIFICATIONS_DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

// One-time opt-in so a nudge can reach a student who has switched to another
// window. Browsers only remember the choice per site, so "Not now" is kept in
// localStorage to stop the prompt reappearing every lesson.
export function NudgePermissionPrompt() {
  const [hidden, setHidden] = useState(
    () =>
      !canShowNudgeNotification() || window.Notification.permission !== 'default' || readDismissed()
  )
  if (hidden) return null

  function dismiss() {
    try {
      localStorage.setItem(NUDGE_NOTIFICATIONS_DISMISSED_KEY, '1')
    } catch {
      // Storage blocked: the prompt just comes back next time.
    }
    setHidden(true)
  }

  async function allow() {
    try {
      await window.Notification.requestPermission()
    } catch {
      // Older Safari uses a callback form; treat any failure as "not now".
    }
    setHidden(true)
  }

  return (
    <div style={s.prompt} role="region" aria-label="Allow notifications">
      <span>🔔 Let your teacher nudge you when you switch windows?</span>
      <button className="btn-primary" style={s.promptBtn} onClick={allow}>
        Allow
      </button>
      <button className="btn-ghost-outline" style={s.promptBtn} onClick={dismiss}>
        Not now
      </button>
    </div>
  )
}

const s = {
  banner: {
    position: 'fixed',
    top: 64,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 1250,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: '#fffbeb',
    border: '2px solid #f59e0b',
    borderRadius: 10,
    padding: '10px 14px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
    fontFamily: 'var(--font-body)',
    maxWidth: 'calc(100vw - 32px)',
  },
  bannerIcon: { fontSize: '1.5rem' },
  bannerText: { fontWeight: 600, color: '#78350f' },
  bannerBtn: { fontSize: 13, padding: '6px 12px', whiteSpace: 'nowrap' },
  prompt: {
    position: 'fixed',
    bottom: 16,
    left: 16,
    zIndex: 1200,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    padding: '8px 12px',
    boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
    fontFamily: 'var(--font-body)',
    fontSize: '0.85rem',
    maxWidth: 'calc(100vw - 32px)',
  },
  promptBtn: { fontSize: 12, padding: '4px 10px' },
}
