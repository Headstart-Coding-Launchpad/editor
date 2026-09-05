import React, { useEffect, useMemo, useRef, useState } from 'react'
import { sortedShareEntries } from '../sharedWorkspacePayload'

const BREAKPOINT_NARROW = 1300 // collapse secondary buttons into Menu dropdown
const BREAKPOINT_COMPACT = 950 // also hide status text from bar (shown inside dropdown instead)

export default function TeacherSessionControls({
  session,
  onOpenPresentationWindow,
  onOpenFeedback,
  onOpenReports,
  onOpenEditLesson,
  onStartSession,
  onEndSession,
  onRestartSession,
  onReturnToAdmin,
  onUpdateVideoCallLink,
  onRemoveSharedWorkspace,
  onRemoveAllSharedWorkspaces,
}) {
  const state = session?.state
  const isRunning = state === 'active' || state === 'sandbox'

  const [width, setWidth] = useState(() => window.innerWidth)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  const [sharesOpen, setSharesOpen] = useState(false)
  const sharesRef = useRef(null)

  const [videoLinkOpen, setVideoLinkOpen] = useState(false)
  const [videoLinkValue, setVideoLinkValue] = useState(session?.videoCallLink ?? '')
  const [videoLinkError, setVideoLinkError] = useState(null)
  const [videoLinkSaving, setVideoLinkSaving] = useState(false)
  const videoLinkRef = useRef(null)

  const shareEntries = useMemo(
    () => sortedShareEntries(session?.sharedWorkspaces),
    [session?.sharedWorkspaces]
  )

  const narrow = width < BREAKPOINT_NARROW
  const compact = width < BREAKPOINT_COMPACT
  const openAccount = () => {
    window.location.hash = '#/account'
  }

  useEffect(() => {
    function onResize() {
      setWidth(window.innerWidth)
    }
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

  useEffect(() => {
    if (!sharesOpen) return
    function onDown(e) {
      if (sharesRef.current && !sharesRef.current.contains(e.target)) setSharesOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [sharesOpen])

  useEffect(() => {
    if (!videoLinkOpen) return
    setVideoLinkValue(session?.videoCallLink ?? '')
    setVideoLinkError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoLinkOpen])

  useEffect(() => {
    if (!videoLinkOpen) return
    function onDown(e) {
      if (videoLinkRef.current && !videoLinkRef.current.contains(e.target)) setVideoLinkOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [videoLinkOpen])

  async function handleSaveVideoLink() {
    setVideoLinkSaving(true)
    setVideoLinkError(null)
    try {
      await onUpdateVideoCallLink(videoLinkValue)
      setVideoLinkOpen(false)
    } catch (err) {
      setVideoLinkError(err.message || 'Could not save that link.')
    } finally {
      setVideoLinkSaving(false)
    }
  }

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
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
          >
            Menu ▾
          </button>
          {menuOpen && (
            <div style={sDD.panel} className="ui-popover">
              {compact && (
                <span style={sDD.statusLabel}>{session ? `Session: ${state}` : 'No session'}</span>
              )}
              <button
                style={sDD.item}
                onClick={() => {
                  setMenuOpen(false)
                  onOpenPresentationWindow()
                }}
              >
                Presentation Window
              </button>
              <button
                style={sDD.item}
                onClick={() => {
                  setMenuOpen(false)
                  onOpenFeedback()
                }}
              >
                Feedback
              </button>
              <button
                style={sDD.item}
                onClick={() => {
                  setMenuOpen(false)
                  onOpenReports()
                }}
              >
                Reports
              </button>
              <button
                style={sDD.item}
                onClick={() => {
                  setMenuOpen(false)
                  onOpenEditLesson()
                }}
              >
                Edit Lesson
              </button>
              <button
                style={sDD.item}
                onClick={() => {
                  setMenuOpen(false)
                  onReturnToAdmin()
                }}
              >
                Admin
              </button>
              <button
                style={sDD.item}
                onClick={() => {
                  setMenuOpen(false)
                  openAccount()
                }}
              >
                Account
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          <button
            className="btn-ghost teacher-session-controls__action"
            onClick={onOpenPresentationWindow}
          >
            Presentation Window
          </button>
          <button className="btn-ghost teacher-session-controls__action" onClick={onOpenFeedback}>
            Feedback
          </button>
          <button className="btn-ghost teacher-session-controls__action" onClick={onOpenReports}>
            Reports
          </button>
          <button className="btn-ghost teacher-session-controls__action" onClick={onOpenEditLesson}>
            Edit Lesson
          </button>
          <button className="btn-ghost teacher-session-controls__action" onClick={onReturnToAdmin}>
            Admin
          </button>
          <button className="btn-ghost teacher-session-controls__action" onClick={openAccount}>
            Account
          </button>
        </>
      )}

      {session && onRemoveSharedWorkspace && shareEntries.length > 0 && (
        <div ref={sharesRef} style={sDD.wrap}>
          <button
            className="btn-ghost teacher-session-controls__action"
            onClick={() => setSharesOpen((v) => !v)}
            aria-expanded={sharesOpen}
          >
            📤 Shared work ({shareEntries.length})
          </button>
          {sharesOpen && (
            <div style={sDD.panel} className="ui-popover">
              <p style={sShare.note}>
                Approved shares stay available to the class until you remove them.
              </p>
              <ul style={sShare.list}>
                {shareEntries.map((entry) => (
                  <li key={entry.shareId} style={sShare.row}>
                    <span style={sShare.rowText}>
                      <strong>{entry.sharerName}</strong>
                      {entry.taskTitle ? ` · ${entry.taskTitle}` : ''}
                    </span>
                    <button style={sDD.item} onClick={() => onRemoveSharedWorkspace(entry.shareId)}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              {onRemoveAllSharedWorkspaces && shareEntries.length > 1 && (
                <button
                  style={{ ...sDD.item, width: '100%' }}
                  onClick={() => {
                    onRemoveAllSharedWorkspaces()
                    setSharesOpen(false)
                  }}
                >
                  Remove all
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {session && onUpdateVideoCallLink && (
        <div ref={videoLinkRef} style={sDD.wrap}>
          <button
            className="btn-ghost teacher-session-controls__action"
            onClick={() => setVideoLinkOpen((v) => !v)}
            aria-expanded={videoLinkOpen}
          >
            📹 {session.videoCallLink ? 'Video Call' : 'Add Video Call'}
          </button>
          {videoLinkOpen && (
            <div style={sDD.panel} className="ui-popover">
              <label style={sVid.label}>
                Video call link
                <input
                  style={sVid.input}
                  type="url"
                  autoFocus
                  placeholder="https://zoom.us/j/…"
                  value={videoLinkValue}
                  onChange={(e) => setVideoLinkValue(e.target.value)}
                />
              </label>
              {videoLinkError && <span style={sVid.error}>{videoLinkError}</span>}
              <div style={sVid.actions}>
                {session.videoCallLink && (
                  <button
                    style={{ ...sDD.item, flex: 1 }}
                    disabled={videoLinkSaving}
                    onClick={() => {
                      setVideoLinkValue('')
                    }}
                  >
                    Clear
                  </button>
                )}
                <button
                  style={{
                    ...sDD.item,
                    flex: 1,
                    background: 'var(--colour-primary)',
                    color: '#fff',
                    borderColor: 'var(--colour-primary)',
                  }}
                  disabled={videoLinkSaving}
                  onClick={handleSaveVideoLink}
                >
                  {videoLinkSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          )}
        </div>
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

const sVid = {
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: 12,
    color: '#374151',
  },
  input: {
    padding: '7px 9px',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    fontFamily: 'var(--font-body)',
    fontSize: 13,
    outline: 'none',
    minWidth: 220,
  },
  error: {
    fontFamily: 'var(--font-body)',
    fontSize: 11.5,
    color: '#dc2626',
  },
  actions: {
    display: 'flex',
    gap: 6,
  },
}

const sShare = {
  note: { margin: '0 0 6px', fontSize: 12, color: 'var(--colour-muted)' },
  list: {
    listStyle: 'none',
    margin: '0 0 6px',
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowText: { fontSize: 12, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' },
}
