import React from 'react'

export default function VideoCallPrompt({ videoCallLink, onDismiss }) {
  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        <div style={s.header}>
          <span style={s.icon}>📹</span>
          <span style={s.title}>Your teacher wants you on the video call</span>
        </div>
        <div style={s.footer}>
          <button className="btn-ghost-outline" style={{ fontSize: 13 }} onClick={onDismiss}>
            Not now
          </button>
          <a
            className="btn-primary"
            style={s.joinBtn}
            href={videoCallLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onDismiss}
          >
            📹 Join Video Call
          </a>
        </div>
      </div>
    </div>
  )
}

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.55)',
    zIndex: 1300,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    background: 'var(--ui-surface)',
    borderRadius: 10,
    width: 'min(420px, 92vw)',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    fontFamily: 'var(--font-body)',
  },
  header: {
    background: '#0f766e',
    padding: '18px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    borderRadius: '10px 10px 0 0',
  },
  icon: { fontSize: '1.2rem', lineHeight: 1 },
  title: {
    color: '#fff',
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1.05rem',
    lineHeight: 1.4,
  },
  footer: {
    padding: '16px 20px',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
  },
  joinBtn: {
    fontSize: 13,
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
  },
}
