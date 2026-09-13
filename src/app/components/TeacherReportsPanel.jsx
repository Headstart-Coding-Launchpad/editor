import React, { useEffect, useRef, useState } from 'react'
import { fetchSessionReports } from '../../shared/lessonService'
import TeacherReportModal from './TeacherReportModal'

export default function TeacherReportsPanel({ lessonId, liveReport, onClose }) {
  const overlayRef = useRef(null)
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedReport, setSelectedReport] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchSessionReports(lessonId)
      .then((items) => {
        if (!cancelled) {
          setReports(items)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message)
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [lessonId])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (selectedReport) {
    return <TeacherReportModal report={selectedReport} onClose={() => setSelectedReport(null)} />
  }

  return (
    <div
      ref={overlayRef}
      style={s.overlay}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose?.()
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Past session reports"
    >
      <div style={s.modal}>
        <div style={s.header}>
          <span style={s.title}>Session Reports</span>
          <button className="btn-ghost" style={s.closeBtn} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div style={s.body}>
          {loading && <p style={s.muted}>Loading reports…</p>}
          {error && <p style={s.error}>Could not load reports: {error}</p>}
          {!loading && !error && reports.length === 0 && !liveReport && (
            <p style={s.muted}>
              No past session reports yet — a report is saved each time a session ends.
            </p>
          )}
          {(reports.length > 0 || liveReport) && (
            <table style={s.table}>
              <thead>
                <tr>
                  {['Started', 'Ended', 'Students', ''].map((h) => (
                    <th key={h} style={s.th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {liveReport && (
                  <tr>
                    <td style={s.td}>
                      {liveReport.startedAt ? new Date(liveReport.startedAt).toLocaleString() : '—'}
                    </td>
                    <td style={s.td}>
                      <span style={s.liveBadge}>In progress</span>
                    </td>
                    <td style={s.td}>{liveReport.students?.length ?? 0}</td>
                    <td style={s.td}>
                      <button
                        className="btn-ghost-outline"
                        style={s.viewBtn}
                        onClick={() => setSelectedReport(liveReport)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                )}
                {reports.map((r) => (
                  <tr key={r.id}>
                    <td style={s.td}>
                      {r.startedAt ? new Date(r.startedAt).toLocaleString() : '—'}
                    </td>
                    <td style={s.td}>{r.endedAt ? new Date(r.endedAt).toLocaleString() : '—'}</td>
                    <td style={s.td}>{r.students?.length ?? 0}</td>
                    <td style={s.td}>
                      <button
                        className="btn-ghost-outline"
                        style={s.viewBtn}
                        onClick={() => setSelectedReport(r)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1100,
    padding: 24,
  },
  modal: {
    background: '#fff',
    borderRadius: 12,
    width: 'min(700px, 92vw)',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  header: {
    background: 'var(--colour-primary)',
    color: '#fff',
    padding: '12px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
  },
  title: { fontFamily: 'var(--font-title)', fontWeight: 700, fontSize: '1.05rem' },
  closeBtn: { fontSize: 13, padding: '5px 10px', color: 'rgba(255,255,255,0.8)' },
  body: { padding: 20, overflowY: 'auto' },
  muted: { fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#9ca3af', margin: 0 },
  error: { fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#dc2626', margin: 0 },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontFamily: 'var(--font-body)',
    fontSize: '0.88rem',
  },
  th: {
    textAlign: 'left',
    padding: '8px 10px',
    borderBottom: '2px solid #e5e7eb',
    fontWeight: 600,
    fontSize: '0.75rem',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  td: { padding: '8px 10px', borderBottom: '1px solid #f3f4f6', verticalAlign: 'middle' },
  viewBtn: { padding: '4px 12px', fontSize: '0.8rem' },
  liveBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 12,
    fontSize: '0.75rem',
    fontWeight: 600,
    background: '#dbeafe',
    color: '#1d4ed8',
  },
}
