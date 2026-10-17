import React, { useState } from 'react'
import { FeedbackFields } from './StarRatingFeedbackFields'

// The one after-class feedback step: lesson rating, "what worked well", "what didn't work",
// and optional notes about individual tasks. Used inline in the session report and in the
// short step shown before "End & Go to Home".
export default function AfterClassFeedbackForm({
  initial,
  tasks = [],
  onSave,
  onSkip,
  saveLabel = 'Save Feedback',
}) {
  const [rating, setRating] = useState(initial?.rating ?? 0)
  const [whatWorkedWell, setWhatWorkedWell] = useState(initial?.whatWorkedWell ?? '')
  const [whatDidntWork, setWhatDidntWork] = useState(initial?.whatDidntWork ?? '')
  const [taskNotes, setTaskNotes] = useState([])
  const [pickedTaskId, setPickedTaskId] = useState('')
  const [noteText, setNoteText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function addNote() {
    const text = noteText.trim()
    const task = tasks.find((t) => String(t.taskId) === pickedTaskId)
    if (!text || !task) return
    setTaskNotes((prev) => [...prev, { taskId: task.taskId, taskTitle: task.title, text }])
    setNoteText('')
    setPickedTaskId('')
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    // A note typed but not yet added still counts.
    const pending = tasks.find((t) => String(t.taskId) === pickedTaskId)
    const allNotes =
      noteText.trim() && pending
        ? [
            ...taskNotes,
            { taskId: pending.taskId, taskTitle: pending.title, text: noteText.trim() },
          ]
        : taskNotes
    try {
      await onSave({ rating: rating > 0 ? rating : null, whatWorkedWell, whatDidntWork }, allNotes)
      setTaskNotes([])
      setNoteText('')
      setPickedTaskId('')
    } catch (err) {
      setError(err?.message || 'Could not save feedback.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={s.box}>
      <p style={s.intro}>Optional: rate this lesson run and leave any notes for next time.</p>

      <FeedbackFields
        ratingLabel="How did this lesson go?"
        rating={rating}
        onRatingChange={setRating}
        whatWorkedWell={whatWorkedWell}
        onWhatWorkedWellChange={setWhatWorkedWell}
        whatDidntWork={whatDidntWork}
        onWhatDidntWorkChange={setWhatDidntWork}
      />

      {tasks.length > 0 && (
        <div style={s.notes}>
          <span style={s.label}>Notes about a task (optional)</span>
          {taskNotes.map((note, i) => (
            <div key={i} style={s.noteRow}>
              <span>
                <strong>{note.taskTitle}</strong>: {note.text}
              </span>
              <button
                type="button"
                className="btn-ghost-outline"
                style={s.smallBtn}
                aria-label={`Remove note about ${note.taskTitle}`}
                onClick={() => setTaskNotes((prev) => prev.filter((_, j) => j !== i))}
              >
                Remove
              </button>
            </div>
          ))}
          <select
            style={s.input}
            aria-label="Task for note"
            value={pickedTaskId}
            onChange={(e) => setPickedTaskId(e.target.value)}
          >
            <option value="">Pick a task…</option>
            {tasks.map((t) => (
              <option key={t.taskId} value={String(t.taskId)}>
                {t.title}
              </option>
            ))}
          </select>
          <textarea
            style={s.input}
            rows={2}
            aria-label="Task note"
            placeholder="What should change about this task?"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
          />
          <button
            type="button"
            className="btn-ghost-outline"
            style={s.smallBtn}
            onClick={addNote}
            disabled={!pickedTaskId || !noteText.trim()}
          >
            Add task note
          </button>
        </div>
      )}

      {error && <p style={s.error}>{error}</p>}
      <div style={s.actions}>
        <button className="btn-primary" style={s.btn} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : saveLabel}
        </button>
        {onSkip && (
          <button className="btn-ghost-outline" style={s.btn} onClick={onSkip} disabled={saving}>
            Skip
          </button>
        )}
      </div>
    </div>
  )
}

const s = {
  box: {
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    background: '#f9fafb',
  },
  intro: { fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#6b7280', margin: 0 },
  notes: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.75rem',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  noteRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 8,
    fontFamily: 'var(--font-body)',
    fontSize: '0.85rem',
  },
  input: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.88rem',
    padding: '6px 8px',
    border: '1px solid #d1d5db',
    borderRadius: 6,
  },
  smallBtn: { alignSelf: 'flex-start', fontSize: 12, padding: '4px 10px' },
  actions: { display: 'flex', gap: 8 },
  btn: { fontSize: 13, padding: '6px 14px' },
  error: { fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#dc2626', margin: 0 },
}
