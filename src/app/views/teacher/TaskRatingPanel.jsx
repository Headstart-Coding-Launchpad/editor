import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FeedbackFields } from '../../components/StarRatingFeedbackFields'

const POPOVER_MAX_WIDTH = 360
const VIEWPORT_MARGIN = 8

// Lets the teacher rate the current task (stars + what worked / what didn't) live,
// as the class works through it, rather than only at end-of-session (see
// TeacherFeedbackForm in TeacherReportModal.jsx for that lesson-level equivalent).
// Ratings are written per task to session.taskRatingLog and folded into the
// session report by buildSessionReport (src/shared/lessonReport.js).
//
// Rendered as a "⭐ Rate this task" button in TeacherView's top bar that opens the
// form in a popover. It used to be an inline collapsible panel in the centre
// column, where expanding it squeezed or clipped whatever task workspace sat above
// it (fill-height modules, activities, quizzes that scale to fit). The popover is
// portalled to <body> with `position: fixed` so no `overflow: hidden` ancestor can
// clip it and it never takes part in the workspace's layout.
export default function TaskRatingPanel({ taskId, taskTitle, existingRating, onSave }) {
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(existingRating?.rating ?? 0)
  const [whatWorkedWell, setWhatWorkedWell] = useState(existingRating?.whatWorkedWell ?? '')
  const [whatDidntWork, setWhatDidntWork] = useState(existingRating?.whatDidntWork ?? '')
  const [saving, setSaving] = useState(false)
  const [position, setPosition] = useState(null)
  const buttonRef = useRef(null)
  const popoverRef = useRef(null)
  const popoverId = useId()

  // Reset the form to whatever's already saved whenever the teacher moves to a
  // different task, so this one instance can follow them through the lesson.
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

  // The rating is per task: moving to another task closes the popover.
  useEffect(() => {
    setOpen(false)
  }, [taskId])

  function closeAndRefocus() {
    setOpen(false)
    buttonRef.current?.focus()
  }

  // Anchor below the button, clamped inside the viewport so it still fits when the
  // top bar wraps at narrow widths and the button lands near the left edge.
  useLayoutEffect(() => {
    if (!open) return
    function place() {
      const rect = buttonRef.current?.getBoundingClientRect()
      if (!rect) return
      const vw = window.innerWidth
      const vh = window.innerHeight
      const width = Math.min(POPOVER_MAX_WIDTH, vw - VIEWPORT_MARGIN * 2)
      const left = Math.max(
        VIEWPORT_MARGIN,
        Math.min(rect.right - width, vw - width - VIEWPORT_MARGIN)
      )
      const top = rect.bottom + 6
      setPosition({ top, left, width, maxHeight: Math.max(160, vh - top - VIEWPORT_MARGIN) })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  // Move focus into the popover when it opens.
  useEffect(() => {
    if (!open) return
    const first = popoverRef.current?.querySelector('button, textarea, input')
    first?.focus()
  }, [open])

  // Outside click closes without stealing focus from whatever was clicked; Escape
  // closes and hands focus back to the button.
  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (buttonRef.current?.contains(e.target) || popoverRef.current?.contains(e.target)) return
      setOpen(false)
    }
    function onKey(e) {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function handleSave() {
    setSaving(true)
    try {
      await onSave(taskId, { rating: rating > 0 ? rating : null, whatWorkedWell, whatDidntWork })
      closeAndRefocus()
    } finally {
      setSaving(false)
    }
  }

  const savedRating = existingRating?.rating ?? null
  const buttonLabel = savedRating != null ? `⭐ ${savedRating}` : '⭐ Rate this task'
  const accessibleName =
    savedRating != null ? `Rate this task (rated ${savedRating} out of 5)` : 'Rate this task'

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="btn-ghost teacher-session-controls__action"
        style={styles.trigger}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? popoverId : undefined}
        aria-label={accessibleName}
        title={accessibleName}
      >
        {buttonLabel}
      </button>
      {open &&
        createPortal(
          <div
            ref={popoverRef}
            id={popoverId}
            role="dialog"
            aria-label={`Rate this task${taskTitle ? ` — ${taskTitle}` : ''}`}
            className="ui-popover"
            style={{
              ...styles.popover,
              ...(position ?? { top: 0, left: 0, visibility: 'hidden' }),
            }}
          >
            <span style={styles.title}>Rate This Task{taskTitle ? ` — ${taskTitle}` : ''}</span>
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
              type="button"
              className="btn-primary"
              style={styles.saveBtn}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save Rating'}
            </button>
          </div>,
          document.body
        )}
    </>
  )
}

const styles = {
  trigger: { whiteSpace: 'nowrap', flexShrink: 0 },
  popover: {
    position: 'fixed',
    zIndex: 300,
    boxSizing: 'border-box',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: '12px 14px',
    background: '#fff',
    color: 'var(--colour-text)',
    boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
    borderRadius: 8,
  },
  title: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.8rem',
    letterSpacing: '0.03em',
    color: 'var(--colour-primary)',
  },
  saveBtn: { alignSelf: 'flex-start', fontSize: 13, padding: '6px 14px' },
}
