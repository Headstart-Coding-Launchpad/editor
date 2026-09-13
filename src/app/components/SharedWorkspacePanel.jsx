import React, { useEffect, useMemo, useRef, useState } from 'react'
import { sortedShareEntries } from '../sharedWorkspacePayload'
import { formatTimeAgo } from '../../shared/timeAgo'

/**
 * Student-facing delivery for approved workspace shares: a toast when a new one
 * arrives, plus a persistent button opening the gallery of everything shared so
 * far this session.
 *
 * Nothing here is forced. A student chooses when to open a shared workspace,
 * and dismissing the toast is tracked client-side only — one student dismissing
 * must never clear it for the rest of the class, which is why "seen" state lives
 * in this component and is never written back to Firebase.
 */
export default function SharedWorkspacePanel({ sharedWorkspaces, viewerId, onOpen }) {
  const entries = useMemo(() => sortedShareEntries(sharedWorkspaces), [sharedWorkspaces])
  const [open, setOpen] = useState(false)
  const [toastEntry, setToastEntry] = useState(null)

  // Everything already present when this student arrives counts as seen, so
  // joining mid-lesson does not fire a backlog of toasts.
  const seenRef = useRef(null)
  if (seenRef.current === null) {
    seenRef.current = new Set(entries.map((e) => e.shareId))
  }

  useEffect(() => {
    const unseen = entries.filter((e) => !seenRef.current.has(e.shareId))
    if (unseen.length === 0) return
    for (const entry of unseen) seenRef.current.add(entry.shareId)
    // Never announce a student's own share back to them.
    const announceable = unseen.find((e) => e.sharerId !== viewerId)
    if (announceable) setToastEntry(announceable)
  }, [entries, viewerId])

  if (entries.length === 0) return null

  function openShare(entry) {
    setToastEntry(null)
    setOpen(false)
    onOpen?.(entry)
  }

  return (
    <>
      <button
        type="button"
        className="btn-ghost"
        style={s.galleryBtn}
        onClick={() => setOpen(true)}
        title="Work your classmates have shared"
      >
        📤 Shared work ({entries.length})
      </button>

      {toastEntry && (
        <div style={s.toast} role="status">
          <span style={s.toastText}>
            <strong>{toastEntry.sharerName}</strong> shared their work
            {toastEntry.taskTitle ? ` on ${toastEntry.taskTitle}` : ''}.
          </span>
          <div style={s.toastActions}>
            <button
              type="button"
              className="btn-primary"
              style={s.toastBtn}
              onClick={() => openShare(toastEntry)}
            >
              Take a look
            </button>
            <button
              type="button"
              className="btn-ghost"
              style={s.toastBtn}
              onClick={() => setToastEntry(null)}
            >
              Not now
            </button>
          </div>
        </div>
      )}

      {open && (
        <div style={s.overlay} onClick={() => setOpen(false)}>
          <div
            style={s.modal}
            role="dialog"
            aria-label="Shared work"
            onClick={(e) => e.stopPropagation()}
          >
            <div style={s.modalHeader}>
              <span style={s.modalTitle}>📤 Shared work</span>
              <button
                type="button"
                className="btn-ghost"
                style={s.closeBtn}
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p style={s.modalNote}>
              Open one to run it and try it out. Your own work stays exactly as you left it.
            </p>
            <ul style={s.list}>
              {entries.map((entry) => (
                <li key={entry.shareId} style={s.row}>
                  <div style={s.rowMain}>
                    <span style={s.rowName}>
                      {entry.sharerName}
                      {entry.sharerId === viewerId ? ' (you)' : ''}
                    </span>
                    <span style={s.rowMeta}>
                      {entry.taskTitle ? `${entry.taskTitle} · ` : ''}
                      {formatTimeAgo(entry.sharedAt) ?? ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn-primary"
                    style={s.openBtn}
                    onClick={() => openShare(entry)}
                  >
                    Open
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  )
}

const s = {
  galleryBtn: { fontSize: 13, padding: '5px 12px', flexShrink: 0 },
  toast: {
    position: 'fixed',
    right: 16,
    bottom: 16,
    zIndex: 1200,
    width: 'min(320px, 90vw)',
    padding: 14,
    borderRadius: 10,
    background: 'var(--colour-surface, #fff)',
    border: '1px solid #0d9488',
    boxShadow: '0 12px 32px rgba(0,0,0,0.22)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  toastText: { fontSize: 13 },
  toastActions: { display: 'flex', gap: 8 },
  toastBtn: { fontSize: 12, padding: '5px 10px' },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    zIndex: 1250,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modal: {
    width: 'min(520px, 100%)',
    maxHeight: '80vh',
    overflow: 'auto',
    background: 'var(--colour-surface, #fff)',
    borderRadius: 12,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  modalTitle: { fontWeight: 700, fontSize: 16 },
  closeBtn: { fontSize: 14, padding: '2px 8px' },
  modalNote: { margin: 0, fontSize: 12, color: 'var(--colour-muted)' },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid var(--colour-border, #e5e5e5)',
  },
  rowMain: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  rowName: { fontWeight: 600, fontSize: 13 },
  rowMeta: { fontSize: 11, color: 'var(--colour-muted)' },
  openBtn: { fontSize: 12, padding: '5px 12px', flexShrink: 0 },
}
