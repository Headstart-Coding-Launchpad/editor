import React, { useEffect, useMemo, useState } from 'react'
import { collectionGroup, onSnapshot, orderBy, query } from 'firebase/firestore'
import { firestore } from '../shared/firebase'
import TeacherReportModal from '../app/components/TeacherReportModal'

export default function ReportsPanel() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filterText, setFilterText] = useState('')
  const [selectedReport, setSelectedReport] = useState(null)

  useEffect(() => {
    const q = query(collectionGroup(firestore, 'sessionReports'), orderBy('startedAt', 'desc'))
    return onSnapshot(
      q,
      snap => {
        setReports(snap.docs.map(d => ({ id: d.id, lessonId: d.ref.parent.parent?.id ?? null, ...d.data() })))
        setLoading(false)
        setError(null)
      },
      err => { setError(err.message); setLoading(false) },
    )
  }, [])

  const filtered = useMemo(() => {
    const needle = filterText.trim().toLowerCase()
    if (!needle) return reports
    return reports.filter(r =>
      (r.lessonTitle || '').toLowerCase().includes(needle) ||
      (r.lessonId || '').toLowerCase().includes(needle)
    )
  }, [reports, filterText])

  return (
    <div style={s.wrap}>
      <div style={s.titleRow}>
        <h2 style={s.heading}>Session Reports</h2>
        <span style={s.subtitle}>Every ended session across all lessons</span>
      </div>

      <input
        style={s.filterInput}
        placeholder="Filter by lesson title or ID…"
        value={filterText}
        onChange={e => setFilterText(e.target.value)}
      />

      {loading && <p style={s.muted}>Loading reports…</p>}
      {error && <p style={s.error}>Could not load reports: {error}</p>}
      {!loading && !error && filtered.length === 0 && (
        <p style={s.muted}>
          {reports.length === 0
            ? 'No session reports yet — a report is saved each time a teacher ends a session.'
            : 'No reports match that filter.'}
        </p>
      )}

      {filtered.length > 0 && (
        <table style={s.table}>
          <thead>
            <tr>
              {['Lesson', 'Started', 'Ended', 'Students', ''].map(h => <th key={h} style={s.th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={`${r.lessonId}-${r.id}`}>
                <td style={s.td}>
                  <div style={s.lessonCell}>
                    <span style={s.lessonTitleText}>{r.lessonTitle || r.lessonId}</span>
                    <span style={s.lessonIdPill}>{r.lessonId}</span>
                  </div>
                </td>
                <td style={s.td}>{r.startedAt ? new Date(r.startedAt).toLocaleString() : '—'}</td>
                <td style={s.td}>{r.endedAt ? new Date(r.endedAt).toLocaleString() : '—'}</td>
                <td style={s.td}>{r.students?.length ?? 0}</td>
                <td style={s.td}>
                  <button className="btn-ghost-outline" style={s.viewBtn} onClick={() => setSelectedReport(r)}>View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selectedReport && (
        <TeacherReportModal report={selectedReport} onClose={() => setSelectedReport(null)} />
      )}
    </div>
  )
}

const s = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 16 },
  titleRow: { display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' },
  heading: { fontFamily: 'var(--font-title)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--colour-text)', margin: 0 },
  subtitle: { fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#6b7280' },
  filterInput: {
    fontFamily: 'var(--font-body)', fontSize: '0.88rem', padding: '7px 12px',
    border: '1px solid #e5e7eb', borderRadius: 6, maxWidth: 320,
  },
  muted: { fontFamily: 'var(--font-body)', color: '#9ca3af', fontSize: '0.9rem', margin: 0 },
  error: { fontFamily: 'var(--font-body)', fontSize: '0.9rem', color: '#dc2626', margin: 0 },
  table: { width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-body)', fontSize: '0.9rem' },
  th: {
    textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e5e7eb', fontWeight: 600,
    fontSize: '0.82rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  td: { padding: '10px 12px', borderBottom: '1px solid #f3f4f6', verticalAlign: 'middle' },
  lessonCell: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  lessonTitleText: { fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.9rem', color: 'var(--colour-text)' },
  lessonIdPill: {
    fontFamily: 'var(--font-mono, monospace)', fontSize: '0.75rem', color: '#6b7280',
    background: '#f3f4f6', borderRadius: 4, padding: '1px 6px',
  },
  viewBtn: { padding: '4px 12px', fontSize: '0.8rem' },
}
