import React from 'react'

export default function TeacherSessionControls({
  session,
  onOpenPresentationWindow,
  onOpenFeedback,
  onOpenEditLesson,
  onStartSession,
  onEndSession,
  onRestartSession,
  onReturnToAdmin,
}) {
  const state = session?.state
  const isRunning = state === 'active' || state === 'sandbox'

  return (
    <div className="teacher-session-controls">
      <span className="teacher-session-controls__status">
        {session ? `Session: ${state}` : 'No session'}
      </span>
      <button className="btn-ghost teacher-session-controls__action" onClick={onOpenPresentationWindow}>
        Presentation Window
      </button>
      <button className="btn-ghost teacher-session-controls__action" onClick={onOpenFeedback}>
        Feedback
      </button>
      <button className="btn-ghost teacher-session-controls__action" onClick={onOpenEditLesson}>
        Edit Lesson
      </button>
      <button className="btn-ghost teacher-session-controls__action" onClick={onReturnToAdmin}>
        Admin
      </button>
      {state === 'waiting' && (
        <button className="btn-primary teacher-session-controls__action" onClick={onStartSession}>
          Start Session
        </button>
      )}
      {isRunning && (
        <button className="btn-danger teacher-session-controls__action" onClick={onEndSession}>
          End Session
        </button>
      )}
      {state === 'ended' && (
        <button className="btn-primary teacher-session-controls__action" onClick={onRestartSession}>
          Restart Session
        </button>
      )}
    </div>
  )
}
