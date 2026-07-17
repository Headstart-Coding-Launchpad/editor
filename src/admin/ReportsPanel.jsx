import React, { useEffect, useMemo, useState } from 'react'
import { collectionGroup, onSnapshot, orderBy, query } from 'firebase/firestore'
import { firestore } from '../shared/firebase'
import TeacherReportModal from '../app/components/TeacherReportModal'
import {
  AdminCell,
  AdminLessonIdPill,
  AdminMessage,
  AdminSection,
  AdminTable,
  adminUiStyles,
} from './AdminUi'

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
    <AdminSection
      as="div"
      title="Session Reports"
      subtitle="Every ended session across all lessons"
    >
      <input
        style={adminUiStyles.filterInput}
        placeholder="Filter by lesson title or ID…"
        value={filterText}
        onChange={e => setFilterText(e.target.value)}
      />

      {loading && <AdminMessage>Loading reports…</AdminMessage>}
      {error && <AdminMessage tone="error">Could not load reports: {error}</AdminMessage>}
      {!loading && !error && filtered.length === 0 && (
        <AdminMessage>
          {reports.length === 0
            ? 'No session reports yet — a report is saved each time a teacher ends a session.'
            : 'No reports match that filter.'}
        </AdminMessage>
      )}

      {filtered.length > 0 && (
        <AdminTable headers={['Lesson', 'Started', 'Ended', 'Students', '']}>
          {filtered.map(r => (
            <tr key={`${r.lessonId}-${r.id}`}>
              <AdminCell>
                <div style={adminUiStyles.lessonCell}>
                  <span style={adminUiStyles.strongText}>{r.lessonTitle || r.lessonId}</span>
                  <AdminLessonIdPill>{r.lessonId}</AdminLessonIdPill>
                </div>
              </AdminCell>
              <AdminCell>{r.startedAt ? new Date(r.startedAt).toLocaleString() : '—'}</AdminCell>
              <AdminCell>{r.endedAt ? new Date(r.endedAt).toLocaleString() : '—'}</AdminCell>
              <AdminCell>{r.students?.length ?? 0}</AdminCell>
              <AdminCell>
                <button
                  className="btn-ghost-outline"
                  style={s.viewBtn}
                  onClick={() => setSelectedReport(r)}
                >
                  View
                </button>
              </AdminCell>
            </tr>
          ))}
        </AdminTable>
      )}

      {selectedReport && (
        <TeacherReportModal report={selectedReport} onClose={() => setSelectedReport(null)} />
      )}
    </AdminSection>
  )
}

const s = {
  viewBtn: { padding: '4px 12px', fontSize: '0.8rem' },
}
