import React, { useMemo } from 'react'
import SharedWorkspaceViewer from '../SharedWorkspaceViewer'
import PeerHelpFeedbackRail from './PeerHelpFeedbackRail'
import { peerHelpAnchors, peerHelpCapability } from '../../peerHelpAnchors'
import { resolveSnapshotContext } from '../SharedWorkspacePreview'

/**
 * What a helper sees: a runnable throwaway copy of the classmate's work (never saved, nothing
 * copied out), next to the feedback rail. The classmate is never named.
 */
export default function PeerHelperWorkspace({
  lesson,
  requestId,
  snapshot,
  state,
  inbox,
  review,
  notesEnabled,
  isMobile,
  onBackToMyWork,
  onRequestLatest,
  onFinish,
  onMark,
  onHint,
  onSubmitEdit,
  onSubmitNote,
}) {
  const { task, moduleType } = useMemo(
    () => resolveSnapshotContext(lesson, snapshot),
    [lesson, snapshot]
  )
  const anchors = useMemo(
    () => peerHelpAnchors(snapshot, moduleType, task),
    [snapshot, moduleType, task]
  )
  // Suggested edits change lines of code; Scratch scripts get thumbs, hints and notes.
  const canSuggestEdits = peerHelpCapability(moduleType)?.anchors === 'lines'
  const ended = !!state?.endedAt
  // Remount the copy when a fresher snapshot arrives.
  const copyKey = `peer-${requestId}-${snapshot?.capturedAt ?? 0}`

  return (
    <div style={s.wrap}>
      <div style={s.bar} role="status">
        <span style={s.title}>
          {ended ? '🤝 This help session has finished' : '🤝 You are helping a classmate'}
        </span>
        <div style={s.actions}>
          {!ended && (
            <button
              type="button"
              className="btn-ghost-outline"
              style={s.btn}
              onClick={onRequestLatest}
            >
              🔄 Get their latest code
            </button>
          )}
          <button
            type="button"
            className="btn-ghost-outline"
            style={s.btn}
            onClick={onBackToMyWork}
          >
            ← My work
          </button>
          <button type="button" className="btn-primary" style={s.btn} onClick={onFinish}>
            {ended ? 'Close' : 'Finish helping'}
          </button>
        </div>
      </div>
      <div style={s.body}>
        <div style={s.copy}>
          {snapshot ? (
            <SharedWorkspaceViewer
              key={copyKey}
              lesson={lesson}
              entry={{ shareId: copyKey, sharerName: 'A classmate' }}
              snapshot={snapshot}
              isMobile={isMobile}
              title="🤝 A copy of your classmate's work"
              subtitle="Run it and try things here: nothing is saved, and they can't see this copy."
              copyBlocked
              onClose={onBackToMyWork}
            />
          ) : (
            <p style={s.loading}>Loading their work…</p>
          )}
        </div>
        <PeerHelpFeedbackRail
          anchors={anchors}
          lessonType={moduleType}
          task={task}
          inbox={inbox}
          review={review}
          notesEnabled={notesEnabled}
          ended={ended}
          onMark={onMark}
          onHint={onHint}
          onSubmitEdit={canSuggestEdits ? onSubmitEdit : null}
          onSubmitNote={onSubmitNote}
        />
      </div>
    </div>
  )
}

const s = {
  wrap: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, height: '100%' },
  bar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
    padding: '6px 12px',
    background: 'rgba(13, 148, 136, 0.10)',
    borderBottom: '2px solid #0d9488',
    flexShrink: 0,
  },
  title: { fontWeight: 700, fontSize: 14 },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  btn: { fontSize: 13, padding: '4px 12px' },
  body: { display: 'flex', flex: 1, minHeight: 0 },
  copy: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' },
  loading: { padding: 16, color: 'var(--colour-muted)' },
}
