import React, { useState } from 'react'

export default function TaskFeedbackPanel({ feedback = [] }) {
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  if (feedback.length === 0) return null

  return (
    <section style={s.section}>
      <>
          <button
            type="button"
            style={s.feedbackHeader}
            onClick={() => setFeedbackOpen(o => !o)}
            aria-expanded={feedbackOpen}
          >
            <span style={s.feedbackTitle}>Teacher Feedback ({feedback.length})</span>
            <span style={{ ...s.chevron, transform: feedbackOpen ? 'rotate(180deg)' : 'none' }}>▾</span>
          </button>
          {feedbackOpen && (
            <div style={s.feedbackBody}>
              {feedback.map((item, i) => (
                <div key={i} style={s.feedbackItem}>
                  <div style={s.meta}>
                    <span style={s.email}>{item.teacherEmail}</span>
                    <span style={s.date}>{new Date(item.submittedAt).toLocaleString()}</span>
                  </div>
                  <p style={s.text}>{item.text}</p>
                </div>
              ))}
            </div>
          )}
      </>
    </section>
  )
}

const s = {
  section: {
    marginTop: 16,
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    overflow: 'hidden',
    maxWidth: 1120,
    marginLeft: 'auto',
    marginRight: 'auto',
    width: '100%',
  },
  feedbackHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 14px',
    background: '#f0fdf4',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
  },
  feedbackTitle: {
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.82rem',
    color: '#16a34a',
    flex: 1,
  },
  chevron: {
    marginLeft: 'auto',
    color: '#6b7280',
    fontSize: '1rem',
    lineHeight: 1,
    flexShrink: 0,
  },
  feedbackBody: {
    padding: '8px 14px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    background: '#fff',
    maxHeight: 320,
    overflowY: 'auto',
  },
  feedbackItem: {
    borderLeft: '3px solid #86efac',
    paddingLeft: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  meta: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
  },
  email: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.78rem',
    color: 'var(--colour-primary)',
  },
  date: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.75rem',
    color: '#9ca3af',
  },
  text: {
    margin: 0,
    fontFamily: 'var(--font-body)',
    fontSize: '0.86rem',
    color: 'var(--colour-text)',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
  },
}
