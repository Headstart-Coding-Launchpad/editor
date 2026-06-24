import React, { useEffect, useRef, useState } from 'react'

const BREAKPOINT_NARROW  = 1300  // collapse secondary buttons into Menu dropdown
const BREAKPOINT_COMPACT = 950   // also hide status text from bar (shown inside dropdown instead)

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

  const [width, setWidth] = useState(() => window.innerWidth)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  const narrow  = width < BREAKPOINT_NARROW
  const compact = width < BREAKPOINT_COMPACT

  useEffect(() => {
    function onResize() { setWidth(window.innerWidth) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    function onDown(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menuOpen])

  return (
    <div className="teacher-session-controls">
      {!compact && (
        <span className="teacher-session-controls__status">
          {session ? `Session: ${state}` : 'No session'}
        </span>
      )}

      {narrow ? (
        <div ref={menuRef} style={sDD.wrap}>
          <button
            className="btn-ghost teacher-session-controls__action"
            onClick={() => setMenuOpen(v => !v)}
            aria-expanded={menuOpen}
          >
            Menu ▾
          </button>
          {menuOpen && (
            <div style={sDD.panel} className="ui-popover">
              {compact && (
                <span style={sDD.statusLabel}>
                  {session ? `Session: ${state}` : 'No session'}
                </span>
              )}
              <button style={sDD.item} onClick={() => { setMenuOpen(false); onOpenPresentationWindow() }}>
                Presentation Window
              </button>
              <button style={sDD.item} onClick={() => { setMenuOpen(false); onOpenFeedback() }}>
                Feedback
              </button>
              <button style={sDD.item} onClick={() => { setMenuOpen(false); onOpenEditLesson() }}>
                Edit Lesson
              </button>
              <button style={sDD.item} onClick={() => { setMenuOpen(false); onReturnToAdmin() }}>
                Admin
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
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
        </>
      )}

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

const sDD = {
  wrap: {
    position: 'relative',
    display: 'inline-block',
  },
  panel: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    right: 0,
    minWidth: 190,
    zIndex: 200,
    padding: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    background: '#fff',
    boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
    borderRadius: 8,
  },
  statusLabel: {
    fontFamily: 'var(--font-body)',
    fontSize: 11,
    color: '#6b7280',
    padding: '2px 4px 6px',
    borderBottom: '1px solid #e5e7eb',
    marginBottom: 2,
    display: 'block',
    fontStyle: 'italic',
  },
  item: {
    width: '100%',
    padding: '7px 12px',
    background: 'rgba(98,34,204,0.06)',
    color: 'var(--colour-primary-dark)',
    border: '1px solid rgba(98,34,204,0.18)',
    borderRadius: 6,
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
    textAlign: 'left',
  },
}
