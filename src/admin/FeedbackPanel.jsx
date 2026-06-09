import React, { useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { firestore } from '../shared/firebase'

export default function FeedbackPanel() {
  const [feedback, setFeedback] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(firestore, 'platformFeedback'), orderBy('submittedAt', 'desc'))
    const unsub = onSnapshot(q, snap => {
      setFeedback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, () => setLoading(false))
    return () => unsub()
  }, [])

  if (loading) return <p style={s.empty}>Loading…</p>
  if (feedback.length === 0) return <p style={s.empty}>No platform feedback yet.</p>

  return (
    <div style={s.wrap}>
      <h2 style={s.heading}>Platform Feedback</h2>
      <div style={s.list}>
        {feedback.map(item => (
          <div key={item.id} style={s.card}>
            <div style={s.cardMeta}>
              <span style={s.email}>{item.teacherEmail}</span>
              <span style={s.date}>{new Date(item.submittedAt).toLocaleString()}</span>
            </div>
            {item.lessonTitle && (
              <div style={s.context}>
                {item.lessonTitle}{item.taskTitle ? ` — ${item.taskTitle}` : ''}
              </div>
            )}
            <p style={s.text}>{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

const s = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  heading: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1.1rem',
    color: 'var(--colour-text)',
    margin: 0,
  },
  empty: {
    fontFamily: 'var(--font-body)',
    color: '#6b7280',
    fontSize: '0.95rem',
    margin: 0,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  cardMeta: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
  },
  email: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.85rem',
    color: 'var(--colour-primary)',
  },
  date: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    color: '#9ca3af',
  },
  context: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    color: '#6b7280',
    fontStyle: 'italic',
  },
  text: {
    margin: 0,
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
    color: 'var(--colour-text)',
    lineHeight: 1.55,
    whiteSpace: 'pre-wrap',
  },
}
