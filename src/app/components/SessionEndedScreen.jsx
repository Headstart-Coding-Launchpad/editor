import React from 'react'

export default function SessionEndedScreen({ onContinueSolo }) {
  return (
    <div style={s.centreScreen}>
      <h2 style={s.title}>Session ended</h2>
      <p style={{ color: 'var(--colour-text)', fontFamily: 'var(--font-body)', marginBottom: 8 }}>
        Great work today! Your progress has been saved.
      </p>
      <p style={{ color: '#6b7280', fontFamily: 'var(--font-body)', fontSize: '0.9rem', marginBottom: 24 }}>
        Want to keep practising on your own?
      </p>
      <button
        className="btn-primary"
        style={{ padding: '12px 32px', fontSize: 15 }}
        onClick={onContinueSolo}
      >
        Continue Solo
      </button>
    </div>
  )
}

const s = {
  centreScreen: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: 16,
    padding: 32,
    textAlign: 'center',
  },
  title: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1.5rem',
    color: 'var(--colour-primary)',
  },
}
