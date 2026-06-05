import React, { useEffect, useState } from 'react'
import { collection, onSnapshot, deleteDoc, doc } from 'firebase/firestore'
import { firestore } from '../shared/firebase'

const BUILDER_LS_KEY = 'headstart_builder_current'

function makeBuilderUrl() {
  return `${window.location.origin}${window.location.pathname}builder/`
}

const TYPE_ORDER = ['python', 'scratch', 'html', 'filesystem']

function levelSortKey(level) {
  if (level === null || level === undefined) return Infinity
  if (typeof level === 'number') return level
  const s = String(level)
  if (s.toLowerCase() === 'taster') return -1
  const m = s.match(/[\d.]+/)
  return m ? parseFloat(m[0]) : Infinity
}

function groupByTypeAndLevel(lessons) {
  const byType = {}
  for (const lesson of lessons) {
    const type = lesson.type || 'unknown'
    if (!byType[type]) byType[type] = []
    byType[type].push(lesson)
  }
  for (const type of Object.keys(byType)) {
    byType[type].sort((a, b) => levelSortKey(a.level) - levelSortKey(b.level))
  }
  const sortedTypes = Object.keys(byType).sort((a, b) => {
    const ai = TYPE_ORDER.indexOf(a)
    const bi = TYPE_ORDER.indexOf(b)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })
  return sortedTypes.map(type => ({ type, lessons: byType[type] }))
}

function makeTeacherUrl(lessonId) {
  return `${window.location.origin}${window.location.pathname}#/lesson/${lessonId}?teacher=true`
}

function makeStudentUrl(lessonId) {
  return `${window.location.origin}${window.location.pathname}#/lesson/${lessonId}?live=true`
}

const TYPE_LABELS = { python: 'Python', scratch: 'Scratch', html: 'HTML', filesystem: 'Filesystem' }

export default function LessonPanel() {
  const [lessons, setLessons] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    return onSnapshot(
      collection(firestore, 'lessons'),
      (snap) => {
        setLessons(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        setLoading(false)
        setError(null)
      },
      (err) => { setError(err.message); setLoading(false) },
    )
  }, [])

  async function handleDelete(lesson) {
    if (!confirm(`Delete lesson "${lesson.title || lesson.id}" from Firestore?\n\nThis cannot be undone.`)) return
    setDeletingId(lesson.id)
    try {
      await deleteDoc(doc(firestore, 'lessons', lesson.id))
    } catch (err) {
      alert('Failed to delete: ' + err.message)
    } finally {
      setDeletingId(null)
    }
  }

  function handleEditInBuilder(lesson) {
    const existing = localStorage.getItem(BUILDER_LS_KEY)
    if (existing) {
      try {
        const saved = JSON.parse(existing)
        if (!confirm(`The builder has an unsaved lesson (${saved.title || saved.id || 'Untitled'}). Overwrite it to edit "${lesson.title || lesson.id}"?`)) return
      } catch { /* corrupt data — safe to overwrite */ }
    }
    localStorage.setItem(BUILDER_LS_KEY, JSON.stringify(lesson))
    window.open(makeBuilderUrl(), '_blank', 'noopener,noreferrer')
  }

  function handleCopyStudentLink(lessonId) {
    navigator.clipboard.writeText(makeStudentUrl(lessonId)).then(() => {
      setCopiedId(lessonId)
      setTimeout(() => setCopiedId(prev => (prev === lessonId ? null : prev)), 2000)
    })
  }

  const groups = groupByTypeAndLevel(lessons)

  return (
    <section style={s.section}>
      <h2 style={s.title}>Lessons</h2>

      {loading && <p style={s.muted}>Loading lessons…</p>}
      {error && <p style={s.error}>Could not load lessons: {error}</p>}
      {!loading && !error && groups.length === 0 && (
        <p style={s.muted}>No lessons found. Run the migration script to populate Firestore.</p>
      )}

      {groups.map(({ type, lessons: groupLessons }) => (
        <div key={type} style={s.group}>
          <h3 style={s.groupTitle}>{TYPE_LABELS[type] ?? type}</h3>
          <table style={s.table}>
            <thead>
              <tr>
                {['Title', 'Level', 'ID', 'Actions'].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groupLessons.map(lesson => (
                <tr key={lesson.id}>
                  <td style={s.td}>{lesson.title || lesson.id}</td>
                  <td style={s.td}>
                    {lesson.level != null
                      ? <span style={s.levelBadge}>{lesson.level}</span>
                      : <span style={s.dash}>—</span>}
                  </td>
                  <td style={s.idCell}>{lesson.id}</td>
                  <td style={{ ...s.td, whiteSpace: 'nowrap' }}>
                    <div style={s.actions}>
                      <a
                        href={makeTeacherUrl(lesson.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary"
                        style={s.actionBtn}
                      >
                        Launch as Teacher
                      </a>
                      <button
                        className={copiedId === lesson.id ? 'btn-secondary' : 'btn-ghost-outline'}
                        style={s.actionBtn}
                        onClick={() => handleCopyStudentLink(lesson.id)}
                      >
                        {copiedId === lesson.id ? 'Copied!' : 'Copy Student Link'}
                      </button>
                      <button
                        className="btn-ghost-outline"
                        style={s.actionBtn}
                        onClick={() => handleEditInBuilder(lesson)}
                      >
                        Edit in Builder
                      </button>
                      <button
                        className="btn-danger"
                        style={s.actionBtn}
                        disabled={deletingId === lesson.id}
                        onClick={() => handleDelete(lesson)}
                      >
                        {deletingId === lesson.id ? '…' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  )
}

const s = {
  section:    { display: 'flex', flexDirection: 'column', gap: 24 },
  title:      { fontFamily: 'var(--font-title)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--colour-text)', margin: 0 },
  group:      { display: 'flex', flexDirection: 'column', gap: 0 },
  groupTitle: { fontFamily: 'var(--font-title)', fontWeight: 700, fontSize: '0.95rem', color: 'var(--colour-primary)', margin: '0 0 8px', paddingBottom: 6, borderBottom: '2px solid var(--colour-primary)' },
  table:      { width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-body)', fontSize: '0.9rem' },
  th:         { textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e5e7eb', fontWeight: 600, fontSize: '0.82rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' },
  td:         { padding: '10px 12px', borderBottom: '1px solid #f3f4f6', verticalAlign: 'middle' },
  idCell:     { padding: '10px 12px', borderBottom: '1px solid #f3f4f6', verticalAlign: 'middle', fontFamily: 'monospace', fontSize: '0.8rem', color: '#9ca3af' },
  levelBadge: { display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: '0.78rem', fontWeight: 600, background: '#ede9fe', color: '#7c3aed' },
  dash:       { color: '#d1d5db' },
  actions:    { display: 'flex', gap: 6, alignItems: 'center' },
  actionBtn:  { padding: '4px 10px', fontSize: '0.82rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' },
  error:      { fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#dc2626', margin: 0 },
  muted:      { fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#9ca3af', margin: 0 },
}
