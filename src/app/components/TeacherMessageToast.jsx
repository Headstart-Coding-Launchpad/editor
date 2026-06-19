import React, { useEffect, useState } from 'react'

export default function TeacherMessageToast({ message, pushedAt }) {
  const [visible, setVisible] = useState(false)
  const [displayMessage, setDisplayMessage] = useState('')

  useEffect(() => {
    if (!pushedAt || !message) return
    setDisplayMessage(message)
    setVisible(true)
  }, [pushedAt])

  if (!visible || !displayMessage) return null

  return (
    <div style={s.wrap} role="dialog" aria-label="Message from your teacher">
      <div style={s.header}>
        <span style={s.icon}>✉</span>
        <span style={s.headerText}>Message from your teacher</span>
      </div>
      <div style={s.body}>
        <p style={s.message}>{displayMessage}</p>
      </div>
      <div style={s.footer}>
        <button className="btn-primary" onClick={() => setVisible(false)}>
          Got it!
        </button>
      </div>
    </div>
  )
}

const s = {
  wrap: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 1300,
    width: 'min(400px, 90vw)',
    borderRadius: 10,
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    fontFamily: 'var(--font-body)',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    background: 'var(--colour-primary)',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    borderRadius: '10px 10px 0 0',
  },
  icon: {
    fontSize: '1.1rem',
    lineHeight: 1,
  },
  headerText: {
    color: '#fff',
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1rem',
  },
  body: {
    background: 'var(--ui-surface)',
    padding: '18px 20px',
  },
  message: {
    color: 'var(--colour-text)',
    fontSize: '1rem',
    lineHeight: 1.6,
    margin: 0,
    fontFamily: 'var(--font-body)',
    whiteSpace: 'pre-wrap',
  },
  footer: {
    background: 'var(--ui-surface-soft)',
    padding: '12px 16px',
    display: 'flex',
    justifyContent: 'flex-end',
    borderTop: '1px solid var(--ui-border)',
    borderRadius: '0 0 10px 10px',
  },
}
