import React from 'react'

export default function TeacherSessionControls({
  session,
  isInSandbox,
  displayIndex,
  taskCount,
  links,
  copiedLink,
  showSharePanel,
  onPreviousTask,
  onNextTask,
  onOpenPresentationWindow,
  onOpenFeedback,
  onToggleSharePanel,
  onCloseSharePanel,
  onCopyLink,
  onStartSession,
  onTogglePaused,
  onEndSession,
  onRestartSession,
}) {
  const state = session?.state
  const canNavigateBack = displayIndex > 0
  const canNavigateNext = displayIndex < taskCount - 1
  const isRunning = state === 'active' || state === 'sandbox'

  return (
    <div className="teacher-session-controls">
      {!isInSandbox && (
        <div className="teacher-session-controls__navigation">
          <button
            className="btn-ghost teacher-session-controls__nav-btn"
            disabled={!canNavigateBack}
            onClick={onPreviousTask}
          >
            &larr; Prev
          </button>
          <span className="teacher-session-controls__task">
            Task {displayIndex + 1} / {taskCount}
          </span>
          <button
            className="btn-ghost teacher-session-controls__nav-btn"
            disabled={!canNavigateNext}
            onClick={onNextTask}
          >
            Next &rarr;
          </button>
        </div>
      )}
      <span className="teacher-session-controls__status">
        {session ? `Session: ${state}` : 'No session'}
      </span>
      <button className="btn-ghost teacher-session-controls__action" onClick={onOpenPresentationWindow}>
        Presentation Window
      </button>
      {isRunning && (
        <button className="btn-ghost teacher-session-controls__action" onClick={onOpenFeedback}>
          Feedback
        </button>
      )}
      <div className="teacher-share">
        <button
          className="btn-ghost teacher-session-controls__action"
          onClick={onToggleSharePanel}
          aria-expanded={showSharePanel}
        >
          Share Links
        </button>
        {showSharePanel && (
          <>
            <div className="teacher-share__overlay" onClick={onCloseSharePanel} />
            <div className="teacher-share__panel">
              <span className="teacher-share__title">Share lesson links</span>
              {(['live', 'solo']).map(type => (
                <div key={type} className="teacher-share__row">
                  <div className="teacher-share__info">
                    <span className="teacher-share__type">
                      {type === 'live' ? 'Live (with teacher)' : 'Solo (practice)'}
                    </span>
                    <span className="teacher-share__url">{links[type]}</span>
                  </div>
                  <button className="btn-secondary teacher-share__copy-btn" onClick={() => onCopyLink(type)}>
                    {copiedLink === type ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      {state === 'waiting' && (
        <button className="btn-primary teacher-session-controls__action" onClick={onStartSession}>
          Start Session
        </button>
      )}
      {isRunning && (
        <button
          className={`${session?.isPaused ? 'btn-paused' : 'btn-ghost'} teacher-session-controls__action`}
          onClick={onTogglePaused}
        >
          {session?.isPaused ? 'Resume Coding' : 'Pause Coding'}
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
