import React, { useState } from 'react'

export default function MessageCompose({ student, onSendMessage, isOpen, onClose }) {
  const [text, setText] = useState('')

  function handleSend() {
    const trimmed = text.trim()
    if (!trimmed) return
    onSendMessage(student.anonymousId, trimmed)
    onClose()
    setText('')
  }

  if (!isOpen) return null

  return (
    <div
      style={s.overlay}
      onClick={e => { if (e.target === e.currentTarget) { onClose(); setText('') } }}
    >
      <div style={s.modal}>
        <div style={s.header}>
          <span style={s.title}>Message {student.displayName}</span>
          <button style={s.closeBtn} onClick={() => { onClose(); setText('') }}>✕</button>
        </div>
        <div style={s.body}>
          <p style={s.hint}>A friendly pop-up will appear on {student.displayName}&apos;s screen.</p>
          <textarea
            style={s.textarea}
            placeholder='e.g. "Great work so far!" or "Try a different approach…"'
            value={text}
            onChange={e => setText(e.target.value)}
            rows={4}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSend() }}
          />
          <p style={s.hint2}>Ctrl+Enter to send</p>
        </div>
        <div style={s.footer}>
          <button className="btn-ghost-outline" style={{ fontSize: 13 }} onClick={() => { onClose(); setText('') }}>
            Cancel
          </button>
          <button className="btn-primary" style={{ fontSize: 13 }} onClick={handleSend} disabled={!text.trim()}>
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 1200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    background: 'var(--ui-surface)',
    borderRadius: 10,
    width: 'min(460px, 92vw)',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  header: {
    background: 'var(--colour-primary)',
    color: '#fff',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
    borderRadius: '10px 10px 0 0',
  },
  title: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1rem',
  },
  closeBtn: {
    background: 'rgba(255,255,255,0.15)',
    border: '1px solid rgba(255,255,255,0.3)',
    color: '#fff',
    borderRadius: 5,
    width: 28,
    height: 28,
    fontSize: '0.85rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  body: {
    padding: '16px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  hint: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.88rem',
    color: 'var(--colour-text)',
    margin: 0,
  },
  hint2: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.78rem',
    color: '#9ca3af',
    margin: 0,
    textAlign: 'right',
  },
  textarea: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
    padding: '10px 12px',
    resize: 'vertical',
    width: '100%',
    lineHeight: 1.5,
  },
  footer: {
    padding: '12px 16px',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    borderTop: '1px solid var(--ui-border)',
    flexShrink: 0,
    borderRadius: '0 0 10px 10px',
  },
}
