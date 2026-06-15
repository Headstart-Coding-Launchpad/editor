import React, { useState } from 'react'
import StudentView from '../../app/views/StudentView'
import TeacherFeedbackModal from '../../app/components/TeacherFeedbackModal'
import { useAuth } from '../../auth/useAuth'
import { flattenTasks } from '../../shared/taskUtils'

export default function PreviewView({ lesson, onClose, initialTaskId = null }) {
  const { user } = useAuth()
  const [currentTaskId, setCurrentTaskId] = useState(initialTaskId ?? null)
  const [showFeedback, setShowFeedback] = useState(false)

  const flatTasks = flattenTasks(lesson?.tasks ?? [])
  const currentTask = flatTasks.find(t => t.id === currentTaskId) ?? null

  return (
    <div style={s.page}>
      <div style={s.banner}>
        <span style={s.bannerText}>This is a preview — changes are not saved</span>
        <div style={s.bannerActions}>
          <button className="btn-ghost" style={s.feedbackBtn} onClick={() => setShowFeedback(true)}>
            Feedback
          </button>
          <button className="btn-secondary" style={s.backBtn} onClick={() => onClose(currentTaskId)}>
            Go back to Builder
          </button>
        </div>
      </div>
      <div style={s.studentWrap}>
        <StudentView
          lesson={lesson}
          soloMode
          allowUnrestrictedTaskNavigation
          previewMode
          initialTaskId={initialTaskId}
          onTaskChange={setCurrentTaskId}
        />
      </div>

      {showFeedback && (
        <TeacherFeedbackModal
          lessonId={lesson?.id ?? ''}
          lessonTitle={lesson?.title ?? ''}
          currentTaskId={currentTaskId}
          currentTaskTitle={currentTask?.title ?? null}
          teacherEmail={user?.email ?? ''}
          onClose={() => setShowFeedback(false)}
        />
      )}
    </div>
  )
}

const s = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  banner: {
    background: 'var(--colour-secondary)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    height: 40,
    flexShrink: 0,
    gap: 12,
  },
  bannerText: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.88rem',
  },
  bannerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  feedbackBtn: {
    fontSize: 13,
    padding: '4px 14px',
    background: 'rgba(0,0,0,0.15)',
    border: '1px solid rgba(255,255,255,0.4)',
    color: '#fff',
    borderRadius: 6,
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    cursor: 'pointer',
  },
  backBtn: {
    fontSize: 13,
    padding: '4px 14px',
    background: 'rgba(0,0,0,0.15)',
    border: '1px solid rgba(255,255,255,0.4)',
    color: '#fff',
    borderRadius: 6,
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    cursor: 'pointer',
  },
  studentWrap: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
}
