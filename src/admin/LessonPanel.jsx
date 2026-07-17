import React, { useEffect, useMemo, useRef, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { firestore } from '../shared/firebase'
import { getLessonLinks } from '../shared/lessonLinks'
import { deletePublishedLesson, publishLesson } from '../shared/lessonService'
import { getLessonModules } from '../modules/registry'
import { validateLesson } from '../builder/lessonUtils'

function makeBuilderUrl(lessonId) {
  return `${window.location.origin}${window.location.pathname}#/builder?load=${lessonId}`
}

const LESSON_MODULES = getLessonModules()
const TYPE_ORDER = LESSON_MODULES.map(module => module.type)
const TYPE_LABELS = Object.fromEntries(LESSON_MODULES.map(module => [module.type, module.label]))

const STAGE_LABELS = { ideas: 'Ideas', details: 'Details', review: 'Review', approved: 'Approved', published: 'Published' }
const STAGE_COLORS = { ideas: '#6b7280', details: '#2563eb', review: '#d97706', approved: '#16a34a', published: '#7c3aed' }
const STAGE_FILTER_OPTIONS = [
  { value: null, label: 'All' },
  { value: 'ideas', label: 'Ideas' },
  { value: 'details', label: 'Details' },
  { value: 'review', label: 'Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'published', label: 'Published' },
]

function levelSortKey(level) {
  if (level === null || level === undefined) return Infinity
  if (typeof level === 'number') return level
  const s = String(level)
  if (s.toLowerCase() === 'taster') return -1
  const m = s.match(/[\d.]+/)
  return m ? parseFloat(m[0]) : Infinity
}

function groupByTypeAndLevel(lessons) {
  const byType = Object.fromEntries(TYPE_ORDER.map(type => [type, []]))
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
      await deletePublishedLesson(lesson.id)
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

  function handleNewLesson() {
    window.open(`${window.location.origin}${window.location.pathname}#/builder`, '_blank', 'noopener,noreferrer')
  }

  const uploadInputRef = useRef(null)

  function handleUploadClick() {
    uploadInputRef.current?.click()
  }

  async function handleUploadFile(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    let parsed
    try {
      const text = await file.text()
      parsed = JSON.parse(text)
      if (!parsed.id || !parsed.tasks || !parsed.type) throw new Error('Missing required fields: id, type, tasks')
    } catch (err) {
      alert('Could not parse file: ' + err.message)
      return
    }
    const validation = validateLesson(parsed)
    if (validation.errors.length > 0) {
      alert('Cannot upload lesson until these validation errors are fixed:\n\n' + validation.errors.join('\n'))
      return
    }
    const lessonId = parsed.id
    const exists = lessons.some(l => l.id === lessonId)
    if (exists && !confirm(`A lesson with ID "${lessonId}" already exists in Firestore.\n\nOverwrite it?`)) return
    try {
      await publishLesson(parsed)
    } catch (err) {
      alert('Failed to upload lesson: ' + err.message)
    }
  }

  const [activeType, setActiveType] = useState(null)
  const [stageFilter, setStageFilter] = useState(null)

  const visibleLessons = useMemo(
    () => lessons.filter(l => !deletedIds.has(l.id)),
    [lessons, deletedIds],
  )
  const groups = useMemo(
    () => groupByTypeAndLevel(visibleLessons),
    [visibleLessons],
  )

  const firstPopulatedGroup = groups.find(g => g.lessons.length > 0)
  const displayType = activeType ?? firstPopulatedGroup?.type ?? groups[0]?.type ?? null
  const activeGroup = groups.find(g => g.type === displayType)
  const showActiveGroup = activeGroup && (visibleLessons.length > 0 || activeType)
  const filteredLessons = useMemo(() => {
    const base = activeGroup?.lessons ?? []
    if (!stageFilter) return base
    return base.filter(l => (l.stage ?? 'published') === stageFilter)
  }, [activeGroup, stageFilter])

  return (
    <section style={s.section}>
      <div style={s.titleRow}>
        <h2 style={s.title}>Lessons</h2>
        <div style={s.headerActions}>
          <button className="btn-primary" style={s.headerBtn} onClick={handleNewLesson}>
            + New Lesson
          </button>
          <button className="btn-ghost-outline" style={s.headerBtn} onClick={handleUploadClick}>
            Upload JSON
          </button>
          <input
            ref={uploadInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleUploadFile}
          />
        </div>
      </div>

      {loading && <p style={s.muted}>Loading lessons…</p>}
      {error && <p style={s.error}>Could not load lessons: {error}</p>}
      {!loading && !error && visibleLessons.length === 0 && (
        <p style={s.muted}>No lessons found. Run the migration script to populate Firestore.</p>
      )}

      {groups.length > 0 && (
        <div className="ui-tabs">
          {groups.map(({ type, lessons: groupLessons }) => (
            <button
              key={type}
              className={`ui-tab${displayType === type ? ' is-active' : ''}`}
              onClick={() => setActiveType(type)}
            >
              {TYPE_LABELS[type] ?? type}
              <span style={s.tabCount}>{groupLessons.length}</span>
            </button>
          ))}
        </div>
      )}

      {showActiveGroup && (
        <div style={s.stageFilterRow}>
          {STAGE_FILTER_OPTIONS.map(opt => (
            <button
              key={String(opt.value)}
              style={{
                ...s.stageFilterBtn,
                ...(stageFilter === opt.value ? {
                  background: opt.value ? STAGE_COLORS[opt.value] : 'var(--colour-primary)',
                  color: '#fff',
                  borderColor: opt.value ? STAGE_COLORS[opt.value] : 'var(--colour-primary)',
                } : {}),
              }}
              onClick={() => setStageFilter(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {showActiveGroup && (
        <div key={activeGroup.type} style={s.group}>
          <table style={s.table}>
            <colgroup>
              <col style={{ width: '26%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '38%' }} />
            </colgroup>
            <thead>
              <tr>
                {['Title', 'Level', 'Stage', 'ID', 'Actions'].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredLessons.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ ...s.td, color: '#9ca3af', textAlign: 'center', padding: '20px 12px' }}>
                    {activeGroup.lessons.length === 0
                      ? 'No lessons found for this lesson type.'
                      : 'No lessons match the selected stage filter.'}
                  </td>
                </tr>
              )}
              {filteredLessons.map(lesson => {
                const stageKey = lesson.stage ?? 'published'
                return (
                <tr key={lesson.id}>
                  <td style={s.td}>{lesson.title || lesson.id}</td>
                  <td style={s.td}>
                    {lesson.level != null
                      ? <span style={s.levelBadge}>{lesson.level}</span>
                      : <span style={s.dash}>—</span>}
                  </td>
                  <td style={s.td}>
                    <span style={{ ...s.stageBadge, background: STAGE_COLORS[stageKey] ?? '#6b7280' }}>
                      {STAGE_LABELS[stageKey] ?? stageKey}
                    </span>
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
              )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

const s = {
  section:      { display: 'flex', flexDirection: 'column', gap: 24 },
  titleRow:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title:        { fontFamily: 'var(--font-title)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--colour-text)', margin: 0 },
  headerActions:{ display: 'flex', gap: 8 },
  headerBtn:    { padding: '6px 14px', fontSize: '0.85rem' },
  group:      { display: 'flex', flexDirection: 'column', gap: 0 },
  tabCount:   { background: '#f0eafa', color: 'var(--colour-primary)', borderRadius: 999, padding: '1px 6px', fontSize: '0.7rem', fontWeight: 700, marginLeft: 4 },
  table:      { width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-body)', fontSize: '0.9rem', tableLayout: 'fixed' },
  th:         { textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e5e7eb', fontWeight: 600, fontSize: '0.82rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' },
  td:         { padding: '10px 12px', borderBottom: '1px solid #f3f4f6', verticalAlign: 'middle' },
  levelBadge: { display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: '0.78rem', fontWeight: 600, background: '#ede9fe', color: '#7c3aed' },
  stageBadge: { display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 700, color: '#fff', letterSpacing: '0.02em' },
  dash:       { color: '#d1d5db' },
  actions:    { display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'nowrap' },
  actionBtn:  { padding: '4px 7px', fontSize: '0.78rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap', flexShrink: 0 },
  error:      { fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#dc2626', margin: 0 },
  muted:      { fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#9ca3af', margin: 0 },
  stageFilterRow: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' },
  stageFilterBtn: {
    padding: '4px 12px',
    borderRadius: 20,
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#6b7280',
    fontFamily: 'var(--font-body)',
    fontSize: '0.78rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.1s',
  },
}
