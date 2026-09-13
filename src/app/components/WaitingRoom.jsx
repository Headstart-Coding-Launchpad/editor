import React, { useEffect, useState } from 'react'
import EntryScreenCard, { centredBody } from './EntryScreenCard'

export default function WaitingRoom({ lessonTitle, lessonDescription, videoCallLink }) {
  const [dots, setDots] = useState('.')

  useEffect(() => {
    const t = setInterval(() => setDots((d) => (d.length < 3 ? d + '.' : '.')), 600)
    return () => clearInterval(t)
  }, [])

  return (
    <EntryScreenCard
      title={lessonTitle}
      description={lessonDescription}
      cardStyle={s.card}
      bodyStyle={centredBody}
    >
      <p style={s.waiting}>Your teacher is getting ready{dots}</p>
      <p style={s.sub}>The session will start shortly. Sit tight!</p>
      {videoCallLink && (
        <div style={s.videoBox}>
          <p style={s.videoTitle}>📹 Video Call</p>
          <p style={s.videoText}>Have you joined the video call yet? If not, join here:</p>
          <a
            className="btn-primary"
            style={s.videoBtn}
            href={videoCallLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            📹 Join Video Call
          </a>
        </div>
      )}
    </EntryScreenCard>
  )
}

const s = {
  card: { borderRadius: 12 },
  waiting: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1.1rem',
    color: 'var(--colour-primary)',
    minHeight: '1.5em',
  },
  sub: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.95rem',
    color: 'var(--colour-text)',
    lineHeight: 1.6,
  },
  videoBox: {
    marginTop: 8,
    width: '100%',
    borderTop: '1px solid #e5e7eb',
    paddingTop: 16,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  },
  videoTitle: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.95rem',
    color: 'var(--colour-text)',
    margin: 0,
  },
  videoText: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.88rem',
    color: '#6b7280',
    margin: 0,
    lineHeight: 1.5,
  },
  videoBtn: {
    marginTop: 4,
    fontSize: '0.9rem',
    padding: '8px 18px',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
  },
}
