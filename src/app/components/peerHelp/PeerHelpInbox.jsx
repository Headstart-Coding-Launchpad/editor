import React, { useMemo, useState } from 'react'
import { editsFromWire, sortedItems } from '../../../shared/peerHelp'
import { describeItem, findAnchor, peerHelpAnchors } from '../../peerHelpAnchors'

/**
 * The stuck student's card. Made for 9-year-olds: what arrived and which line it is about, a
 * "Thanks 👍" on each, a small 🚩 to tell the teacher, and one big "I'm OK now". Never says who is
 * helping. 🚩 hides that item, ends the help and alerts the teacher straight away.
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
  const [editProblem, setEditProblem] = useState(null)
  const anchors = useMemo(
    () => peerHelpAnchors(snapshot, lessonType, task),
    [snapshot, lessonType, task]
  )
  const items = sortedItems(inbox).filter((item) => item.response !== 'not_ok')
  const ended = !!state?.endedAt
  const status = ended
    ? '🎉 All done!'
    : offer?.claimedAt
      ? '🤝 A classmate is helping you'
      : offer
        ? '⏳ Finding a classmate…'
        : '⏳ Your teacher will check first'

  async function accept(item) {
    setEditProblem(null)
    const ok = await onAcceptEdit({ ...item, edits: editsFromWire(item.edits) })
    if (ok) await onRespond(item.itemId, 'accepted')
    else setEditProblem('Your code has changed, so copy it in yourself.')
  }

  return (
    <section style={s.card} aria-label="Help from a classmate" data-testid="peer-help-inbox">
      <strong style={s.status}>{status}</strong>
      {items.length > 0 && (
        <ul style={s.list}>
          {items.map((item) => {
            const anchor = findAnchor(anchors, item.file, item.line)
            return (
              <li key={item.itemId} style={s.item}>
                <span style={s.what}>
                  {anchor && <span style={s.where}>{anchor.label}:</span>}
                  {describeItem(item, lessonType, task)}
                </span>
                {anchor?.text && item.kind !== 'edit' && <code style={s.code}>{anchor.text}</code>}
                {item.kind === 'edit' && (
                  <div style={s.diff}>
                    {editsFromWire(item.edits).map((edit, i) => (
                      <div key={i}>
                        {edit.op === 'replace' && <code style={s.removed}>- {edit.before}</code>}
                        <code style={s.added}>+ {edit.text}</code>
                      </div>
                    ))}
                  </div>
                )}
                <div style={s.actions}>
                  {!item.response && item.kind === 'edit' && (
                    <>
                      <button
                        type="button"
                        className="btn-primary"
                        style={s.btn}
                        onClick={() => accept(item)}
                      >
                        Use it
                      </button>
                      <button
                        type="button"
                        className="btn-ghost-outline"
                        style={s.btn}
                        onClick={() => onRespond(item.itemId, 'declined')}
                      >
                        No thanks
                      </button>
                    </>
                  )}
                  {!item.response && item.kind !== 'edit' && (
                    <button
                      type="button"
                      className="btn-ghost-outline"
                      style={s.btn}
                      onClick={() => onRespond(item.itemId, 'useful')}
                    >
                      Thanks 👍
                    </button>
                  )}
                  {(item.response === 'useful' || item.response === 'accepted') && (
                    <span style={s.done}>👍 Thanked</span>
                  )}
                  <button
                    type="button"
                    style={s.flag}
                    aria-label="Not OK: tell my teacher"
                    title="Not OK? Tell my teacher"
                    onClick={() => onNotOk(item.itemId)}
                  >
                    🚩
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {editProblem && <span style={s.problem}>{editProblem}</span>}
      <button
        type="button"
        className={ended ? 'btn-primary' : 'btn-ghost-outline'}
        style={s.big}
        onClick={ended ? onClose : onEnd}
      >
        {ended ? 'Close' : 'I’m OK now'}
      </button>
    </section>
  )
}

const s = {
  card: {
    position: 'fixed',
    right: 16,
    bottom: 16,
    zIndex: 900,
    width: 'min(360px, calc(100vw - 32px))',
    maxHeight: '60vh',
    overflowY: 'auto',
    background: 'var(--ui-surface)',
    color: 'var(--colour-text)',
    border: '2px solid #0d9488',
    borderRadius: 14,
    padding: 14,
    boxShadow: 'var(--ui-shadow)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  status: { fontSize: 17 },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  item: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    borderTop: '1px solid var(--ui-border)',
    paddingTop: 8,
  },
  what: { fontSize: 16, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'baseline' },
  where: { fontWeight: 700 },
  code: {
    fontFamily: 'var(--font-code)',
    fontSize: 14,
    whiteSpace: 'pre-wrap',
    background: 'var(--ui-surface-soft)',
    padding: '3px 8px',
    borderRadius: 6,
  },
  diff: { display: 'flex', flexDirection: 'column', gap: 2 },
  removed: {
    display: 'block',
    fontFamily: 'var(--font-code)',
    fontSize: 13,
    whiteSpace: 'pre-wrap',
    background: 'var(--colour-error-bg)',
    color: 'var(--colour-error-text)',
    padding: '1px 6px',
  },
  added: {
    display: 'block',
    fontFamily: 'var(--font-code)',
    fontSize: 13,
    whiteSpace: 'pre-wrap',
    background: 'var(--colour-success-bg)',
    color: 'var(--colour-success-text)',
    padding: '1px 6px',
  },
  actions: { display: 'flex', gap: 8, alignItems: 'center' },
  btn: { fontSize: 15, padding: '5px 14px' },
  done: { fontSize: 14, color: 'var(--colour-success-text)' },
  // Small on purpose: always there, never the main action.
  flag: {
    marginLeft: 'auto',
    fontSize: 16,
    padding: '2px 6px',
    background: 'transparent',
    border: '1px solid var(--ui-border)',
    borderRadius: 6,
    cursor: 'pointer',
  },
  problem: { fontSize: 14, color: 'var(--colour-warning-text)' },
  big: { fontSize: 16, padding: '10px 14px', width: '100%' },
}
