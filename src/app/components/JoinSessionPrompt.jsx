import React from 'react'
import EntryScreenCard, { centredBody, ghostLink } from './EntryScreenCard'

export default function JoinSessionPrompt({ lessonTitle, onJoin, onDecline }) {
  return (
    <EntryScreenCard overlay title={lessonTitle} cardStyle={s.card} bodyStyle={centredBody}>
      <p style={s.message}>Your teacher has started a live session. Would you like to join?</p>
      <p style={s.sub}>Your solo work has been saved and you can continue it later.</p>
      <div style={s.buttons}>
        <button className="btn-primary" style={s.joinBtn} onClick={onJoin}>
          Join Session
        </button>
        <button type="button" onClick={onDecline} style={ghostLink}>
          Continue Solo
        </button>
      </div>
    </EntryScreenCard>
  )
}

const s = {
  card: { width: 420, borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.25)' },
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
}
