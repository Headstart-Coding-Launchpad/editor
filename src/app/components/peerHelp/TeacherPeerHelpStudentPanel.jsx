import React, { useState } from 'react'
import SharedWorkspacePreview from '../SharedWorkspacePreview'
import { decodeHelpSnapshot } from '../../peerHelpSnapshot'
import { hasPassedCurrentTask } from '../../../shared/peerHelp'

function nameOf(session, id) {
  return id ? (session?.students?.[id]?.displayName ?? 'a student who left') : null
}

/**
 * Peer help for one student, in the teacher's StudentModal: their "a classmate can help"
 * request (preview the work, offer it, or decline), who is helping whom, and whether this
 * student may help others today.
 */
export default function TeacherPeerHelpStudentPanel({ student, session, lesson, peerHelp }) {
  const [previewing, setPreviewing] = useState(false)
  const studentId = student?.anonymousId
  if (!studentId || !peerHelp) return null

  const ownRequestId = peerHelp.allRequests?.[studentId]?.requestId ?? null
  const ownRequest = ownRequestId ? peerHelp.allPeerHelp?.[ownRequestId] : null
  const ownOffer = ownRequestId ? session?.peerHelpOffers?.[ownRequestId] : null
  const ownEnded = !!ownRequest?.state?.endedAt
  const snapshot = decodeHelpSnapshot(ownRequest?.snapshot)

  const helpingEntry = Object.entries(peerHelp.allPeerHelp ?? {}).find(
    ([, request]) => request?.helperId === studentId && !request?.state?.endedAt
  )
  const helperOff = !!session?.peerHelperOff?.[studentId]
  const passed = hasPassedCurrentTask(student)

  if (!ownRequestId && !helpingEntry && !passed && !helperOff) return null

  return (
    <div style={s.panel} data-testid="teacher-peer-help-panel">
      {ownRequestId && !ownEnded && (
        <div style={s.block}>
          <strong>
            {!ownOffer
              ? '🤝 Asked if a classmate can help'
              : ownOffer.claimedAt
                ? `🤝 Being helped by ${nameOf(session, ownRequest?.helperId) ?? 'a classmate'}`
                : '🤝 Offered to the class: waiting for a helper'}
          </strong>
          <div style={s.row}>
            {snapshot && (
              <button
                type="button"
                className="btn-ghost-outline"
                style={s.btn}
                onClick={() => setPreviewing((v) => !v)}
              >
                {previewing ? 'Hide their work' : 'Check their work first'}
              </button>
            )}
            {!ownOffer && (
              <button
                type="button"
                className="btn-primary"
                style={s.btn}
                disabled={!!session?.peerHelpSettings?.pausedAt}
                title={
                  session?.peerHelpSettings?.pausedAt
                    ? 'Peer help is turned off for now'
                    : 'Finished classmates are asked if they can help. Neither name is shown.'
                }
                onClick={() => peerHelp.offerToClass(studentId)}
              >
                Offer to classmates
              </button>
            )}
            <button
              type="button"
              className="btn-ghost-outline"
              style={s.btn}
              onClick={() => peerHelp.endRequestAsTeacher(ownRequestId)}
            >
              {ownOffer ? 'End peer help' : 'Not this time'}
            </button>
          </div>
          {previewing && snapshot && (
            <div style={s.preview}>
              <span style={s.muted}>
                This is what a helper would see. Check it has nothing personal in it.
              </span>
              <SharedWorkspacePreview lesson={lesson} snapshot={snapshot} showOutput={false} />
            </div>
          )}
        </div>
      )}

      {helpingEntry && (
        <div style={s.rowBetween}>
          <span>🤝 Helping {nameOf(session, helpingEntry[1].stuckId) ?? 'a classmate'}</span>
          <button
            type="button"
            className="btn-ghost-outline"
            style={s.btn}
            onClick={() => peerHelp.endRequestAsTeacher(helpingEntry[0])}
          >
            End
          </button>
        </div>
      )}

      {(passed || helperOff) && (
        <label style={s.check}>
          <input
            type="checkbox"
            checked={!helperOff}
            onChange={(e) => peerHelp.setHelperOff(studentId, !e.target.checked)}
          />
          Can help classmates today
        </label>
      )}
    </div>
  )
}

const s = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '8px 10px',
    margin: '6px 12px 0',
    flexShrink: 0,
    borderRadius: 8,
    background: 'rgba(13, 148, 136, 0.08)',
    border: '1px solid rgba(13, 148, 136, 0.35)',
    color: 'var(--colour-text)',
    fontSize: 13,
  },
  block: { display: 'flex', flexDirection: 'column', gap: 6 },
  row: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  rowBetween: { display: 'flex', gap: 6, justifyContent: 'space-between', alignItems: 'center' },
  btn: { fontSize: 12, padding: '3px 10px' },
  preview: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    maxHeight: 360,
    overflow: 'auto',
    border: '1px solid var(--ui-border)',
    borderRadius: 6,
    padding: 6,
    background: 'var(--ui-surface)',
  },
  muted: { fontSize: 12, color: 'var(--colour-muted)' },
  check: { display: 'flex', gap: 6, alignItems: 'center' },
}
