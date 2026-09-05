import React, { useEffect, useState } from 'react'
import SharedWorkspacePreview from '../SharedWorkspacePreview'
import { findTaskById } from '../../../shared/taskUtils'

/**
 * Teacher-facing review of one student's pending workspace share.
 *
 * The preview is deliberately NOT the live watch view: it renders the frozen
 * snapshot the class would actually receive, which may already differ from what
 * the student is doing right now. Approving without that distinction being
 * obvious would mean approving content the teacher never saw.
 */
export default function ShareRequestPanel({
  student,
  lesson,
  onReadPendingShare,
  onApprove,
  onDecline,
  awaitingSnapshot = false,
  fill = false,
}) {
  const requestedAt = student?.shareRequestedAt ?? null
  const [snapshot, setSnapshot] = useState(null)
  const [status, setStatus] = useState('idle') // idle | loading | ready | missing
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    if (requestedAt == null) {
      setSnapshot(null)
      setStatus('idle')
      return undefined
    }
    setStatus('loading')
    onReadPendingShare(student.anonymousId)
      .then((loaded) => {
        if (cancelled) return
        setSnapshot(loaded)
        setStatus(loaded ? 'ready' : 'missing')
      })
      .catch(() => {
        if (cancelled) return
        setStatus('missing')
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedAt, student?.anonymousId])

  if (requestedAt == null) {
    if (!awaitingSnapshot) return null
    return (
      <div style={fill ? { ...s.panel, ...s.panelFill } : s.panel}>
        <div style={s.header}>
          <span style={s.title}>📤 Preparing a share</span>
        </div>
        <p style={s.note}>Asking {student.displayName}&apos;s device for a current snapshot…</p>
      </div>
    )
  }

  const task = findTaskById(lesson?.tasks, snapshot?.taskId)
  const byTeacher = student.shareRequestOrigin === 'teacher'

  async function run(action, fn) {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(err?.message ?? `Could not ${action} this share.`)
      setBusy(false)
    }
  }

  return (
    <div style={fill ? { ...s.panel, ...s.panelFill } : s.panel}>
      <div style={s.header}>
        <span style={s.title}>
          📤 {byTeacher ? 'Ready to share with the class' : 'Wants to share with the class'}
        </span>
        {task?.title && <span style={s.taskTag}>{task.title}</span>}
      </div>

      <p style={s.note}>
        This is a frozen snapshot taken when {byTeacher ? 'you asked for it' : 'they asked'} — not
        their live work. Approving sends exactly this to the class.
      </p>

      {status === 'loading' && <p style={s.note}>Loading their workspace…</p>}
      {status === 'missing' && (
        <p style={s.note}>That share is no longer available — the student may have withdrawn it.</p>
      )}
      {status === 'ready' && (
        <div style={fill ? { ...s.previewBox, ...s.previewBoxFill } : s.previewBox}>
          <SharedWorkspacePreview lesson={lesson} snapshot={snapshot} />
        </div>
      )}

      {error && (
        <p style={s.error} role="alert">
          {error}
        </p>
      )}

      <div style={s.actions}>
        <button
          type="button"
          className="btn-primary"
          style={s.actionBtn}
          disabled={busy || status !== 'ready'}
          onClick={() => run('approve', () => onApprove(student.anonymousId, { student, task }))}
        >
          Approve &amp; share
        </button>
        <button
          type="button"
          className="btn-ghost"
          style={s.actionBtn}
          disabled={busy}
          onClick={() => run('decline', () => onDecline(student.anonymousId))}
        >
          Decline
        </button>
      </div>
    </div>
  )
}

const s = {
  panel: {
    border: '1px solid #0d9488',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    background: 'rgba(13, 148, 136, 0.06)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  // When the request is the modal's only content it should use the space,
  // rather than leaving the teacher squinting at a 320px preview.
  panelFill: { flex: 1, minHeight: 0, marginBottom: 0 },
  header: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  title: { fontWeight: 700, fontSize: 14 },
  taskTag: {
    fontSize: 11,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 999,
    background: '#0d9488',
    color: '#fff',
  },
  note: { margin: 0, fontSize: 12, color: 'var(--colour-muted)' },
  previewBoxFill: { maxHeight: 'none', flex: 1 },
  previewBox: {
    maxHeight: 320,
    overflow: 'auto',
    border: '1px solid var(--colour-border, #ddd)',
    borderRadius: 8,
    background: 'var(--colour-surface, #fff)',
  },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  actionBtn: { fontSize: 13, padding: '6px 14px' },
  error: { margin: 0, fontSize: 12, color: 'var(--colour-danger)' },
}
