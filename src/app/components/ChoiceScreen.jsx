import React from 'react'
import EntryScreenCard from './EntryScreenCard'

export default function ChoiceScreen({ lessonTitle, lessonDescription, onJoinLive, onGoSolo }) {
  return (
    <EntryScreenCard
      title={lessonTitle}
      description={lessonDescription}
      cardStyle={s.card}
      pageStyle={s.page}
      cardClassName={null}
    >
      <p style={s.prompt}>How would you like to join this lesson?</p>

      <div style={s.liveCard} className="card">
        <span style={s.liveBadge}>🔴 Join a Live Lesson</span>
        <p style={s.liveText}>Join your scheduled live lesson with a teacher.</p>
        <button className="btn-primary" style={s.liveBtn} onClick={onJoinLive}>
          Wait for Teacher
        </button>
      </div>

      <div style={s.soloCard} className="card">
        <span style={s.soloBadge}>💻 Go Solo</span>
        <p style={s.soloText}>Practice on your own, or follow along with a pre-recorded lesson.</p>
        <button className="btn-primary" style={s.soloBtn} onClick={onGoSolo}>
          Start Solo
        </button>
      </div>
    </EntryScreenCard>
  )
}

const s = {
  page: { overflow: 'auto', padding: '24px 16px' },
  card: { width: 440 },
  prompt: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1.05rem',
    color: 'var(--colour-text)',
    textAlign: 'center',
    margin: 0,
  },
  liveCard: {
    border: '2px solid #e5e7eb',
    borderRadius: 14,
    padding: '16px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  liveBadge: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.95rem',
    color: 'var(--colour-text)',
  },
  liveText: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.88rem',
    lineHeight: 1.5,
    color: '#6b7280',
    margin: 0,
  },
  liveBtn: {
    alignSelf: 'flex-start',
    fontSize: '0.9rem',
    padding: '8px 16px',
  },
  soloCard: {
    border: '2px solid var(--colour-primary)',
    borderRadius: 16,
    padding: '22px 22px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    background: 'rgba(98, 34, 204, 0.04)',
  },
  soloBadge: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1.15rem',
    color: 'var(--colour-primary)',
  },
  soloText: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.98rem',
    lineHeight: 1.55,
    color: 'var(--colour-text)',
    margin: 0,
  },
  soloBtn: {
    alignSelf: 'stretch',
    fontSize: '1.05rem',
    padding: '12px 18px',
  },
}
