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

      {/* Live is how most students join, so it is the big, highlighted choice; solo is the
          quieter second option. */}
      <div style={s.liveCard} className="card">
        <span style={s.liveBadge}>🔴 Join a Live Lesson</span>
        <p style={s.liveText}>Join your live lesson with your tutor.</p>
        <button className="btn-primary" style={s.liveBtn} onClick={onJoinLive}>
          Join Live Lesson
        </button>
      </div>

      <div style={s.soloCard} className="card">
        <span style={s.soloBadge}>💻 Go Solo</span>
        <p style={s.soloText}>Practise on your own, or follow along with a recorded lesson.</p>
        <button className="btn-ghost-outline" style={s.soloBtn} onClick={onGoSolo}>
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
    border: '2px solid var(--colour-primary)',
    borderRadius: 16,
    padding: '22px 22px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    background: 'rgba(98, 34, 204, 0.04)',
  },
  liveBadge: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1.15rem',
    color: 'var(--colour-primary)',
  },
  liveText: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.98rem',
    lineHeight: 1.55,
    color: 'var(--colour-text)',
    margin: 0,
  },
  liveBtn: {
    alignSelf: 'stretch',
    fontSize: '1.05rem',
    padding: '12px 18px',
  },
  soloCard: {
    border: '2px solid var(--ui-border-neutral)',
    borderRadius: 14,
    padding: '16px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  soloBadge: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.95rem',
    color: 'var(--colour-text)',
  },
  soloText: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
    lineHeight: 1.5,
    color: 'var(--colour-muted)',
    margin: 0,
  },
  soloBtn: {
    alignSelf: 'flex-start',
    fontSize: '0.95rem',
    padding: '8px 18px',
  },
}
