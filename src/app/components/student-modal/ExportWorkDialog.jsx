// "Export work" (StudentModal ▸ More): the tutor downloads one student's work — this task or
// the whole lesson — as code files (.py, HTML .zip / single .html, Scratch .sb3 + LaunchPad
// JSON) and pictures (PNG), and can make a name-hidden share link for one task. Live only: it
// uses what the tutor already has (the live mirror and logged submissions; see
// src/shared/exportWork/collect.js). Nothing is written to the student.
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../auth/useAuth'
import { collectExportItems, exportableTasks } from '../../../shared/exportWork/collect.js'
import { hasExporter, loadExporters } from '../../../shared/exportWork/exporters.js'
import { downloadFile } from '../../../shared/exportWork/pictures.js'
import { exportContext, runExport } from '../../../shared/exportWork/runExport.js'
import { SHARE_TTL_DAYS, shareUrl } from '../../../shared/exportWork/shareLink.js'
import { createShareLink, revokeShareLink } from '../../../shared/exportWork/shareService.js'

export default function ExportWorkDialog({ student, lesson, session, onClose }) {
  const { user } = useAuth()
  const [items, setItems] = useState(null) // null while loading
  const [loadError, setLoadError] = useState(null)
  const [scope, setScope] = useState('task')
  const [code, setCode] = useState(true)
  const [pictures, setPictures] = useState(true)
  const [includeName, setIncludeName] = useState(false)
  const [makeShare, setMakeShare] = useState(false)
  const [busy, setBusy] = useState(null) // progress text while exporting
  const [result, setResult] = useState(null) // { names, notes, share }
  const [revoked, setRevoked] = useState(false)
  const [copied, setCopied] = useState(false)

  const candidates = useMemo(() => exportableTasks(lesson, session, hasExporter), [lesson, session])

  useEffect(() => {
    let cancelled = false
    loadExporters(candidates.map((c) => c.moduleType))
      .then((exporters) => {
        if (cancelled) return
        setItems(
          collectExportItems({
            candidates,
            session,
            student,
            getExporter: (type) => exporters[type],
          })
        )
      })
      .catch((error) => !cancelled && setLoadError(error.message))
    return () => {
      cancelled = true
    }
    // Collected once when the dialog opens: a frozen picture of the work at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const currentItem = useMemo(
    () =>
      items?.find(
        (item) =>
          session?.currentTaskId != null && String(item.task.id) === String(session.currentTaskId)
      ) ?? null,
    [items, session?.currentTaskId]
  )
  // With nothing on the current task, the whole lesson is the only choice.
  const effectiveScope = currentItem ? scope : 'lesson'
  const chosen = effectiveScope === 'task' ? [currentItem] : (items ?? [])
  const canShare = effectiveScope === 'task' && !!user?.uid
  const nothingChosen = !code && !pictures && !(makeShare && canShare)

  async function handleExport() {
    setBusy('Starting…')
    setResult(null)
    setRevoked(false)
    try {
      const date = new Date()
      const out = await runExport({
        items: chosen,
        options: { code, pictures },
        includeName,
        displayName: student.displayName,
        bundleTitle: effectiveScope === 'task' ? currentItem?.task.title : lesson?.title,
        date,
        onProgress: (label) => setBusy(`Making ${label}…`),
      })
      if (out.download) downloadFile(out.download.name, out.download.data, out.download.mime)
      let share = null
      if (makeShare && canShare) {
        setBusy('Making the share link…')
        const ctx = exportContext(currentItem, { date, displayName: '', includeName: false })
        const payload = currentItem.exporter.sharePayload(currentItem, ctx)
        const created = await createShareLink({
          kind: currentItem.moduleType,
          title: currentItem.task.title,
          payload,
          uid: user.uid,
        })
        share = created.ok
          ? { id: created.id, url: shareUrl(created.id, { base: import.meta.env.BASE_URL }) }
          : { error: created.message }
      }
      setResult({
        download: out.download?.name ?? null,
        count: out.files.length,
        notes: out.notes,
        share,
      })
    } catch (error) {
      setResult({ download: null, count: 0, notes: [`Export failed: ${error.message}`] })
    } finally {
      setBusy(null)
    }
  }

  async function handleRevoke() {
    if (!result?.share?.id) return
    try {
      await revokeShareLink(result.share.id)
      setRevoked(true)
    } catch (error) {
      setResult((prev) => ({ ...prev, notes: [...prev.notes, `Revoke failed: ${error.message}`] }))
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(result.share.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div
      style={s.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div style={s.modal} role="dialog" aria-modal="true" aria-label="Export work">
        <div style={s.header}>
          <span style={s.title}>Export work</span>
          <button style={s.closeBtn} onClick={onClose} disabled={!!busy} aria-label="Close">
            ✕
          </button>
        </div>
        <div style={s.body}>
          <p style={s.hint}>
            Downloads to this computer only. Nothing is sent to the student. File names use the task
            title and today&apos;s date.
          </p>
          {loadError && <p style={s.error}>Couldn&apos;t load the exporters: {loadError}</p>}
          {!items && !loadError && <p style={s.hint}>Gathering the work…</p>}
          {items && items.length === 0 && (
            <p style={s.hint}>
              There&apos;s no work to export yet: the student hasn&apos;t run or submitted a code
              task this session.
            </p>
          )}
          {items && items.length > 0 && (
            <>
              <fieldset style={s.fieldset}>
                <legend style={s.legend}>What</legend>
                <label style={s.option}>
                  <input
                    type="radio"
                    name="export-scope"
                    checked={effectiveScope === 'task'}
                    disabled={!currentItem}
                    onChange={() => setScope('task')}
                  />
                  This task
                  {currentItem ? (
                    <span style={s.muted}>
                      {' '}
                      ({currentItem.task.title || 'untitled'},{' '}
                      {currentItem.source === 'live' ? 'live work' : 'last submission'})
                    </span>
                  ) : (
                    <span style={s.muted}> (nothing on this task yet)</span>
                  )}
                </label>
                <label style={s.option}>
                  <input
                    type="radio"
                    name="export-scope"
                    checked={effectiveScope === 'lesson'}
                    onChange={() => setScope('lesson')}
                  />
                  Whole lesson
                  <span style={s.muted}>
                    {' '}
                    ({items.length} task{items.length === 1 ? '' : 's'} with work)
                  </span>
                </label>
              </fieldset>
              <fieldset style={s.fieldset}>
                <legend style={s.legend}>Include</legend>
                <label style={s.option}>
                  <input
                    type="checkbox"
                    checked={code}
                    onChange={(e) => setCode(e.target.checked)}
                  />
                  Code files <span style={s.muted}>(.py, HTML .zip and .html, Scratch .sb3)</span>
                </label>
                <label style={s.option}>
                  <input
                    type="checkbox"
                    checked={pictures}
                    onChange={(e) => setPictures(e.target.checked)}
                  />
                  Pictures <span style={s.muted}>(drawings, stage, scripts, costumes)</span>
                </label>
                <label style={s.option}>
                  <input
                    type="checkbox"
                    checked={includeName}
                    onChange={(e) => setIncludeName(e.target.checked)}
                  />
                  Include first name in file names
                </label>
                <label style={{ ...s.option, ...(canShare ? null : s.disabled) }}>
                  <input
                    type="checkbox"
                    checked={makeShare && canShare}
                    disabled={!canShare}
                    onChange={(e) => setMakeShare(e.target.checked)}
                  />
                  Make a share link{' '}
                  <span style={s.muted}>
                    (this task only, no name, read-only, lasts {SHARE_TTL_DAYS} days)
                  </span>
                </label>
              </fieldset>
            </>
          )}
          {busy && (
            <p style={s.hint} role="status">
              {busy}
            </p>
          )}
          {result && (
            <div style={s.result} role="status">
              {result.download ? (
                <p style={s.ok}>
                  ✓ Downloaded {result.download}
                  {result.count > 1 ? ` (${result.count} files)` : ''}
                </p>
              ) : (
                (code || pictures) && <p style={s.hint}>No files were made.</p>
              )}
              {result.share?.url && (
                <div style={s.shareRow}>
                  <input
                    style={s.shareInput}
                    readOnly
                    value={revoked ? 'Revoked' : result.share.url}
                    aria-label="Share link"
                    onFocus={(e) => e.target.select()}
                  />
                  {!revoked && (
                    <>
                      <button className="btn-ghost-outline" style={s.small} onClick={handleCopy}>
                        {copied ? '✓ Copied' : 'Copy'}
                      </button>
                      <button className="btn-ghost-outline" style={s.small} onClick={handleRevoke}>
                        Revoke
                      </button>
                    </>
                  )}
                </div>
              )}
              {result.share?.error && <p style={s.error}>{result.share.error}</p>}
              {result.notes.length > 0 && (
                <ul style={s.notes}>
                  {result.notes.map((note, index) => (
                    <li key={index}>{note}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <div style={s.footer}>
          <button className="btn-ghost-outline" style={s.small} onClick={onClose} disabled={!!busy}>
            Close
          </button>
          <button
            className="btn-primary"
            style={s.small}
            onClick={handleExport}
            disabled={!!busy || !chosen.length || nothingChosen}
          >
            {busy ? 'Exporting…' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  )
}

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 1200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modal: {
    background: 'var(--ui-surface)',
    borderRadius: 10,
    width: 'min(520px, 100%)',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  header: {
    background: 'var(--colour-primary)',
    color: '#fff',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
    borderRadius: '10px 10px 0 0',
  },
  title: { fontFamily: 'var(--font-title)', fontWeight: 700, fontSize: '1rem' },
  closeBtn: {
    background: 'rgba(255,255,255,0.15)',
    border: '1px solid rgba(255,255,255,0.3)',
    color: '#fff',
    borderRadius: 5,
    width: 28,
    height: 28,
    fontSize: '0.85rem',
    cursor: 'pointer',
    padding: 0,
  },
  body: {
    padding: '14px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    overflowY: 'auto',
    fontFamily: 'var(--font-body)',
    fontSize: '0.88rem',
    color: 'var(--colour-text)',
  },
  hint: { margin: 0 },
  muted: { color: 'var(--colour-text-muted, #6b7280)' },
  error: { margin: 0, color: '#b91c1c' },
  ok: { margin: 0, color: '#15803d', fontWeight: 600 },
  fieldset: {
    border: '1px solid var(--ui-border)',
    borderRadius: 8,
    padding: '8px 12px',
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  legend: { fontWeight: 700, padding: '0 4px' },
  option: { display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
  disabled: { opacity: 0.55 },
  result: { display: 'flex', flexDirection: 'column', gap: 8 },
  shareRow: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  shareInput: { flex: '1 1 220px', minWidth: 0, fontSize: '0.82rem', padding: '6px 8px' },
  notes: { margin: 0, paddingLeft: 18, color: 'var(--colour-text-muted, #6b7280)' },
  footer: {
    padding: '12px 16px',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    borderTop: '1px solid var(--ui-border)',
    flexShrink: 0,
  },
  small: { fontSize: 13 },
}
