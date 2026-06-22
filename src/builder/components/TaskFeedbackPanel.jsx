import React, { useState, useEffect } from 'react'

const DECISION_OPTIONS = [
  { value: 'pending', label: 'Pending', color: '#6b7280', bg: '#f9fafb' },
  { value: 'accepted', label: 'Accepted', color: '#16a34a', bg: '#f0fdf4' },
  { value: 'rejected', label: 'Rejected', color: '#ef4444', bg: '#fef2f2' },
]

export default function TaskFeedbackPanel({ task, onUpdateTask, feedback = [] }) {
  const reviewNote = task?.reviewNote ?? {}
  const [decision, setDecision] = useState(reviewNote.decision ?? 'pending')
  const [suggestedChange, setSuggestedChange] = useState(reviewNote.suggestedChange ?? '')
  const [extraNote, setExtraNote] = useState(reviewNote.extraNote ?? '')
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  useEffect(() => {
    const rn = task?.reviewNote ?? {}
    setDecision(rn.decision ?? 'pending')
    setSuggestedChange(rn.suggestedChange ?? '')
    setExtraNote(rn.extraNote ?? '')
  }, [task?.id])

  function handleSave() {
    onUpdateTask?.({ ...task, reviewNote: { decision, suggestedChange, extraNote } })
  }

  const reviewNoteDirty =
    decision !== (reviewNote.decision ?? 'pending') ||
    suggestedChange !== (reviewNote.suggestedChange ?? '') ||
    extraNote !== (reviewNote.extraNote ?? '')

  if (!task && feedback.length === 0) return null

  return (
    <section style={s.section}>
      {task && (
        <div style={{ ...s.reviewBlock, ...(feedback.length > 0 ? { borderBottom: '1px solid #e5e7eb' } : {}) }}>
          <div style={s.reviewHeader}>
            <span style={s.reviewTitle}>Review note</span>
            {reviewNoteDirty && (
              <button type="button" style={s.saveBtn} onClick={handleSave}>
                Save
              </button>
            )}
          </div>

          <div style={s.decisionRow}>
            {DECISION_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                style={{
                  ...s.decisionBtn,
                  background: decision === opt.value ? opt.bg : '#f9fafb',
                  color: decision === opt.value ? opt.color : '#9ca3af',
                  borderColor: decision === opt.value ? opt.color : '#e5e7eb',
                  fontWeight: decision === opt.value ? 700 : 400,
                }}
                onClick={() => setDecision(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <textarea
            style={{ ...s.textarea, marginTop: 8 }}
            rows={2}
            value={suggestedChange}
            onChange={e => setSuggestedChange(e.target.value)}
            placeholder="Suggested change (optional)"
          />

          <textarea
            style={{ ...s.textarea, marginTop: 6 }}
            rows={2}
            value={extraNote}
            onChange={e => setExtraNote(e.target.value)}
            placeholder="Extra note (optional)"
          />
        </div>
      )}

      {feedback.length > 0 && (
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
      )}
    </section>
  )
}

const s = {
  section: {
    marginTop: 16,
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    overflow: 'hidden',
  },
  reviewBlock: {
    padding: '12px 14px',
    background: '#fff',
  },
  reviewHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  reviewTitle: {
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.82rem',
    color: '#374151',
  },
  saveBtn: {
    padding: '3px 10px',
    background: 'var(--colour-primary)',
    color: '#fff',
    border: 'none',
    borderRadius: 5,
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
  },
  decisionRow: {
    display: 'flex',
    gap: 6,
  },
  decisionBtn: {
    flex: 1,
    padding: '5px 8px',
    border: '1px solid',
    borderRadius: 6,
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    fontSize: '0.78rem',
    transition: 'all 0.1s',
  },
  textarea: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '6px 8px',
    fontFamily: 'var(--font-body)',
    fontSize: '0.83rem',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    resize: 'vertical',
    color: '#374151',
    outline: 'none',
    lineHeight: 1.5,
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
