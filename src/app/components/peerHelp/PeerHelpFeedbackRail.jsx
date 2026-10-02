import React, { useMemo, useState } from 'react'
import {
  PEER_EDIT_MAX_LINES,
  PEER_NOTE_MAX_LENGTH,
  getPeerHints,
  sortedItems,
  validatePeerEdit,
} from '../../../shared/peerHelp'
import { findBlockedContent } from '../../../shared/peerHelpFilter'
import { describeItem, findAnchor, peerHelpCapability } from '../../peerHelpAnchors'

const STATUS_LABELS = {
  delivered: 'Sent',
  pending: 'Waiting for your teacher',
  approved: 'Teacher approved',
  rejected: 'Teacher said no',
  blocked: 'Not sent',
}

const RESPONSE_LABELS = {
  useful: '👍 They found this useful',
  accepted: '✅ They used your change',
  declined: 'They said no thanks',
}

/**
 * The helper's side panel: pick a line (or a Scratch script), then 👍 / 👎 it, send a preset
 * hint, and, where allowed, suggest a small change or write a short note for the teacher to
 * check. Nothing here can send words of the helper's own straight to the stuck student.
 */
export default function PeerHelpFeedbackRail({
  anchors,
  lessonType,
  task,
  inbox,
  review,
  notesEnabled,
  ended,
  onMark,
  onHint,
  onSubmitEdit,
  onSubmitNote,
}) {
  const [selectedKey, setSelectedKey] = useState(null)
  const [hintId, setHintId] = useState('')
  const [draftEdits, setDraftEdits] = useState([])
  const [editError, setEditError] = useState(null)
  const [note, setNote] = useState('')
  const [noteMessage, setNoteMessage] = useState(null)
  const [busy, setBusy] = useState(false)

  const capability = peerHelpCapability(lessonType)
  const anchorNoun = capability?.anchors === 'scripts' ? 'script' : 'line'
  const hints = useMemo(
    () => getPeerHints(peerHelpCapability(lessonType)?.hints, task),
    [lessonType, task]
  )
  const selected = anchors.find((a) => a.key === selectedKey) ?? null
  const inboxItems = sortedItems(inbox)
  const reviewItems = sortedItems(review)

  // The helper's latest verdict per anchor ('up' | 'down').
  const verdicts = useMemo(() => {
    const map = {}
    for (const item of inboxItems) {
      if (item.kind === 'mark') map[`${item.file ?? ''}:${item.line}`] = item.verdict
    }
    return map
  }, [inboxItems])

  const downLinesByFile = useMemo(() => {
    const map = {}
    for (const [key, verdict] of Object.entries(verdicts)) {
      if (verdict !== 'down') continue
      const cut = key.lastIndexOf(':')
      const file = key.slice(0, cut)
      ;(map[file] ??= []).push(Number(key.slice(cut + 1)))
    }
    return map
  }, [verdicts])

  async function run(action) {
    setBusy(true)
    try {
      await action()
    } catch {
      // The rules refused it (help ended, or peer help paused); the panel shows the state.
    } finally {
      setBusy(false)
    }
  }

  const editFile = draftEdits[0]?.file ?? selected?.file ?? ''
  const canEditSelected =
    !!selected?.editable &&
    verdicts[selected.key] === 'down' &&
    (draftEdits.length === 0 || draftEdits[0].file === selected.file)

  function addDraftEdit(op, line) {
    if (!selected) return
    const anchor = findAnchor(anchors, selected.file, line)
    setEditError(null)
    setDraftEdits((edits) =>
      edits.length >= PEER_EDIT_MAX_LINES
        ? edits
        : [
            ...edits,
            {
              file: selected.file,
              line,
              op,
              text: op === 'replace' ? (anchor?.text ?? '') : '',
              before: anchor?.text ?? '',
            },
          ]
    )
  }

  async function sendEdit() {
    const fileLines = anchors.filter((a) => a.file === editFile).length
    const problem = validatePeerEdit({
      edits: draftEdits,
      downLines: downLinesByFile[editFile] ?? [],
      lineCount: fileLines,
    })
    if (problem) {
      setEditError(problem)
      return
    }
    await run(() => onSubmitEdit({ file: editFile, edits: draftEdits }))
    setDraftEdits([])
  }

  async function sendNote() {
    const text = note.trim()
    if (!text || !selected) return
    const blockedReason = findBlockedContent(text)
    await run(() => onSubmitNote({ file: selected.file, line: selected.line, text, blockedReason }))
    setNote('')
    setNoteMessage(
      blockedReason
        ? 'That note was not sent. Keep it kind, and about the code. Your teacher can see it.'
        : 'Sent to your teacher to check.'
    )
  }

  return (
    <aside style={s.rail} aria-label="Help your classmate">
      <div style={s.section}>
        <strong style={s.heading}>1. Pick a {anchorNoun}</strong>
        <div style={s.lines} role="listbox" aria-label="Their code">
          {anchors.length === 0 && <span style={s.muted}>Nothing to look at yet.</span>}
          {anchors.map((anchor) => (
            <button
              key={anchor.key}
              type="button"
              role="option"
              aria-selected={anchor.key === selectedKey}
              style={{ ...s.line, ...(anchor.key === selectedKey ? s.lineSelected : null) }}
              onClick={() => {
                setSelectedKey(anchor.key)
                setNoteMessage(null)
              }}
            >
              <span style={s.lineLabel}>{anchor.label}</span>
              <code style={s.lineText}>{anchor.text || ' '}</code>
              {verdicts[anchor.key] && (
                <span aria-label={verdicts[anchor.key] === 'up' ? 'looks right' : 'look again'}>
                  {verdicts[anchor.key] === 'up' ? '👍' : '👎'}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {selected && !ended && (
        <div style={s.section}>
          <strong style={s.heading}>2. Help with {selected.label}</strong>
          <div style={s.row}>
            <button
              type="button"
              className="btn-ghost-outline"
              disabled={busy}
              onClick={() =>
                run(() => onMark({ file: selected.file, line: selected.line, verdict: 'up' }))
              }
            >
              👍 Looks right
            </button>
            <button
              type="button"
              className="btn-ghost-outline"
              disabled={busy}
              onClick={() =>
                run(() => onMark({ file: selected.file, line: selected.line, verdict: 'down' }))
              }
            >
              👎 Look again
            </button>
          </div>
          <div style={s.row}>
            <select
              value={hintId}
              onChange={(e) => setHintId(e.target.value)}
              style={s.select}
              aria-label="Pick a hint"
            >
              <option value="">Pick a hint…</option>
              {hints.map((hint) => (
                <option key={hint.id} value={hint.id}>
                  {hint.text}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn-primary"
              disabled={busy || !hintId}
              onClick={() =>
                run(async () => {
                  await onHint({ file: selected.file, line: selected.line, hintId })
                  setHintId('')
                })
              }
            >
              Send hint
            </button>
          </div>

          {selected.editable && onSubmitEdit && (
            <div style={s.sub}>
              <span style={s.muted}>
                Suggest a change (your teacher checks it first). Only on lines you marked 👎, at
                most {PEER_EDIT_MAX_LINES} lines.
              </span>
              {canEditSelected && draftEdits.length < PEER_EDIT_MAX_LINES && (
                <div style={s.row}>
                  <button
                    type="button"
                    className="btn-ghost-outline"
                    onClick={() => addDraftEdit('replace', selected.line)}
                  >
                    ✏️ Change this line
                  </button>
                  <button
                    type="button"
                    className="btn-ghost-outline"
                    onClick={() => addDraftEdit('insert', selected.line)}
                  >
                    ➕ Add a line after
                  </button>
                  {selected.line > 1 && (
                    <button
                      type="button"
                      className="btn-ghost-outline"
                      onClick={() => addDraftEdit('insert', selected.line - 1)}
                    >
                      ➕ Add a line before
                    </button>
                  )}
                </div>
              )}
              {draftEdits.map((edit, index) => (
                <div key={index} style={s.draft}>
                  <span style={s.muted}>
                    {edit.op === 'replace'
                      ? `Line ${edit.line} becomes`
                      : `New line after ${edit.line}`}
                  </span>
                  <input
                    style={s.input}
                    value={edit.text}
                    maxLength={200}
                    aria-label={`Suggested line ${index + 1}`}
                    onChange={(e) =>
                      setDraftEdits((edits) =>
                        edits.map((d, i) => (i === index ? { ...d, text: e.target.value } : d))
                      )
                    }
                  />
                  <button
                    type="button"
                    className="btn-ghost-outline"
                    aria-label="Remove this change"
                    onClick={() => setDraftEdits((edits) => edits.filter((_, i) => i !== index))}
                  >
                    ✕
                  </button>
                </div>
              ))}
              {editError && <span style={s.error}>{editError}</span>}
              {draftEdits.length > 0 && (
                <button type="button" className="btn-primary" disabled={busy} onClick={sendEdit}>
                  Send change to teacher
                </button>
              )}
            </div>
          )}

          {notesEnabled && onSubmitNote && (
            <div style={s.sub}>
              <span style={s.muted}>
                Write a short note about this {anchorNoun} (your teacher checks it first).
              </span>
              <textarea
                style={s.textarea}
                value={note}
                maxLength={PEER_NOTE_MAX_LENGTH}
                rows={2}
                aria-label="Note"
                onChange={(e) => {
                  setNote(e.target.value)
                  setNoteMessage(null)
                }}
              />
              <div style={s.row}>
                <span style={s.muted}>
                  {note.length}/{PEER_NOTE_MAX_LENGTH}
                </span>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busy || !note.trim()}
                  onClick={sendNote}
                >
                  Send note to teacher
                </button>
              </div>
            </div>
          )}
          {noteMessage && <span style={s.muted}>{noteMessage}</span>}
        </div>
      )}

      {(inboxItems.length > 0 || reviewItems.length > 0) && (
        <div style={s.section}>
          <strong style={s.heading}>What you sent</strong>
          <ul style={s.sent}>
            {[...inboxItems.filter((i) => !i.reviewItemId), ...reviewItems].map((item) => {
              const anchor = findAnchor(anchors, item.file, item.line)
              const status = item.status ?? 'delivered'
              return (
                <li key={item.itemId} style={s.sentItem}>
                  <span>
                    {anchor ? `${anchor.label}: ` : ''}
                    {describeItem(item, lessonType, task)}
                  </span>
                  <span style={s.chip}>{STATUS_LABELS[status] ?? status}</span>
                  {RESPONSE_LABELS[item.response] && (
                    <span style={s.muted}>{RESPONSE_LABELS[item.response]}</span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </aside>
  )
}

const s = {
  rail: {
    width: 'min(360px, 40vw)',
    minWidth: 260,
    borderLeft: '1px solid var(--ui-border)',
    background: 'var(--ui-surface-soft)',
    color: 'var(--colour-text)',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 10,
    flexShrink: 0,
  },
  section: { display: 'flex', flexDirection: 'column', gap: 6 },
  sub: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    borderTop: '1px dashed var(--ui-border)',
    paddingTop: 8,
  },
  heading: { fontSize: 13 },
  lines: {
    display: 'flex',
    flexDirection: 'column',
    maxHeight: 260,
    overflowY: 'auto',
    border: '1px solid var(--ui-border)',
    borderRadius: 'var(--ui-radius-sm)',
    background: 'var(--ui-surface)',
  },
  line: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
    padding: '3px 8px',
    border: 'none',
    background: 'transparent',
    textAlign: 'left',
    cursor: 'pointer',
    fontSize: 12,
    color: 'inherit',
  },
  lineSelected: {
    background: 'var(--ui-surface-tint)',
    outline: '2px solid var(--colour-primary)',
  },
  lineLabel: { color: 'var(--colour-muted)', whiteSpace: 'nowrap', minWidth: 52 },
  lineText: {
    fontFamily: 'var(--font-code)',
    whiteSpace: 'pre',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    flex: 1,
  },
  row: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' },
  select: { flex: 1, minWidth: 0, fontSize: 13, padding: 4 },
  draft: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  input: { flex: 1, minWidth: 120, fontFamily: 'var(--font-code)', fontSize: 12, padding: 4 },
  textarea: { width: '100%', fontSize: 13, padding: 6, boxSizing: 'border-box' },
  muted: { fontSize: 12, color: 'var(--colour-muted)' },
  error: { fontSize: 12, color: 'var(--colour-error-text)' },
  sent: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  sentItem: { display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12 },
  chip: { alignSelf: 'flex-start', fontSize: 11, color: 'var(--colour-muted)' },
}
