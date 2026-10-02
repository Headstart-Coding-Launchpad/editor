import React, { useMemo } from 'react'
import DropdownMenu from '../student-modal/DropdownMenu'
import {
  editsFromWire,
  notOkAlerts,
  pendingReviewItems,
  sortedItems,
} from '../../../shared/peerHelp'
import { decodeHelpSnapshot } from '../../peerHelpSnapshot'
import { findAnchor, peerHelpAnchors } from '../../peerHelpAnchors'
import { findTaskById } from '../../../shared/taskUtils'

function nameOf(session, id) {
  return id ? (session?.students?.[id]?.displayName ?? 'A student who left') : 'nobody yet'
}

function anchorFor(lesson, request, item) {
  const snapshot = decodeHelpSnapshot(request?.snapshot)
  const task = findTaskById(lesson?.tasks, snapshot?.taskId)
  return findAnchor(peerHelpAnchors(snapshot, snapshot?.lessonType, task), item.file, item.line)
}

/**
 * The teacher's peer help controls in the top bar: "Not OK" alerts, the queue of suggested
 * edits and notes waiting for approval, who is helping whom, the notes switch and the
 * "End all peer help" stop.
 */
export default function TeacherPeerHelpMenu({ session, lesson, peerHelp }) {
  const pending = useMemo(() => pendingReviewItems(peerHelp.allPeerHelp), [peerHelp.allPeerHelp])
  const alerts = useMemo(() => notOkAlerts(peerHelp.allPeerHelp), [peerHelp.allPeerHelp])
  const active = Object.entries(peerHelp.allPeerHelp ?? {}).filter(
    ([requestId, request]) =>
      !request?.state?.endedAt && session?.peerHelpOffers?.[requestId]?.endedAt == null
  )
  const blocked = Object.entries(peerHelp.allPeerHelp ?? {}).flatMap(([requestId, request]) =>
    sortedItems(request?.review)
      .filter((item) => item.status === 'blocked')
      .map((item) => ({ requestId, ...item }))
  )
  const paused = !!session?.peerHelpSettings?.pausedAt
  const notesEnabled = !!session?.peerHelpSettings?.notesEnabled
  const attention = pending.length + alerts.length

  return (
    <DropdownMenu
      label={attention > 0 ? `🤝 Peer help (${attention})` : '🤝 Peer help'}
      buttonClassName="btn-ghost teacher-session-controls__action"
      indicator={attention > 0}
      title="Students helping each other: approvals, alerts and settings"
      panelStyle={s.panel}
    >
      <div style={s.wrap}>
        {alerts.map((alert) => (
          <div key={alert.requestId} style={s.alert} role="alert">
            <strong>
              🚩 {nameOf(session, alert.stuckId)} said help from {nameOf(session, alert.helperId)}{' '}
              was not OK
            </strong>
            <div style={s.row}>
              <button
                type="button"
                className="btn-ghost-outline"
                style={s.btn}
                onClick={() => peerHelp.acknowledgeNotOk(alert.requestId)}
              >
                Seen
              </button>
              {alert.helperId && (
                <button
                  type="button"
                  className="btn-danger"
                  style={s.btn}
                  onClick={() => peerHelp.setHelperOff(alert.helperId, true)}
                >
                  Stop {nameOf(session, alert.helperId)} helping today
                </button>
              )}
            </div>
          </div>
        ))}

        <section style={s.section}>
          <strong>Waiting for you ({pending.length})</strong>
          {pending.length === 0 && <span style={s.muted}>Nothing to check.</span>}
          {pending.map((item) => {
            const request = peerHelp.allPeerHelp?.[item.requestId]
            const anchor = anchorFor(lesson, request, item)
            return (
              <div key={`${item.requestId}-${item.itemId}`} style={s.item}>
                <span style={s.muted}>
                  {nameOf(session, request?.helperId)} → {nameOf(session, request?.stuckId)}
                  {anchor ? ` · ${anchor.label}` : ''}
                </span>
                {item.kind === 'note' && <span style={s.note}>“{item.text}”</span>}
                {item.kind === 'edit' &&
                  editsFromWire(item.edits).map((edit, i) => (
                    <div key={i}>
                      {edit.op === 'replace' && <code style={s.removed}>- {edit.before}</code>}
                      <code style={s.added}>
                        + {edit.text}
                        {edit.op === 'insert' ? `   (new line after ${edit.line})` : ''}
                      </code>
                    </div>
                  ))}
                <div style={s.row}>
                  <button
                    type="button"
                    className="btn-primary"
                    style={s.btn}
                    onClick={() => peerHelp.approveItem(item.requestId, item.itemId)}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="btn-ghost-outline"
                    style={s.btn}
                    onClick={() => peerHelp.rejectItem(item.requestId, item.itemId)}
                  >
                    Reject
                  </button>
                </div>
              </div>
            )
          })}
        </section>

        <section style={s.section}>
          <strong>Helping now ({active.length})</strong>
          {active.length === 0 && <span style={s.muted}>No one.</span>}
          {active.map(([requestId, request]) => (
            <div key={requestId} style={s.rowBetween}>
              <span>
                {nameOf(session, request.helperId)} → {nameOf(session, request.stuckId)}
              </span>
              <button
                type="button"
                className="btn-ghost-outline"
                style={s.btn}
                onClick={() => peerHelp.endRequestAsTeacher(requestId)}
              >
                End
              </button>
            </div>
          ))}
        </section>

        {blocked.length > 0 && (
          <details style={s.section}>
            <summary>Notes the word filter stopped ({blocked.length})</summary>
            {blocked.map((item) => {
              const request = peerHelp.allPeerHelp?.[item.requestId]
              return (
                <div key={`${item.requestId}-${item.itemId}`} style={s.item}>
                  <span style={s.muted}>
                    {nameOf(session, request?.helperId)} → {nameOf(session, request?.stuckId)} ·{' '}
                    {item.blockedReason === 'contact' ? 'contact details or a link' : 'language'}
                  </span>
                  <span style={s.note}>“{item.text}”</span>
                </div>
              )
            })}
          </details>
        )}

        <section style={s.section}>
          <label style={s.check}>
            <input
              type="checkbox"
              checked={notesEnabled}
              onChange={(e) => peerHelp.setNotesEnabled(e.target.checked)}
            />
            Let helpers write short notes (you approve each one)
          </label>
          {paused ? (
            <button
              type="button"
              className="btn-ghost-outline"
              style={s.btn}
              onClick={() => peerHelp.resumePeerHelp()}
            >
              Turn peer help back on
            </button>
          ) : (
            <button
              type="button"
              className="btn-danger"
              style={s.btn}
              onClick={() => peerHelp.pauseAllPeerHelp()}
            >
              End all peer help
            </button>
          )}
        </section>
      </div>
    </DropdownMenu>
  )
}

