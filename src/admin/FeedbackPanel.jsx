import React, { useEffect, useState } from 'react'
import { collection, collectionGroup, deleteDoc, doc, onSnapshot, orderBy, query } from 'firebase/firestore'
import { firestore } from '../shared/firebase'

function builderUrl(lessonId) {
  return `${window.location.origin}${window.location.pathname}#/builder?load=${lessonId}`
}

function PlatformCard({ item, onDelete }) {
  return (
    <div style={s.card}>
      <div style={s.cardTop}>
        <span style={s.email}>{item.teacherEmail}</span>
        <span style={s.date}>{new Date(item.submittedAt).toLocaleString()}</span>
        <button style={s.deleteBtn} title="Delete feedback" onClick={() => onDelete(item.id)}>×</button>
      </div>
      {(item.lessonTitle || item.taskTitle) && (
        <div style={s.context}>
          {item.lessonTitle}{item.taskTitle ? ` — ${item.taskTitle}` : ''}
        </div>
      )}
      <p style={s.text}>{item.text}</p>
    </div>
  )
}

function LessonCard({ item, onDelete }) {
  return (
    <div style={s.card}>
      <div style={s.cardTop}>
        <span style={s.email}>{item.teacherEmail}</span>
        <span style={s.date}>{new Date(item.submittedAt).toLocaleString()}</span>
        <button style={s.deleteBtn} title="Delete feedback" onClick={() => onDelete(item)}>×</button>
      </div>
      <div style={s.lessonRow}>
        {item.lessonTitle ? (
          <a href={builderUrl(item.lessonId)} target="_blank" rel="noreferrer" style={s.lessonLink}>
            {item.lessonTitle}
          </a>
        ) : (
          <span style={s.lessonId}>{item.lessonId}</span>
        )}
        <span style={s.lessonIdPill}>{item.lessonId}</span>
        {item.taskTitle && <span style={s.taskChip}>{item.taskTitle}</span>}
      </div>
      <p style={s.text}>{item.text}</p>
    </div>
  )
}

export default function FeedbackPanel() {
  const [subTab, setSubTab] = useState('platform')
  const [platform, setPlatform] = useState([])
  const [allLesson, setAllLesson] = useState([])
  const [loadingPlatform, setLoadingPlatform] = useState(true)
  const [loadingLesson, setLoadingLesson] = useState(true)

  useEffect(() => {
    const q = query(collection(firestore, 'platformFeedback'), orderBy('submittedAt', 'desc'))
    return onSnapshot(q, snap => {
      setPlatform(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoadingPlatform(false)
    }, () => setLoadingPlatform(false))
  }, [])

  useEffect(() => {
    const q = collectionGroup(firestore, 'feedback')
    return onSnapshot(q, snap => {
      const items = snap.docs.map(d => ({
        id: d.id,
        lessonId: d.ref.parent.parent?.id ?? null,
        ...d.data(),
      }))
      items.sort((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0))
      setAllLesson(items)
      setLoadingLesson(false)
    }, () => setLoadingLesson(false))
  }, [])

  function handleDeletePlatform(id) {
    deleteDoc(doc(firestore, 'platformFeedback', id))
  }

  function handleDeleteLesson(item) {
    if (!item.lessonId) return
    deleteDoc(doc(firestore, 'lessons', item.lessonId, 'feedback', item.id))
  }

  const lessonItems = allLesson.filter(item => !item.taskId)
  const taskItems   = allLesson.filter(item => !!item.taskId)

  const loading = subTab === 'platform' ? loadingPlatform : loadingLesson
  const items = subTab === 'platform' ? platform : subTab === 'lesson' ? lessonItems : taskItems

  return (
    <div style={s.wrap}>
      <h2 style={s.heading}>Feedback</h2>

      <div className="ui-tabs">
        <button className={`ui-tab${subTab === 'platform' ? ' is-active' : ''}`} onClick={() => setSubTab('platform')}>Platform</button>
        <button className={`ui-tab${subTab === 'lesson' ? ' is-active' : ''}`} onClick={() => setSubTab('lesson')}>Lesson</button>
        <button className={`ui-tab${subTab === 'task' ? ' is-active' : ''}`} onClick={() => setSubTab('task')}>Task</button>
      </div>

      {loading ? (
        <p style={s.empty}>Loading…</p>
      ) : items.length === 0 ? (
        <p style={s.empty}>No {subTab} feedback yet.</p>
      ) : (
        <div style={s.list}>
          {subTab === 'platform'
            ? items.map(item => <PlatformCard key={item.id} item={item} onDelete={handleDeletePlatform} />)
            : items.map(item => <LessonCard key={item.id} item={item} onDelete={handleDeleteLesson} />)
          }
        </div>
      )}
    </div>
  )
}

const s = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  heading: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1.1rem',
    color: 'var(--colour-text)',
    margin: 0,
  },
  empty: {
    fontFamily: 'var(--font-body)',
    color: '#6b7280',
    fontSize: '0.95rem',
    margin: 0,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  cardTop: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
  },
  email: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.85rem',
    color: 'var(--colour-primary)',
  },
  date: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    color: '#9ca3af',
  },
  deleteBtn: {
    marginLeft: 'auto',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#9ca3af',
    fontSize: '1.2rem',
    lineHeight: 1,
    padding: '0 2px',
    borderRadius: 4,
  },
  lessonRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  lessonLink: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.88rem',
    color: 'var(--colour-primary)',
    textDecoration: 'none',
  },
  lessonId: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.88rem',
    color: 'var(--colour-text)',
  },
  lessonIdPill: {
    fontFamily: 'var(--font-mono, monospace)',
    fontSize: '0.75rem',
    color: '#6b7280',
    background: '#f3f4f6',
    borderRadius: 4,
    padding: '1px 6px',
  },
  taskChip: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.78rem',
    color: '#4b5563',
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: 4,
    padding: '1px 7px',
  },
  context: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    color: '#6b7280',
    fontStyle: 'italic',
  },
  text: {
    margin: 0,
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
    color: 'var(--colour-text)',
    lineHeight: 1.55,
    whiteSpace: 'pre-wrap',
  },
}
