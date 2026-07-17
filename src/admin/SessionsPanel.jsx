import React, { useEffect, useMemo, useState } from 'react'
import { ref, onValue, remove } from 'firebase/database'
import { collection, onSnapshot } from 'firebase/firestore'
import { db, firestore } from '../shared/firebase'
import { formatClock } from '../app/components/TeacherTimers'
import {
  AdminBadge,
  AdminCell,
  AdminLessonIdPill,
  AdminMessage,
  AdminSection,
  AdminTable,
  adminUiStyles,
} from './AdminUi'

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
    <AdminSection
      title="Open Sessions"
      subtitle="Live and waiting sessions left open by teachers"
    >
      {loading && <AdminMessage>Loading sessions…</AdminMessage>}
      {error && <AdminMessage tone="error">Could not load sessions: {error}</AdminMessage>}
      {closeError && <AdminMessage tone="error">{closeError}</AdminMessage>}

      {!loading && !error && openSessions.length === 0 && (
        <AdminMessage>No sessions are currently open.</AdminMessage>
      )}

      {openSessions.length > 0 && (
        <AdminTable headers={['Lesson', 'State', 'Students', 'Open for', 'Actions']}>
          {openSessions.map(session => (
            <tr key={session.lessonId}>
              <AdminCell>
                <div style={adminUiStyles.lessonCell}>
                  <a href={makeTeacherUrl(session.lessonId)} target="_blank" rel="noreferrer" style={adminUiStyles.linkText}>
                    {titlesById[session.lessonId] || session.lessonId}
                  </a>
                  <AdminLessonIdPill>{session.lessonId}</AdminLessonIdPill>
                </div>
              </AdminCell>
              <AdminCell>
                <AdminBadge style={STATE_BADGE[session.state]}>
                  {STATE_LABELS[session.state] || session.state}
                </AdminBadge>
                {session.isPaused && <AdminBadge style={s.pausedChip}>Paused</AdminBadge>}
              </AdminCell>
              <AdminCell>
                {session.onlineCount} online · {session.studentCount} joined
              </AdminCell>
              <AdminCell>
                {session.createdAt ? formatClock(Math.floor((now - session.createdAt) / 1000)) : '—'}
              </AdminCell>
              <AdminCell>
                <button
                  className="btn-danger"
                  style={adminUiStyles.actionBtn}
                  disabled={closingId === session.lessonId}
                  onClick={() => handleClose(session.lessonId)}
                >
                  {closingId === session.lessonId ? '…' : 'Close Session'}
                </button>
              </AdminCell>
            </tr>
          ))}
        </AdminTable>
      )}
    </AdminSection>
  )
}

const s = {
  pausedChip: { marginLeft: 6, background: '#fee2e2', color: '#b91c1c' },
}
