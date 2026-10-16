import React from 'react'
import EntryScreenCard, { centredBody } from './EntryScreenCard'

export default function WaitingRoom({ lessonTitle, lessonDescription, videoCallLink }) {
  // The words stay fixed (a cycling "." / ".." / "..." read as a typo when caught mid-cycle);
  // three bouncing dots after them show it is live. They stop under reduced motion.
  return (
    <EntryScreenCard
      title={lessonTitle}
      description={lessonDescription}
      cardStyle={s.card}
      bodyStyle={centredBody}
    >
      <p style={s.waiting}>
        Your tutor is getting ready
        <span className="activity-dots" style={s.dots} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </p>
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
  dots: { marginLeft: 2, verticalAlign: 'baseline' },
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
