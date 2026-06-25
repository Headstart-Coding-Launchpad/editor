import React from 'react'
import Banner from '../../shared/Banner'

export default function StudentStatusBanners({
  isForcedTeacherLive,
  isPresentationStudentViewer,
  isStudentGoLiveViewer,
  teacherLiveSourceStudentName,
  isViewingPrev,
  onReturnToCurrentTask,
  inPersonalSandbox,
  onLeavePersonalSandbox,
  isTeacherEditing,
}) {
  return (
    <>
      {isForcedTeacherLive && (
        <div style={s.teacherLiveBanner}>
          <span className="live-dot" />
          {isPresentationStudentViewer || isStudentGoLiveViewer
            ? `Watching ${teacherLiveSourceStudentName ?? 'a student'}'s screen — your work is saved`
            : 'Watching teacher — your own work is saved and will return when live view ends'}
        </div>
      )}

      {isViewingPrev && (
        <Banner accent="#ef4444" color="#b91c1c">
          You are viewing a previous task — return to current task to continue.
          <button
            className="btn-secondary"
            style={{ marginLeft: 16, padding: '4px 12px', fontSize: 13 }}
            onClick={onReturnToCurrentTask}
          >
            Back to Current Task
          </button>
        </Banner>
      )}

      {isTeacherEditing && (
        <div style={s.teacherEditingBanner}>
          <span className="live-dot" />
          Your teacher is making edits — you&apos;ll see their changes live
        </div>
      )}

      {inPersonalSandbox && (
        <Banner accent="#7c3aed" color="#5b21b6" style={{ fontWeight: 600 }}>
          <span>Personal Sandbox — your lesson progress is saved</span>
          <button
            className="btn-secondary"
            style={{ marginLeft: 16, padding: '4px 12px', fontSize: 13 }}
            onClick={onLeavePersonalSandbox}
          >
            Close Sandbox
          </button>
        </Banner>
      )}
    </>
  )
}

const s = {
  teacherEditingBanner: {
    background: '#0f766e',
    color: '#fff',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '1.15rem',
    padding: '16px 20px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    letterSpacing: '0.01em',
  },
  teacherLiveBanner: {
    background: 'var(--colour-primary)',
    color: '#fff',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '1.15rem',
    padding: '16px 20px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    letterSpacing: '0.01em',
  },
}
