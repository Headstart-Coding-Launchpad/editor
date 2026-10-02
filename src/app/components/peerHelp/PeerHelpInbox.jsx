import React, { useMemo, useState } from 'react'
import { editsFromWire, sortedItems } from '../../../shared/peerHelp'
import { describeItem, findAnchor, peerHelpAnchors } from '../../peerHelpAnchors'

/**
 * The stuck student's view of peer help: whether a classmate is helping (never who), what has
 * arrived, and a response for each item. "🚩 Not OK" on anything hides it, ends the help and
 * tells the teacher straight away.
 */
export default function PeerHelpInbox({
  offer,
  state,
  inbox,
  snapshot,
  lessonType,
  task,
  onRespond,
  onAcceptEdit,
  onNotOk,
  onEnd,
  onClose,
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [editProblem, setEditProblem] = useState(null)
  const anchors = useMemo(
    () => peerHelpAnchors(snapshot, lessonType, task),
    [snapshot, lessonType, task]
  )
  const items = sortedItems(inbox).filter((item) => item.response !== 'not_ok')
  const ended = !!state?.endedAt
  const status = ended
    ? 'Help from a classmate has finished.'
    : offer?.claimedAt
      ? 'A classmate is looking at your code.'
      : offer
        ? 'Your teacher has asked the class. Waiting for a helper…'
        : 'Waiting for your teacher to check first…'

  async function accept(item) {
    setEditProblem(null)
    const ok = await onAcceptEdit({ ...item, edits: editsFromWire(item.edits) })
    if (ok) await onRespond(item.itemId, 'accepted')
    else
      setEditProblem(
        'Your code has changed since then, so this can’t be added for you. You can copy it by hand.'
      )
  }

  return (
    <section style={s.card} aria-label="Help from a classmate" data-testid="peer-help-inbox">
      <header style={s.header}>
        <strong>🤝 Help from a classmate</strong>
        <button
          type="button"
          className="btn-ghost-outline"
          style={s.small}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((c) => !c)}
        >
          {collapsed ? 'Show' : 'Hide'}
        </button>
      </header>
      {!collapsed && (
        <>
          <span style={s.status}>{status}</span>
          {items.length > 0 && (
            <ul style={s.list}>
              {items.map((item) => {
                const anchor = findAnchor(anchors, item.file, item.line)
                return (
                  <li key={item.itemId} style={s.item}>
                    <span style={s.what}>
                      {anchor ? <span style={s.where}>{anchor.label}</span> : null}
                      {describeItem(item, lessonType, task)}
                    </span>
                    {anchor?.text && item.kind !== 'edit' && (
                      <code style={s.code}>{anchor.text}</code>
                    )}
                    {item.kind === 'edit' && (
                      <div style={s.diff}>
                        {editsFromWire(item.edits).map((edit, i) => (
                          <div key={i}>
                            {edit.op === 'replace' && (
                              <code style={s.removed}>- {edit.before}</code>
                            )}
                            <code style={s.added}>+ {edit.text}</code>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={s.actions}>
                      {item.kind === 'edit' && !item.response && (
                        <>
                          <button
                            type="button"
                            className="btn-primary"
                            style={s.small}
                            onClick={() => accept(item)}
                          >
                            Use this change
                          </button>
                          <button
                            type="button"
                            className="btn-ghost-outline"
                            style={s.small}
                            onClick={() => onRespond(item.itemId, 'declined')}
                          >
                            No thanks
                          </button>
                        </>
                      )}
                      {item.kind !== 'edit' && !item.response && (
                        <button
                          type="button"
                          className="btn-ghost-outline"
                          style={s.small}
                          onClick={() => onRespond(item.itemId, 'useful')}
                        >
                          👍 Useful
                        </button>
                      )}
                      {item.response === 'useful' && (
                        <span style={s.muted}>You said this helped</span>
                      )}
                      {item.response === 'accepted' && (
                        <span style={s.muted}>Added to your code</span>
                      )}
                      {item.response === 'declined' && <span style={s.muted}>No thanks</span>}
                      <button
                        type="button"
                        className="btn-ghost-outline"
                        style={s.small}
                        title="Hide this and tell your teacher"
                        onClick={() => onNotOk(item.itemId)}
                      >
                        🚩 Not OK
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          {editProblem && <span style={s.problem}>{editProblem}</span>}
          <div style={s.footer}>
            {!ended && (
              <button
                type="button"
                className="btn-ghost-outline"
                style={s.small}
                title="Stop and tell your teacher"
                onClick={() => onNotOk(null)}
              >
                🚩 Something’s not OK
              </button>
            )}
            {ended ? (
              <button type="button" className="btn-primary" style={s.small} onClick={onClose}>
                Close
              </button>
            ) : (
              <button type="button" className="btn-ghost-outline" style={s.small} onClick={onEnd}>
                I’m OK now
              </button>
            )}
          </div>
        </>
      )}
    </section>
  )
}

const s = {
  card: {
    position: 'fixed',
    right: 16,
    bottom: 16,
    zIndex: 900,
    width: 'min(380px, calc(100vw - 32px))',
    maxHeight: '60vh',
    overflowY: 'auto',
    background: 'var(--ui-surface)',
    color: 'var(--colour-text)',
    border: '2px solid #0d9488',
    borderRadius: 12,
    padding: 12,
    boxShadow: 'var(--ui-shadow)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  status: { fontSize: 13, color: 'var(--colour-muted)' },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  item: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    borderTop: '1px solid var(--ui-border)',
    paddingTop: 6,
  },
  what: { fontSize: 13, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'baseline' },
  where: { fontWeight: 700 },
  code: {
    fontFamily: 'var(--font-code)',
    fontSize: 12,
    whiteSpace: 'pre-wrap',
    background: 'var(--ui-surface-soft)',
    padding: '2px 6px',
    borderRadius: 4,
  },
  diff: { display: 'flex', flexDirection: 'column', gap: 2 },
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
  actions: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' },
  footer: { display: 'flex', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' },
  small: { fontSize: 12, padding: '3px 10px' },
  muted: { fontSize: 12, color: 'var(--colour-muted)' },
  problem: { fontSize: 12, color: 'var(--colour-warning-text)' },
}
