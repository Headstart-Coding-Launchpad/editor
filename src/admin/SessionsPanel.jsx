import React, { useEffect, useMemo, useState } from 'react'
import { ref, onValue, remove } from 'firebase/database'
import { collection, onSnapshot } from 'firebase/firestore'
import { db, firestore } from '../shared/firebase'
import { formatClock } from '../app/components/TeacherTimers'

const STATE_LABELS = { waiting: 'Waiting', active: 'Active', sandbox: 'Sandbox' }
const STATE_BADGE = {
  waiting: { background: '#fef9c3', color: '#854d0e' },
  active:  { background: '#dcfce7', color: '#15803d' },
  sandbox: { background: '#dbeafe', color: '#1d4ed8' },
}

function makeTeacherUrl(lessonId) {
  return `${window.location.origin}${window.location.pathname}#/lesson/${lessonId}?teacher=true`
}

export default function SessionsPanel() {
  const [sessionsById, setSessionsById] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [titlesById, setTitlesById] = useState({})
  const [closingId, setClosingId] = useState(null)
  const [closeError, setCloseError] = useState(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const r = ref(db, 'sessions')
    return onValue(
      r,
      snap => { setSessionsById(snap.exists() ? snap.val() : {}); setLoading(false); setError(null) },
      err => { setError(err.message); setLoading(false) },
    )
  }, [])

  useEffect(() => {
    return onSnapshot(collection(firestore, 'lessons'), snap => {
      setTitlesById(Object.fromEntries(snap.docs.map(d => [d.id, d.data().title])))
    })
  }, [])

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(intervalId)
  }, [])

  const openSessions = useMemo(() => {
    return Object.entries(sessionsById)
      .map(([lessonId, session]) => {
        const students = session.students || {}
        const studentIds = Object.keys(students)
        return {
          lessonId,
          state: session.state,
          isPaused: !!session.isPaused,
          createdAt: session.createdAt ?? null,
          studentCount: studentIds.length,
          onlineCount: studentIds.filter(id => students[id]?.online).length,
        }
      })
      .filter(s => s.state && s.state !== 'ended')
      .sort((a, b) => (a.createdAt ?? Infinity) - (b.createdAt ?? Infinity))
  }, [sessionsById])

  async function handleClose(lessonId) {
    const title = titlesById[lessonId] || lessonId
    if (!confirm(`Close the open session for "${title}"?\n\nAny connected students will be disconnected immediately.`)) return
    setCloseError(null)
    setClosingId(lessonId)
    try {
      await remove(ref(db, `sessions/${lessonId}`))
    } catch (err) {
      setCloseError(`Failed to close "${title}": ${err.message}`)
    } finally {
      setClosingId(null)
    }
  }

  return (
    <section style={s.section}>
      <div style={s.titleRow}>
        <h2 style={s.title}>Open Sessions</h2>
        <span style={s.subtitle}>Live and waiting sessions left open by teachers</span>
      </div>

      {loading && <p style={s.muted}>Loading sessions…</p>}
      {error && <p style={s.error}>Could not load sessions: {error}</p>}
      {closeError && <p style={s.error}>{closeError}</p>}

      {!loading && !error && openSessions.length === 0 && (
        <p style={s.muted}>No sessions are currently open.</p>
      )}

      {openSessions.length > 0 && (
        <table style={s.table}>
          <thead>
            <tr>
              {['Lesson', 'State', 'Students', 'Open for', 'Actions'].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {openSessions.map(session => (
              <tr key={session.lessonId}>
                <td style={s.td}>
                  <div style={s.lessonCell}>
                    <a href={makeTeacherUrl(session.lessonId)} target="_blank" rel="noreferrer" style={s.lessonLink}>
                      {titlesById[session.lessonId] || session.lessonId}
                    </a>
                    <span style={s.lessonIdPill}>{session.lessonId}</span>
                  </div>
                </td>
                <td style={s.td}>
                  <span style={{ ...s.badge, ...(STATE_BADGE[session.state] || {}) }}>
                    {STATE_LABELS[session.state] || session.state}
                  </span>
                  {session.isPaused && <span style={s.pausedChip}>Paused</span>}
                </td>
                <td style={s.td}>
                  {session.onlineCount} online · {session.studentCount} joined
                </td>
                <td style={s.td}>
                  {session.createdAt ? formatClock(Math.floor((now - session.createdAt) / 1000)) : '—'}
                </td>
                <td style={s.td}>
                  <button
                    className="btn-danger"
                    style={s.actionBtn}
                    disabled={closingId === session.lessonId}
                    onClick={() => handleClose(session.lessonId)}
                  >
                    {closingId === session.lessonId ? '…' : 'Close Session'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

const s = {
  section:  { display: 'flex', flexDirection: 'column', gap: 16 },
  titleRow: { display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' },
  title:    { fontFamily: 'var(--font-title)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--colour-text)', margin: 0 },
  subtitle: { fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#6b7280' },
  table:    { width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-body)', fontSize: '0.9rem' },
  th:       { textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e5e7eb', fontWeight: 600, fontSize: '0.82rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' },
  td:       { padding: '10px 12px', borderBottom: '1px solid #f3f4f6', verticalAlign: 'middle' },
  lessonCell: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  lessonLink: { fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.9rem', color: 'var(--colour-primary)', textDecoration: 'none' },
  lessonIdPill: { fontFamily: 'var(--font-mono, monospace)', fontSize: '0.75rem', color: '#6b7280', background: '#f3f4f6', borderRadius: 4, padding: '1px 6px' },
  badge:    { display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: '0.78rem', fontWeight: 600 },
  pausedChip: { display: 'inline-block', marginLeft: 6, padding: '2px 8px', borderRadius: 12, fontSize: '0.78rem', fontWeight: 600, background: '#fee2e2', color: '#b91c1c' },
  actionBtn: { padding: '4px 10px', fontSize: '0.82rem' },
  error:    { fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#dc2626', margin: 0 },
  muted:    { fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#9ca3af', margin: 0 },
}
