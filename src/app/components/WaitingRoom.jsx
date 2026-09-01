import React, { useEffect, useState } from 'react'

export default function WaitingRoom({ lessonTitle, lessonDescription, videoCallLink }) {
  const [dots, setDots] = useState('.')

  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length < 3 ? d + '.' : '.'), 600)
    return () => clearInterval(t)
  }, [])

  return (
    <div style={s.page}>
      <div style={s.card} className="card">
        <div style={s.header}>
          <span style={s.logo}>Headstart Coding - LaunchPad</span>
          <h1 style={s.title}>{lessonTitle}</h1>
          {lessonDescription && (
            <p style={s.description}>{lessonDescription}</p>
          )}
        </div>
        <div style={s.body}>
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
        </div>
      </div>
    </div>
  )
}

const s = {
  page: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    background: 'linear-gradient(135deg, #d3c0f9 0%, #b89df5 100%)',
  },
  card: {
    width: 400,
    overflow: 'hidden',
    borderRadius: 12,
    boxShadow: '0 8px 30px rgba(98, 34, 204, 0.18), 0 4px 10px rgba(0, 0, 0, 0.06)',
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
  },
  description: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.95rem',
    lineHeight: 1.5,
    color: 'rgba(255, 255, 255, 0.86)',
    marginTop: 2,
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
