import React, { useEffect, useRef, useState } from 'react'
import { FeedbackFields, StarRatingDisplay } from '../../components/StarRatingFeedbackFields'

// Lets the teacher rate the current task (stars + what worked / what didn't) live,
// as the class works through it, rather than only at end-of-session (see
// TeacherFeedbackForm in TeacherReportModal.jsx for that lesson-level equivalent).
// Ratings are written per task to session.taskRatingLog and folded into the
// session report by buildSessionReport (src/shared/lessonReport.js).
//
// The header is `position: sticky` (not just a JS scrollIntoView-on-open) so it
// stays pinned to the top of the teacher panel's own scroll area (TeacherView's
// <main>) once expanded, regardless of where the teacher was scrolled — expanding
// grows the body below it, which would otherwise push the header itself out of
// view with no way back to it short of scrolling manually. This relies on `wrap`
// NOT setting `overflow: hidden` (that would make `wrap` itself sticky's
// containing block instead of the real scroll container, since it never scrolls);
// the rounded corners are applied directly to `header`/`body` instead.
export default function TaskRatingPanel({ taskId, taskTitle, existingRating, onSave }) {
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(existingRating?.rating ?? 0)
  const [whatWorkedWell, setWhatWorkedWell] = useState(existingRating?.whatWorkedWell ?? '')
  const [whatDidntWork, setWhatDidntWork] = useState(existingRating?.whatDidntWork ?? '')
  const [saving, setSaving] = useState(false)

  // Reset the form to whatever's already saved whenever the teacher moves to a
  // different task, so this one panel instance can follow them through the lesson.
  // `existingRating` comes from the live session RTDB listener, which hands back
  // a brand-new object on every session update — including ones with nothing to
  // do with this rating (a student joining, running code, etc). Resetting on
  // object identity alone wiped out whatever the teacher was mid-typing any time
  // a student so much as breathed. Only reset when the task changes or the
  // rating's actual saved content changes, not on every unrelated snapshot.
  const lastSyncedKeyRef = useRef()
  useEffect(() => {
    const key = `${taskId}:${JSON.stringify(existingRating)}`
    if (key === lastSyncedKeyRef.current) return
    lastSyncedKeyRef.current = key
    setRating(existingRating?.rating ?? 0)
    setWhatWorkedWell(existingRating?.whatWorkedWell ?? '')
    setWhatDidntWork(existingRating?.whatDidntWork ?? '')
  }, [taskId, existingRating])

  async function handleSave() {
    setSaving(true)
    try {
      await onSave(taskId, { rating: rating > 0 ? rating : null, whatWorkedWell, whatDidntWork })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={styles.wrap}>
      <button
        style={{ ...styles.header, ...(open ? styles.headerOpen : styles.headerClosed) }}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span style={styles.title}>Rate This Task{taskTitle ? ` — ${taskTitle}` : ''}</span>
        {existingRating?.rating != null && (
          <StarRatingDisplay value={existingRating.rating} size="small" />
        )}
        <span style={styles.chevron}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={styles.body}>
          <FeedbackFields
            ratingLabel="How's this task going?"
            rating={rating}
            onRatingChange={setRating}
            whatWorkedWell={whatWorkedWell}
            onWhatWorkedWellChange={setWhatWorkedWell}
            whatDidntWork={whatDidntWork}
            onWhatDidntWorkChange={setWhatDidntWork}
          />
          <button
            className="btn-primary"
            style={styles.saveBtn}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save Rating'}
          </button>
        </div>
      )}
    </div>
  )
}

const styles = {
  wrap: {
    flexShrink: 0,
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
  },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 3,
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '9px 14px',
    background: '#f9fafb',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
  },
  headerClosed: { borderRadius: 8 },
  headerOpen: { borderRadius: '8px 8px 0 0', borderBottom: '1px solid #e5e7eb' },
  title: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.8rem',
    letterSpacing: '0.03em',
    color: 'var(--colour-primary)',
    marginRight: 'auto',
  },
  chevron: { fontSize: '0.65rem', color: '#9ca3af', flexShrink: 0 },
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: '12px 14px',
    borderRadius: '0 0 8px 8px',
  },
  saveBtn: { alignSelf: 'flex-start', fontSize: 13, padding: '6px 14px' },
}
