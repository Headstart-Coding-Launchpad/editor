import React from 'react'

export default function JoinSessionPrompt({ lessonTitle, onJoin, onDecline }) {
  return (
    <div style={s.overlay}>
      <div style={s.card} className="card">
        <div style={s.header}>
          <span style={s.logo}>Headstart Coding - LaunchPad</span>
          <h1 style={s.title}>{lessonTitle}</h1>
        </div>
        <div style={s.body}>
          <p style={s.message}>Your teacher has started a live session. Would you like to join?</p>
          <p style={s.sub}>Your solo work has been saved and you can continue it later.</p>
          <div style={s.buttons}>
            <button className="btn-primary" style={s.joinBtn} onClick={onJoin}>
              Join Session
            </button>
            <button type="button" onClick={onDecline} style={s.declineLink}>
              Continue Solo
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  card: {
    width: 420,
    overflow: 'hidden',
    borderRadius: 12,
    boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
  },
  header: {
    background: 'var(--colour-primary)',
    padding: '24px 28px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  logo: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.85rem',
    color: 'var(--colour-secondary)',
  },
  title: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1.4rem',
    color: '#fff',
    margin: 0,
  },
  body: {
    padding: '28px',
    background: '#fff',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    alignItems: 'center',
    textAlign: 'center',
  },
  message: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1rem',
    color: 'var(--colour-primary)',
    margin: 0,
  },
  sub: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
    color: '#6b7280',
    margin: 0,
    lineHeight: 1.5,
  },
  buttons: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    width: '100%',
  },
  joinBtn: {
    width: '100%',
    padding: '12px 0',
    fontSize: '1rem',
  },
  declineLink: {
    background: 'none',
    border: 'none',
    fontFamily: 'var(--font-body)',
    fontSize: '0.85rem',
    color: '#9ca3af',
    cursor: 'pointer',
    textDecoration: 'underline',
    padding: 0,
  },
}
