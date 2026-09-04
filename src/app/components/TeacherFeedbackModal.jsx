import React, { useEffect, useRef, useState } from 'react'
import { addDoc, collection } from 'firebase/firestore'
import { firestore } from '../../shared/firebase'

export default function TeacherFeedbackModal({
  lessonId,
  lessonTitle,
  currentTaskId,
  currentTaskTitle,
  teacherEmail,
  onClose,
}) {
  const overlayRef = useRef(null)
  const [activeTab, setActiveTab] = useState('lesson')
  const [lessonText, setLessonText] = useState('')
  const [taskText, setTaskText] = useState('')
  const [platformText, setPlatformText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(null) // null | 'lesson' | 'task' | 'platform'
  const [submitError, setSubmitError] = useState(null)

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSubmitLesson() {
    if (!lessonText.trim()) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await addDoc(collection(firestore, 'lessons', lessonId, 'feedback'), {
        lessonId,
        lessonTitle: lessonTitle ?? '',
        taskId: null,
        taskTitle: null,
        text: lessonText.trim(),
        teacherEmail: teacherEmail ?? '',
        submittedAt: Date.now(),
      })
      setLessonText('')
      setSubmitted('lesson')
      setTimeout(() => setSubmitted(null), 2500)
    } catch (err) {
      setSubmitError(err.message || 'Could not submit feedback.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmitTask() {
    if (!taskText.trim()) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await addDoc(collection(firestore, 'lessons', lessonId, 'feedback'), {
        lessonId,
        lessonTitle: lessonTitle ?? '',
        taskId: currentTaskId ?? null,
        taskTitle: currentTaskTitle ?? null,
        text: taskText.trim(),
        teacherEmail: teacherEmail ?? '',
        submittedAt: Date.now(),
      })
      setTaskText('')
      setSubmitted('task')
      setTimeout(() => setSubmitted(null), 2500)
    } catch (err) {
      setSubmitError(err.message || 'Could not submit feedback.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmitPlatform() {
    if (!platformText.trim()) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await addDoc(collection(firestore, 'platformFeedback'), {
        lessonId: lessonId ?? null,
        lessonTitle: lessonTitle ?? null,
        taskId: currentTaskId ?? null,
        taskTitle: currentTaskTitle ?? null,
        text: platformText.trim(),
        teacherEmail: teacherEmail ?? '',
        submittedAt: Date.now(),
      })
      setPlatformText('')
      setSubmitted('platform')
      setTimeout(() => setSubmitted(null), 2500)
    } catch (err) {
      setSubmitError(err.message || 'Could not submit feedback.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      ref={overlayRef}
      style={s.overlay}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose?.()
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Submit feedback"
    >
      <div style={s.modal}>
        <div style={s.header}>
          <span style={s.title}>Feedback</span>
          <button className="btn-ghost" style={s.closeBtn} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div style={s.tabs}>
          <button
            style={{ ...s.tab, ...(activeTab === 'lesson' ? s.tabActive : {}) }}
            onClick={() => {
              setActiveTab('lesson')
              setSubmitError(null)
            }}
          >
            Lesson Feedback
          </button>
          {currentTaskTitle && (
            <button
              style={{ ...s.tab, ...(activeTab === 'task' ? s.tabActive : {}) }}
              onClick={() => {
                setActiveTab('task')
                setSubmitError(null)
              }}
            >
              Task Feedback
            </button>
          )}
          <button
            style={{ ...s.tab, ...(activeTab === 'platform' ? s.tabActive : {}) }}
            onClick={() => {
              setActiveTab('platform')
              setSubmitError(null)
            }}
          >
            Platform Feedback
          </button>
        </div>

        <div style={s.body}>
          {activeTab === 'lesson' ? (
            <>
              <p style={s.context}>
                <strong>{lessonTitle}</strong>
              </p>
              <p style={s.hint}>
                Feedback about the lesson as a whole — saved with the lesson and visible in the
                builder.
              </p>
              <textarea
                style={s.textarea}
                placeholder="What worked well? What could be improved? Any general issues with the lesson?"
                value={lessonText}
                onChange={(e) => setLessonText(e.target.value)}
                rows={6}
                autoFocus
              />
              {submitted === 'lesson' && <p style={s.successMsg}>Submitted!</p>}
              {submitError && <p style={s.errorMsg}>{submitError}</p>}
              <div style={s.actions}>
                <button className="btn-ghost" style={s.cancelBtn} onClick={onClose}>
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  style={s.submitBtn}
                  onClick={handleSubmitLesson}
                  disabled={submitting || !lessonText.trim()}
                >
                  {submitting ? 'Submitting…' : 'Submit Lesson Feedback'}
                </button>
              </div>
            </>
          ) : activeTab === 'task' ? (
            <>
              <p style={s.context}>
                <strong>{lessonTitle}</strong>
                {currentTaskTitle ? ` — Task: ${currentTaskTitle}` : ''}
              </p>
              <p style={s.hint}>
                Feedback specific to this task — saved with the task and visible in the builder.
              </p>
              <textarea
                style={s.textarea}
                placeholder="What worked well? What could be improved? Any issues with this task?"
                value={taskText}
                onChange={(e) => setTaskText(e.target.value)}
                rows={6}
                autoFocus={activeTab === 'task'}
              />
              {submitted === 'task' && <p style={s.successMsg}>Submitted!</p>}
              {submitError && <p style={s.errorMsg}>{submitError}</p>}
              <div style={s.actions}>
                <button className="btn-ghost" style={s.cancelBtn} onClick={onClose}>
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  style={s.submitBtn}
                  onClick={handleSubmitTask}
                  disabled={submitting || !taskText.trim()}
                >
                  {submitting ? 'Submitting…' : 'Submit Task Feedback'}
                </button>
              </div>
            </>
          ) : (
            <>
              <p style={s.hint}>Feedback about the platform itself — visible only to admins.</p>
              {currentTaskTitle && (
                <p style={s.context}>
                  Context: <strong>{lessonTitle}</strong> — Task:{' '}
                  <strong>{currentTaskTitle}</strong>
                </p>
              )}
              <textarea
                style={s.textarea}
                placeholder="Report a bug, suggest a feature, or share any other platform feedback…"
                value={platformText}
                onChange={(e) => setPlatformText(e.target.value)}
                rows={6}
                autoFocus={activeTab === 'platform'}
              />
              {submitted === 'platform' && <p style={s.successMsg}>Submitted!</p>}
              {submitError && <p style={s.errorMsg}>{submitError}</p>}
              <div style={s.actions}>
                <button className="btn-ghost" style={s.cancelBtn} onClick={onClose}>
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  style={s.submitBtn}
                  onClick={handleSubmitPlatform}
                  disabled={submitting || !platformText.trim()}
                >
                  {submitting ? 'Submitting…' : 'Submit Platform Feedback'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1100,
    padding: 24,
  },
  modal: {
    background: '#fff',
    borderRadius: 12,
    width: 'min(560px, 92vw)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  header: {
    background: 'var(--colour-primary)',
    color: '#fff',
    padding: '12px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
  },
  title: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1.05rem',
  },
  closeBtn: {
    fontSize: 13,
    padding: '5px 10px',
    color: 'rgba(255,255,255,0.8)',
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid #e5e7eb',
    background: '#f9fafb',
    flexShrink: 0,
  },
  tab: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.88rem',
    padding: '10px 18px',
    border: 'none',
    borderBottom: '3px solid transparent',
    background: 'none',
    color: '#6b7280',
    cursor: 'pointer',
  },
  tabActive: {
    color: 'var(--colour-primary)',
    borderBottomColor: 'var(--colour-primary)',
    background: '#fff',
  },
  body: {
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  context: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.88rem',
    color: 'var(--colour-text)',
    margin: 0,
  },
  hint: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    color: '#6b7280',
    margin: 0,
  },
  textarea: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    resize: 'vertical',
    outline: 'none',
    lineHeight: 1.5,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
  },
  cancelBtn: {
    fontSize: 13,
    padding: '6px 14px',
  },
  submitBtn: {
    fontSize: 13,
    padding: '6px 16px',
  },
  successMsg: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.85rem',
    color: '#16a34a',
    fontWeight: 600,
    margin: 0,
  },
  errorMsg: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.85rem',
    color: '#dc2626',
    fontWeight: 600,
    margin: 0,
  },
}