const s = {
  panel: { right: 0, left: 'auto', width: 'min(440px, calc(100vw - 32px))' },
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 10,
    maxHeight: '70vh',
    // Opens from the dark top bar: set the text colour rather than inherit white.
    color: 'var(--colour-text)',
    overflowY: 'auto',
  },
  section: { display: 'flex', flexDirection: 'column', gap: 6 },
  alert: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: 8,
    borderRadius: 8,
    background: 'var(--colour-error-bg)',
    color: 'var(--colour-error-text)',
  },
  item: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    borderTop: '1px solid var(--ui-border)',
    paddingTop: 6,
  },
  note: { fontSize: 13 },
  removed: {
    display: 'block',
    fontFamily: 'var(--font-code)',
    fontSize: 12,
    whiteSpace: 'pre-wrap',
    background: 'var(--colour-error-bg)',
    color: 'var(--colour-error-text)',
    padding: '1px 6px',
  },
  added: {
    display: 'block',
    fontFamily: 'var(--font-code)',
    fontSize: 12,
    whiteSpace: 'pre-wrap',
    background: 'var(--colour-success-bg)',
    color: 'var(--colour-success-text)',
    padding: '1px 6px',
  },
  row: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  rowBetween: { display: 'flex', gap: 6, justifyContent: 'space-between', alignItems: 'center' },
  btn: { fontSize: 12, padding: '3px 10px' },
  muted: { fontSize: 12, color: 'var(--colour-muted)' },
  check: { display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 },
}
