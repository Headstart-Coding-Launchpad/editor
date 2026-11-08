import React, { useEffect, useMemo, useRef, useState } from 'react'
import { sortedShareEntries } from '../sharedWorkspacePayload'
import ClassCountdownControl from './ClassCountdownControl'
import TeacherPollControl from './polls/TeacherPollControl'
import DropdownMenu from './student-modal/DropdownMenu'
import { useExtraClassToolsOn } from '../../shared/extraClassToolsSetting'

// The teacher view's top row (calm teacher view, sketch v2): one fixed-height row of Present,
// Countdown (with the quieter Rate beside it), Add Video Call, End Session (it asks first, in
// TeacherEndSessionModal) and More. Reports, Report a problem, Account, Peer help, Edit Lesson
// (extra class tools), Admin and Go Live are in More. Status-only extras (Shared work, the
// pinned live code, Stop live while the tutor is live, a quick poll) appear only while they
// apply.

export default function TeacherSessionControls({
  session,
  onOpenPresentationWindow,
  onOpenReports,
  onReportProblem,
  onOpenEditLesson,
  onStartSession,
  onEndSession,
  onRestartSession,
  onReturnToAdmin,
  onUpdateVideoCallLink,
  onBroadcastVideoCallLink,
  onRemoveSharedWorkspace,
  onRemoveAllSharedWorkspaces,
  onOpenSharedWorkspace,
  serverTimeOffset = 0,
  onStartClassCountdown,
  onAddClassCountdownTime,
  onClearClassCountdown,
  onLaunchPoll,
  onClosePoll,
  onSetPollShowResults,
  onDismissPoll,
  // The 🤝 Peer help menu (TeacherPeerHelpMenu), shown while the session runs.
  peerHelpMenu = null,
  // Turns off the class-wide "📌 Keep showing live code" pin (setTeacherLiveReferenceForClass
  // with false). Pinning is done from the Live tab; turning it off lives here so it is
  // reachable whether or not Presentation View is showing the task.
  onUnpinLiveReference,
  // The ⭐ Rate control (TaskRatingPanel), shown beside Countdown.
  rateControl = null,
  // Go Live from this window, in More (the tutor normally goes live from the presentation
  // window); `goLiveDisabledReason` greys it out. `goLiveControl` (Stop live and, for a live
  // started here, the layout buttons) shows in the row only while the tutor is live.
  onGoLive,
  goLiveDisabledReason = null,
  goLiveControl = null,
}) {
  const [showExtraTools] = useExtraClassToolsOn()
  const state = session?.state
  const isRunning = state === 'active' || state === 'sandbox'

  const [sharesOpen, setSharesOpen] = useState(false)
  const sharesRef = useRef(null)

  const [videoLinkOpen, setVideoLinkOpen] = useState(false)
  const [videoLinkValue, setVideoLinkValue] = useState(session?.videoCallLink ?? '')
  const [videoLinkError, setVideoLinkError] = useState(null)
  const [videoLinkSaving, setVideoLinkSaving] = useState(false)
  const videoLinkRef = useRef(null)
  const [videoBroadcastSent, setVideoBroadcastSent] = useState(false)

  const shareEntries = useMemo(
    () => sortedShareEntries(session?.sharedWorkspaces),
    [session?.sharedWorkspaces]
  )

  const openAccount = () => {
    window.location.hash = '#/account'
  }

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

  // "Send to all" has no confirm step; it flips to "Sent" briefly so the click registers.
  useEffect(() => {
    if (!videoBroadcastSent) return
    const t = setTimeout(() => setVideoBroadcastSent(false), 2000)
    return () => clearTimeout(t)
  }, [videoBroadcastSent])

  async function handleBroadcastVideoLink() {
    try {
      await onBroadcastVideoCallLink()
      setVideoBroadcastSent(true)
    } catch (err) {
      console.warn('Failed to send the video call to everyone:', err)
    }
  }

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

  const moreMenu = (
    <DropdownMenu
      label="More"
      buttonClassName="btn-ghost teacher-session-controls__action"
      title="Reports, Report a problem, Account, Peer help and more"
      panelStyle={sDD.morePanel}
    >
      {(close) => (
        <>
          <span style={sDD.statusLabel}>{session ? `Session: ${state}` : 'No session'}</span>
          <MoreItem
            label="Reports"
            onClick={() => {
              close()
              onOpenReports()
            }}
          />
          {onReportProblem && (
            <MoreItem
              label="Report a problem"
              onClick={() => {
                close()
                onReportProblem()
              }}
            />
          )}
          <MoreItem
            label="Account"
            onClick={() => {
              close()
              openAccount()
            }}
          />
          {session && isRunning && peerHelpMenu && <div style={sDD.nested}>{peerHelpMenu}</div>}
          {showExtraTools && (
            <MoreItem
              label="Edit Lesson"
              onClick={() => {
                close()
                onOpenEditLesson()
              }}
            />
          )}
          {/* Admin accounts only (TeacherView passes no handler to a teacher). */}
          {onReturnToAdmin && (
            <MoreItem
              label="Admin"
              onClick={() => {
                close()
                onReturnToAdmin()
              }}
            />
          )}
          {session && onGoLive && !goLiveControl && (
            <MoreItem
              label="📡 Go Live"
              disabled={!!goLiveDisabledReason}
              title={
                goLiveDisabledReason ??
                'Go Live from this window: students watch your screen (usually done from the presentation window)'
              }
              onClick={() => {
                close()
                onGoLive()
              }}
            />
          )}
        </>
      )}
    </DropdownMenu>
  )

  return (
    <div className="teacher-session-controls" data-testid="teacher-top-row">
      <button
        type="button"
        className="btn-primary teacher-session-controls__action teacher-top-row__present"
        onClick={onOpenPresentationWindow}
        aria-label="Open the presentation window"
        title="Open the presentation window (or bring it to the front)"
      >
        ▶ Present
      </button>

      {/* Countdown with the quieter Rate beside it. Kept out of More: the teacher reaches for
          the countdown mid-task. */}
      {((isRunning && onStartClassCountdown) || rateControl) && (
        <div className="teacher-top-row__group">
          {isRunning && onStartClassCountdown && (
            <ClassCountdownControl
              countdown={session?.classCountdown}
              serverTimeOffset={serverTimeOffset}
              onStart={onStartClassCountdown}
              onAddTime={onAddClassCountdownTime}
              onClear={onClearClassCountdown}
            />
          )}
          {rateControl}
        </div>
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
            <div style={{ ...sDD.panel, minWidth: 300 }} className="ui-popover">
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
                    <span style={sShare.rowActions}>
                      {onOpenSharedWorkspace && (
                        <button
                          style={sDD.item}
                          onClick={() => {
                            setSharesOpen(false)
                            onOpenSharedWorkspace(entry)
                          }}
                        >
                          Open
                        </button>
                      )}
                      <button
                        style={sDD.item}
                        onClick={() => onRemoveSharedWorkspace(entry.shareId)}
                      >
                        Remove
                      </button>
                    </span>
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

      {session?.teacherLiveReferenceVisibleToAll && onUnpinLiveReference && (
        <button
          className="btn-ghost teacher-session-controls__action"
          title="Your live code is pinned for the whole class on every task. Click to stop showing it."
          aria-label="Live code kept on for class: turn off"
          onClick={() => onUnpinLiveReference(false)}
        >
          📌 Live code on · Turn off
        </button>
      )}

      {showExtraTools && session && isRunning && onLaunchPoll && (
        <TeacherPollControl
          session={session}
          onLaunch={onLaunchPoll}
          onClosePoll={onClosePoll}
          onSetShowResults={onSetPollShowResults}
          onDismiss={onDismissPoll}
        />
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
              {/* Pops the saved link up for every student, including the waiting room and
                  name screen. */}
              {session.videoCallLink && onBroadcastVideoCallLink && state !== 'ended' && (
                <button
                  style={sDD.item}
                  onClick={handleBroadcastVideoLink}
                  disabled={videoBroadcastSent}
                  title="Pop up the video call link for every student, including the waiting room and name screen"
                >
                  {videoBroadcastSent ? '✓ Sent' : '📹 Send to all'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {goLiveControl}

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

      {moreMenu}
    </div>
  )
}

function MoreItem({ label, onClick, disabled = false, title }) {
  return (
    <button type="button" style={sDD.item} onClick={onClick} disabled={disabled} title={title}>
      {label}
    </button>
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
    // The top bar's text is white; without this, names in the Shared work list vanished (#76).
    color: 'var(--colour-text)',
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
  morePanel: { minWidth: 200, color: 'var(--colour-text)' },
  nested: { display: 'flex', flexDirection: 'column' },
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
  rowText: {
    flex: 1,
    fontSize: 12,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  rowActions: { display: 'flex', gap: 4, flexShrink: 0 },
}
