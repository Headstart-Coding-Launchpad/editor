import React, { useEffect, useMemo, useState } from 'react'
import SharedWorkspaceViewer from '../SharedWorkspaceViewer'
import PeerHelpLineList from './PeerHelpLineList'
import PeerHelpFeedbackRail from './PeerHelpFeedbackRail'
import {
  describeItem,
  findAnchor,
  peerHelpAnchors,
  peerHelpCapability,
} from '../../peerHelpAnchors'
import { resolveSnapshotContext } from '../SharedWorkspacePreview'
import { PEER_HELP_EDITS_AND_NOTES, sortedItems } from '../../../shared/peerHelp'

/**
 * What a helper sees: their classmate's code, big, with 👍 👎 💡 on every line
 * (PeerHelpLineList). "▶ Run their code" swaps in a runnable throwaway copy (never saved,
 * nothing copied out). The classmate is never named. Their latest code is fetched when the
 * helper opens this.
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
  onRequestLatest,
  onFinish,
  onMark,
  onHint,
  onSubmitEdit,
  onSubmitNote,
}) {
  const [running, setRunning] = useState(false)
  const { task, moduleType } = useMemo(
    () => resolveSnapshotContext(lesson, snapshot),
    [lesson, snapshot]
  )
  const anchors = useMemo(
    () => peerHelpAnchors(snapshot, moduleType, task),
    [snapshot, moduleType, task]
  )
  const ended = !!state?.endedAt

  // Fetch their latest code once when the helper starts on this request.
  useEffect(() => {
    if (requestId && !ended) onRequestLatest?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId])

  const sent = sortedItems(inbox).filter((item) => !item.reviewItemId)
  const thanked = sent.some((item) => item.response === 'useful' || item.response === 'accepted')
  // Remount the copy when a fresher snapshot arrives.
  const copyKey = `peer-${requestId}-${snapshot?.capturedAt ?? 0}`

  return (
    <div style={s.wrap}>
      <div style={s.bar} role="status">
        <span style={s.title}>
          {ended ? '🎉 All done! Thanks for helping.' : '🤝 Helping a classmate'}
        </span>
        <div style={s.actions}>
          {!ended && snapshot && (
            <button
              type="button"
              className="btn-ghost-outline"
              style={s.btn}
              onClick={() => setRunning((r) => !r)}
            >
              {running ? '← Back to their code' : '▶ Run their code'}
            </button>
          )}
          <button type="button" className="btn-primary" style={s.btn} onClick={onFinish}>
            {ended ? 'Close' : '✓ Done'}
          </button>
        </div>
      </div>
      <div style={s.body}>
        {!snapshot ? (
          <p style={s.loading}>Loading their code…</p>
        ) : running && !ended ? (
          <SharedWorkspaceViewer
            key={copyKey}
            lesson={lesson}
            entry={{ shareId: copyKey, sharerName: 'A classmate' }}
            snapshot={snapshot}
            isMobile={isMobile}
            title="▶ Their code"
            subtitle="Try it! Nothing here is saved."
            copyBlocked
            onClose={() => setRunning(false)}
          />
        ) : (
          <PeerHelpLineList
            anchors={anchors}
            lessonType={moduleType}
            task={task}
            inbox={inbox}
            ended={ended}
            onMark={onMark}
            onHint={onHint}
          />
        )}
        {/* Switched off (PEER_HELP_EDITS_AND_NOTES): suggested edits and notes for the teacher. */}
        {PEER_HELP_EDITS_AND_NOTES && !running && (
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
            onSubmitEdit={peerHelpCapability(moduleType)?.anchors === 'lines' ? onSubmitEdit : null}
            onSubmitNote={onSubmitNote}
          />
        )}
      </div>
      {(sent.length > 0 || thanked) && !running && (
        <div style={s.sent} aria-label="What you sent">
          {thanked && <strong style={s.thanks}>👍 They said thanks!</strong>}
          <span>
            Sent:{' '}
            {sent
              .map((item) => {
                const anchor = findAnchor(anchors, item.file, item.line)
                const where = anchor ? ` (${anchor.label.toLowerCase()})` : ''
                return `${describeItem(item, moduleType, task)}${where}`
              })
              .join(' · ')}
          </span>
        </div>
      )}
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
    padding: '8px 12px',
    background: 'rgba(13, 148, 136, 0.10)',
    color: 'var(--colour-text)',
    borderBottom: '2px solid #0d9488',
    flexShrink: 0,
  },
  title: { fontWeight: 700, fontSize: 17 },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  btn: { fontSize: 15, padding: '6px 14px' },
  body: { display: 'flex', flex: 1, minHeight: 0 },
  loading: { padding: 16, color: 'var(--colour-muted)', fontSize: 16 },
  sent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: '6px 12px',
    fontSize: 13,
    color: 'var(--colour-text)',
    borderTop: '1px solid var(--ui-border)',
    background: 'var(--ui-surface)',
    flexShrink: 0,
  },
  thanks: { color: 'var(--colour-success-text)' },
}
