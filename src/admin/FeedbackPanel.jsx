import React, { useEffect, useState } from 'react'
import {
  collection,
  collectionGroup,
  doc,
  limit,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore'
import { firestore } from '../shared/firebase'
import { useAdminSnapshot, useLoadMore } from './adminSnapshots'

// Platform feedback is read a page at a time, newest first, with Load more.
export const PLATFORM_FEEDBACK_PAGE_SIZE = 30
const EMPTY = Object.freeze([])

const mapPlatform = (snap) => ({
  // Archived items are hidden here, but count toward the page, so Load more uses the raw size.
  size: snap.docs.length,
  items: snap.docs.filter((d) => !d.data().archived).map((d) => ({ id: d.id, ...d.data() })),
})

const mapLessonFeedback = (snap) =>
  snap.docs
    .filter((d) => !d.data().archived)
    .map((d) => ({ id: d.id, lessonId: d.ref.parent.parent?.id ?? null, ...d.data() }))
    .sort((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0))

function builderUrl(lessonId) {
  return `${window.location.origin}${window.location.pathname}#/builder?load=${lessonId}`
}

function PlatformCard({ item, onDelete }) {
  return (
    <div style={s.card}>
      <div style={s.cardTop}>
        <span style={s.email}>{item.teacherEmail}</span>
        <span style={s.date}>{new Date(item.submittedAt).toLocaleString()}</span>
        <button style={s.deleteBtn} title="Archive feedback" onClick={() => onDelete(item.id)}>
          ×
        </button>
      </div>
      {(item.lessonTitle || item.taskTitle) && (
        <div style={s.context}>
          {item.lessonTitle}
          {item.taskTitle ? ` — ${item.taskTitle}` : ''}
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
        <button style={s.deleteBtn} title="Archive feedback" onClick={() => onDelete(item)}>
          ×
        </button>
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

const VALID_SUBTABS = ['platform', 'lesson', 'task']

export default function FeedbackPanel({ subtab, onSubtabChange }) {
  const subTab = VALID_SUBTABS.includes(subtab) ? subtab : 'platform'
  const setSubTab = onSubtabChange
  const [actionError, setActionError] = useState(null)
  // Shared listeners (adminSnapshots.js): switching Admin tabs and back reads nothing new.
  const [platformCount, setPlatformCount] = useState(PLATFORM_FEEDBACK_PAGE_SIZE)
  const platformSource = useAdminSnapshot(
    `platformFeedback:${platformCount}`,
    () =>
      query(
        collection(firestore, 'platformFeedback'),
        orderBy('submittedAt', 'desc'),
        limit(platformCount)
      ),
    mapPlatform,
    { family: 'platformFeedback' }
  )
  // While a bigger page loads, keep showing the smaller one.
  const [platformPage, setPlatformPage] = useState(null)
  useEffect(() => {
    if (platformSource.data) setPlatformPage(platformSource.data)
  }, [platformSource.data])
  // Lesson feedback stays one unlimited listener: ordering or filtering a collection-group query
  // needs a Firestore index that is not deployed. The docs are short text.
  const lessonSource = useAdminSnapshot(
    'feedbackAll',
    () => collectionGroup(firestore, 'feedback'),
    mapLessonFeedback
  )
  const platform = platformPage?.items ?? EMPTY
  const platformMore = useLoadMore({
    source: platformSource,
    size: platformSource.data?.size ?? 0,
    count: platformCount,
    pageSize: PLATFORM_FEEDBACK_PAGE_SIZE,
  })
  const platformHasMore = platformMore.hasMore
  const allLesson = lessonSource.data ?? EMPTY
  const loadingPlatform = platformSource.loading && !platformPage
  const loadingLesson = lessonSource.loading
  const platformError = platformSource.error
    ? `Could not load platform feedback: ${platformSource.error}`
    : null
  const lessonError = lessonSource.error
    ? `Could not load lesson feedback: ${lessonSource.error}`
    : null

  async function archive(ref) {
    setActionError(null)
    try {
      await updateDoc(ref, { archived: true })
    } catch (err) {
      setActionError(`Could not archive the feedback: ${err.message}`)
    }
  }

  function handleDeletePlatform(id) {
    if (!window.confirm('Archive this feedback? It will be hidden from this list but not deleted.'))
      return
    return archive(doc(firestore, 'platformFeedback', id))
  }

  function handleDeleteLesson(item) {
    if (!item.lessonId) return
    if (!window.confirm('Archive this feedback? It will be hidden from this list but not deleted.'))
      return
    return archive(doc(firestore, 'lessons', item.lessonId, 'feedback', item.id))
  }

  const lessonItems = allLesson.filter((item) => !item.taskId)
  const taskItems = allLesson.filter((item) => !!item.taskId)

  const loading = subTab === 'platform' ? loadingPlatform : loadingLesson
  const items = subTab === 'platform' ? platform : subTab === 'lesson' ? lessonItems : taskItems

  return (
    <div style={s.wrap}>
      <h2 style={s.heading}>Feedback</h2>

      <div className="ui-tabs" role="tablist" aria-label="Feedback source">
        <button
          className={`ui-tab${subTab === 'platform' ? ' is-active' : ''}`}
          role="tab"
          aria-selected={subTab === 'platform'}
          onClick={() => setSubTab('platform')}
        >
          Platform
        </button>
        <button
          className={`ui-tab${subTab === 'lesson' ? ' is-active' : ''}`}
          role="tab"
          aria-selected={subTab === 'lesson'}
          onClick={() => setSubTab('lesson')}
        >
          Lesson
        </button>
        <button
          className={`ui-tab${subTab === 'task' ? ' is-active' : ''}`}
          role="tab"
          aria-selected={subTab === 'task'}
          onClick={() => setSubTab('task')}
        >
          Task
        </button>
      </div>

      {platformError && <p style={s.error}>{platformError}</p>}
      {lessonError && <p style={s.error}>{lessonError}</p>}
      {actionError && <p style={s.error}>{actionError}</p>}

      {loading ? (
        <p style={s.empty}>Loading…</p>
      ) : items.length === 0 && !(subTab === 'platform' && platformHasMore) ? (
        <p style={s.empty}>No {subTab} feedback yet.</p>
      ) : (
        <div style={s.list}>
          {subTab === 'platform'
            ? items.map((item) => (
                <PlatformCard key={item.id} item={item} onDelete={handleDeletePlatform} />
              ))
            : items.map((item) => (
                <LessonCard key={item.id} item={item} onDelete={handleDeleteLesson} />
              ))}
          {subTab === 'platform' && platformHasMore && (
            <button
              type="button"
              className="btn-ghost-outline"
              style={s.loadMore}
              disabled={platformSource.loading}
              onClick={
                platformMore.failed
                  ? platformSource.retry
                  : () => setPlatformCount((count) => count + PLATFORM_FEEDBACK_PAGE_SIZE)
              }
              aria-label={
                platformMore.failed ? 'Retry loading more feedback' : 'Load more feedback'
              }
            >
              {platformSource.loading ? 'Loading…' : platformMore.failed ? 'Retry' : 'Load more'}
            </button>
          )}
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
  error: {
    fontFamily: 'var(--font-body)',
    color: '#dc2626',
    fontSize: '0.9rem',
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
  loadMore: {
    alignSelf: 'flex-start',
    padding: '6px 14px',
    fontSize: '0.85rem',
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
    color: '#dc2626',
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
    fontFamily: 'var(--font-code)',
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
