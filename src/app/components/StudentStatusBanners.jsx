import React from 'react'

export default function StudentStatusBanners({
  isForcedTeacherLive,
  isPresentationStudentViewer,
  isStudentGoLiveViewer,
  teacherLiveSourceStudentName,
  isViewingPrev,
  onReturnToCurrentTask,
  inPersonalSandbox,
  onLeavePersonalSandbox,
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
        <div style={s.prevBanner}>
          You are viewing a previous task — return to current task to continue.
          <button
            className="btn-secondary"
            style={{ marginLeft: 16, padding: '4px 12px', fontSize: 13 }}
            onClick={onReturnToCurrentTask}
          >
            Back to Current Task
          </button>
        </div>
      )}

      {inPersonalSandbox && (
        <div style={s.personalSandboxBanner}>
          <span>Personal Sandbox — your lesson progress is saved</span>
          <button
            className="btn-secondary"
            style={{ marginLeft: 16, padding: '4px 12px', fontSize: 13 }}
            onClick={onLeavePersonalSandbox}
          >
            Close Sandbox
          </button>
        </div>
      )}
    </>
  )
}

const s = {
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
  prevBanner: {
    background: 'rgba(239,68,68,0.08)',
    borderBottom: '1px solid rgba(239,68,68,0.2)',
    padding: '8px 16px',
    fontSize: 13,
    color: '#b91c1c',
    display: 'flex',
    alignItems: 'center',
    fontFamily: 'var(--font-body)',
  },
  personalSandboxBanner: {
    background: 'rgba(124,58,237,0.08)',
    borderBottom: '1px solid rgba(124,58,237,0.2)',
    padding: '8px 16px',
    fontSize: 13,
    color: '#5b21b6',
    display: 'flex',
    alignItems: 'center',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    flexShrink: 0,
  },
}
