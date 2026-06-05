import React, { useEffect, useMemo, useRef, useState } from 'react'
import { collection, onSnapshot, deleteDoc, doc } from 'firebase/firestore'
import { firestore } from '../shared/firebase'
import { getLessonLinks } from '../shared/lessonLinks'

function makeBuilderUrl(lessonId) {
  return `${window.location.origin}${window.location.pathname}#/builder?load=${lessonId}`
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


const TYPE_LABELS = { python: 'Python', scratch: 'Scratch', html: 'HTML', filesystem: 'Filesystem' }

export default function LessonPanel() {
  const [lessons, setLessons] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [shareOpenId, setShareOpenId] = useState(null)
  const [copiedLink, setCopiedLink] = useState(null) // { id, type }
  const [deletingId, setDeletingId] = useState(null)
  const [deletedIds, setDeletedIds] = useState(new Set())
  const copyTimerRef = useRef(null)

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
      setDeletedIds(prev => { const next = new Set(prev); next.add(lesson.id); return next })
    } catch (err) {
      alert('Failed to delete: ' + err.message)
    } finally {
      setDeletingId(null)
    }
  }

  function handleEditInBuilder(lesson) {
    window.open(makeBuilderUrl(lesson.id), '_blank', 'noopener,noreferrer')
  }

  function handleToggleShare(lessonId) {
    setShareOpenId(prev => (prev === lessonId ? null : lessonId))
  }

  function handleCopyLink(lessonId, type) {
    const url = getLessonLinks(lessonId)[type]
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink({ id: lessonId, type })
      clearTimeout(copyTimerRef.current)
      copyTimerRef.current = setTimeout(() => setCopiedLink(null), 2000)
    }).catch(() => {})
  }

  const groups = useMemo(
    () => groupByTypeAndLevel(lessons.filter(l => !deletedIds.has(l.id))),
    [lessons, deletedIds],
  )

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
                  <td style={{ ...s.td, fontFamily: 'monospace', fontSize: '0.8rem', color: '#9ca3af' }}>{lesson.id}</td>
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
                      <div className="teacher-share" style={{ position: 'relative' }}>
                        <button
                          className="btn-ghost-outline"
                          style={s.actionBtn}
                          onClick={() => handleToggleShare(lesson.id)}
                          aria-expanded={shareOpenId === lesson.id}
                        >
                          Share Links
                        </button>
                        {shareOpenId === lesson.id && (
                          <>
                            <div className="teacher-share__overlay" onClick={() => setShareOpenId(null)} />
                            <div className="teacher-share__panel" style={{ right: 0, left: 'auto', minWidth: 320 }}>
                              <span className="teacher-share__title">Share lesson links</span>
                              {(['live', 'solo']).map(type => (
                                <div key={type} className="teacher-share__row">
                                  <div className="teacher-share__info">
                                    <span className="teacher-share__type">
                                      {type === 'live' ? 'Live (with teacher)' : 'Solo (practice)'}
                                    </span>
                                    <span className="teacher-share__url">{getLessonLinks(lesson.id)[type]}</span>
                                  </div>
                                  <button
                                    className="btn-secondary teacher-share__copy-btn"
                                    onClick={() => handleCopyLink(lesson.id, type)}
                                  >
                                    {copiedLink?.id === lesson.id && copiedLink?.type === type ? 'Copied!' : 'Copy'}
                                  </button>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
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
                        disabled={deletingId === lesson.id || deletedIds.has(lesson.id)}
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
  levelBadge: { display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: '0.78rem', fontWeight: 600, background: '#ede9fe', color: '#7c3aed' },
  dash:       { color: '#d1d5db' },
  actions:    { display: 'flex', gap: 6, alignItems: 'center' },
  actionBtn:  { padding: '4px 10px', fontSize: '0.82rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' },
  error:      { fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#dc2626', margin: 0 },
  muted:      { fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#9ca3af', margin: 0 },
}
