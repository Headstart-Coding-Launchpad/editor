import React, { useState, useEffect } from 'react'
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore'
import { firestore } from '../shared/firebase'

export default function LessonManagement() {
  const [lessons, setLessons] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  function load() {
    setLoading(true)
    setError(null)
    getDocs(collection(firestore, 'lessons'))
      .then(snap => {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        items.sort((a, b) => (a.title ?? a.id).localeCompare(b.title ?? b.id))
        setLessons(items)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  async function handleDelete(lesson) {
    if (!confirm(`Delete lesson "${lesson.title || lesson.id}" from Firestore?\n\nThis cannot be undone.`)) return
    setDeletingId(lesson.id)
    try {
      await deleteDoc(doc(firestore, 'lessons', lesson.id))
      setLessons(prev => prev.filter(l => l.id !== lesson.id))
    } catch (err) {
      alert('Failed to delete: ' + err.message)
    } finally {
      setDeletingId(null)
    }
  }

  const builderBase = window.location.href.replace(/#.*$/, '').replace(/\/[^/]*$/, '/builder/')

  return (
    <section style={s.section}>
      <div style={s.header}>
        <h2 style={s.heading}>Lessons</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" style={s.actionBtn} onClick={load} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <a href={builderBase} target="_blank" rel="noopener noreferrer" style={s.newLessonLink}>
            New lesson (Builder)
          </a>
        </div>
      </div>

      {error && <p style={s.error}>Error loading lessons: {error}</p>}

      {!loading && !error && lessons?.length === 0 && (
        <p style={s.empty}>No lessons in Firestore. Publish a lesson from the Builder to get started.</p>
      )}

      {lessons && lessons.length > 0 && (
        <div style={s.table}>
          <div style={s.tableHead}>
            <span style={{ flex: 2 }}>Title</span>
            <span style={{ flex: 1 }}>ID</span>
            <span style={{ flex: 1 }}>Type</span>
            <span style={{ width: 60, textAlign: 'center' }}>Tasks</span>
            <span style={{ width: 120 }} />
          </div>
          {lessons.map(lesson => {
            const taskCount = lesson.tasks?.length ?? '—'
            return (
              <div key={lesson.id} style={s.tableRow}>
                <span style={{ flex: 2, fontWeight: 600 }}>{lesson.title || '(untitled)'}</span>
                <span style={{ flex: 1, fontFamily: 'var(--font-code)', fontSize: '0.82rem', color: '#6b7280' }}>{lesson.id}</span>
                <span style={{ flex: 1, fontSize: '0.85rem' }}>{lesson.type ?? '—'}</span>
                <span style={{ width: 60, textAlign: 'center', fontSize: '0.85rem' }}>{taskCount}</span>
                <div style={{ width: 120, display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <a
                    href={`${builderBase}?load=${lesson.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={s.editLink}
                  >
                    Edit
                  </a>
                  <button
                    style={s.deleteBtn}
                    onClick={() => handleDelete(lesson)}
                    disabled={deletingId === lesson.id}
                  >
                    {deletingId === lesson.id ? '…' : 'Delete'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

const s = {
  section: {
    background: '#fff',
    borderRadius: 10,
    border: '1px solid #e5e7eb',
    overflow: 'hidden',
    marginBottom: 24,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid #e5e7eb',
    background: '#fafafa',
  },
  heading: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1rem',
    color: 'var(--colour-text)',
    margin: 0,
  },
  actionBtn: {
    color: 'var(--colour-primary)',
    border: '1px solid var(--colour-primary)',
    padding: '5px 12px',
    fontSize: '0.82rem',
  },
  newLessonLink: {
    background: 'var(--colour-primary)',
    color: '#fff',
    padding: '5px 12px',
    fontSize: '0.82rem',
    borderRadius: 6,
    textDecoration: 'none',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
  },
  error: {
    color: '#ef4444',
    padding: '12px 20px',
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
    margin: 0,
  },
  empty: {
    color: '#6b7280',
    padding: '20px',
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
    margin: 0,
  },
  table: {
    display: 'flex',
    flexDirection: 'column',
  },
  tableHead: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 20px',
    background: '#f9fafb',
    borderBottom: '1px solid #e5e7eb',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.78rem',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    gap: 12,
  },
  tableRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 20px',
    borderBottom: '1px solid #f3f4f6',
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
    color: 'var(--colour-text)',
    gap: 12,
  },
  editLink: {
    background: 'none',
    border: '1px solid var(--colour-primary)',
    borderRadius: 5,
    color: 'var(--colour-primary)',
    padding: '4px 10px',
    fontSize: '0.78rem',
    cursor: 'pointer',
    textDecoration: 'none',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
  },
  deleteBtn: {
    background: 'none',
    border: '1px solid #fca5a5',
    borderRadius: 5,
    color: '#ef4444',
    padding: '4px 10px',
    fontSize: '0.78rem',
    cursor: 'pointer',
  },
}
