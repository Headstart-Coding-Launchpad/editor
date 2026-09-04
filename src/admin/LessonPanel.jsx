import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { firestore } from '../shared/firebase'
import { getLessonLinks } from '../shared/lessonLinks'
import { deletePublishedLesson, publishLesson, publishLessonFork, saveClassRecord } from '../shared/lessonService'
import { CLASS_COLLECTION, makeClassRecord, makeForkLessonId, slugifyClassId } from '../shared/lessonForks'
import {
  compareLevels,
  DEFAULT_LEVEL_COLOUR,
  DEFAULT_LEVEL_ICON,
  getLessonLevelRef,
  levelTitleFromLesson,
  LEVEL_COLLECTION,
  makeLevelId,
  migrateLessonLevel,
  normalizeLevelRecord,
} from '../shared/lessonLevels'
import { getLessonModules } from '../modules/registry'
import { validateLesson } from '../builder/lessonUtils'
import TeacherReportModal from '../app/components/TeacherReportModal'
import { AdminCell, AdminTable } from './AdminUi'

function makeBuilderUrl(lessonId) {
  return `${window.location.origin}${window.location.pathname}#/builder?load=${lessonId}`
}

const LESSON_MODULES = getLessonModules()
const TYPE_ORDER = LESSON_MODULES.map(module => module.type)
const TYPE_LABELS = Object.fromEntries(LESSON_MODULES.map(module => [module.type, module.label]))

const UNASSIGNED_LEVEL_ID = '__unassigned__'
const COMMON_LEVEL_EMOJIS = ['⭐', '🌱', '🚀', '💡', '🎯', '🧩', '🏆', '📚', '🛠️', '⚡', '🎨', '🔬']
const LEGACY_ICON_LABELS = { star: '⭐' }
const makeBlankLevelForm = () => ({
  title: '',
  description: '',
  order: '',
  color: DEFAULT_LEVEL_COLOUR,
  icon: DEFAULT_LEVEL_ICON,
})

function groupByTypeAndLevel(lessons, levels) {
  const byType = Object.fromEntries(TYPE_ORDER.map(type => [type, []]))
  for (const lesson of lessons) {
    const type = lesson.type || 'unknown'
    if (!byType[type]) byType[type] = []
    byType[type].push(lesson)
  }
  for (const type of Object.keys(byType)) {
    byType[type].sort((a, b) => {
      const levelA = findLessonLevel(a, levels)
      const levelB = findLessonLevel(b, levels)
      if (levelA || levelB) return compareLevels(levelA ?? {}, levelB ?? {})
      return String(a.id).localeCompare(String(b.id))
    })
  }
  const sortedTypes = Object.keys(byType).sort((a, b) => {
    const ai = TYPE_ORDER.indexOf(a)
    const bi = TYPE_ORDER.indexOf(b)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })
  return sortedTypes.map(type => ({ type, lessons: byType[type] }))
}

function makeLevelBuckets(lessons, levels, activeType) {
  const lessonBuckets = new Map()
  for (const lesson of lessons) {
    const level = findLessonLevel(lesson, levels)
    const fallbackTitle = levelTitleFromLesson(lesson, levels)
    const bucketId = level?.id ?? (fallbackTitle ? `legacy:${fallbackTitle}` : UNASSIGNED_LEVEL_ID)
    if (!lessonBuckets.has(bucketId)) {
      lessonBuckets.set(bucketId, {
        id: bucketId,
        level,
        title: level?.title ?? fallbackTitle ?? 'No level',
        icon: level?.icon ?? '',
        color: level?.color ?? '#9ca3af',
        order: level?.order ?? Number.MAX_SAFE_INTEGER,
        lessons: [],
      })
    }
    lessonBuckets.get(bucketId).lessons.push(lesson)
  }

  for (const level of levels) {
    if (activeType != null && (level.scopeType !== 'type' || level.scopeId !== activeType)) continue
    if (!lessonBuckets.has(level.id)) {
      lessonBuckets.set(level.id, {
        id: level.id,
        level,
        title: level.title,
        icon: level.icon,
        color: level.color,
        order: level.order ?? 0,
        lessons: [],
      })
    }
  }

  return [...lessonBuckets.values()]
    .sort((a, b) => {
      if (a.id === UNASSIGNED_LEVEL_ID) return 1
      if (b.id === UNASSIGNED_LEVEL_ID) return -1
      const order = (a.order ?? 0) - (b.order ?? 0)
      if (order !== 0) return order
      return String(a.title).localeCompare(String(b.title))
    })
    .map(bucket => ({
      ...bucket,
      lessons: bucket.lessons.sort((a, b) => String(a.id).localeCompare(String(b.id))),
    }))
}

function displayLevelIcon(icon) {
  return LEGACY_ICON_LABELS[icon] ?? icon ?? ''
}

function makeTeacherUrl(lessonId) {
  return `${window.location.origin}${window.location.pathname}#/lesson/${lessonId}?teacher=true`
}

// Ephemeral, unrestricted solo run of the lesson (see LessonRoute.jsx's `preview` handling)
// — nothing it does is written to real student progress, so it's safe to launch repeatedly
// while checking a lesson over.
function makePreviewUrl(lessonId) {
  return `${window.location.origin}${window.location.pathname}#/lesson/${lessonId}?preview=true`
}

function findLessonLevel(lesson, levels) {
  const ref = getLessonLevelRef(lesson)
  if (!ref?.id) return null
  return levels.find(level => level.id === ref.id) ?? null
}

function openCount(items) {
  return items.filter(item => !item.archived && !item.resolvedAt).length
}

function isLessonFork(lesson) {
  return Boolean(lesson?.fork?.sourceLessonId)
}

function getForkClassLabel(lesson, classes) {
  if (!isLessonFork(lesson)) return 'Stock'
  const cls = classes.find(item => item.id === lesson.fork.classId)
  return cls?.name ?? lesson.fork.className ?? lesson.fork.classId ?? 'Class fork'
}

function makeLessonFamilyGroups(lessons) {
  const byId = new Map(lessons.map(lesson => [lesson.id, lesson]))
  const forksBySource = new Map()
  const families = []

  for (const lesson of lessons) {
    if (!isLessonFork(lesson)) continue
    const sourceId = lesson.fork.sourceLessonId
    if (!forksBySource.has(sourceId)) forksBySource.set(sourceId, [])
    forksBySource.get(sourceId).push(lesson)
  }

  const stockLessons = lessons
    .filter(lesson => !isLessonFork(lesson))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))

  for (const lesson of stockLessons) {
    const forks = (forksBySource.get(lesson.id) ?? [])
      .sort((a, b) => String(a.fork?.className ?? a.title).localeCompare(String(b.fork?.className ?? b.title)))
    families.push({
      id: lesson.id,
      title: lesson.title ?? lesson.id,
      items: [lesson, ...forks],
    })
    forksBySource.delete(lesson.id)
  }

  for (const [sourceId, forks] of forksBySource) {
    const source = byId.get(sourceId)
    families.push({
      id: sourceId,
      title: source?.title ?? forks[0]?.fork?.sourceLessonTitle ?? sourceId,
      items: forks.sort((a, b) => String(a.fork?.className ?? a.title).localeCompare(String(b.fork?.className ?? b.title))),
    })
  }

  return families
}

export default function LessonPanel({ view = 'lessons' }) {
  const [lessons, setLessons] = useState([])
  const [levels, setLevels] = useState([])
  const [classes, setClasses] = useState([])
  const [reports, setReports] = useState([])
  const [feedback, setFeedback] = useState([])
  const [loading, setLoading] = useState(true)
  const [levelsLoading, setLevelsLoading] = useState(true)
  const [classesLoading, setClassesLoading] = useState(true)
  const [reportsLoading, setReportsLoading] = useState(true)
  const [feedbackLoading, setFeedbackLoading] = useState(true)
  const [error, setError] = useState(null)
  const [shareOpenId, setShareOpenId] = useState(null)
  const [copiedLink, setCopiedLink] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [forkingId, setForkingId] = useState(null)
  const [deletedIds, setDeletedIds] = useState(new Set())
  const [selectedReport, setSelectedReport] = useState(null)
  const [activeType, setActiveType] = useState(null)
  const [openLevelIds, setOpenLevelIds] = useState(() => new Set())
  const copyTimerRef = useRef(null)
  const migratedRef = useRef(new Set())

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

  useEffect(() => {
    return onSnapshot(
      collection(firestore, LEVEL_COLLECTION),
      (snap) => {
        setLevels(snap.docs.map(d => normalizeLevelRecord({ id: d.id, ...d.data() })).sort(compareLevels))
        setLevelsLoading(false)
      },
      () => setLevelsLoading(false),
    )
  }, [])

  useEffect(() => {
    return onSnapshot(
      collection(firestore, CLASS_COLLECTION),
      (snap) => {
        setClasses(snap.docs.map(d => makeClassRecord({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name)))
        setClassesLoading(false)
      },
      () => setClassesLoading(false),
    )
  }, [])

  useEffect(() => {
    const q = query(collectionGroup(firestore, 'sessionReports'), orderBy('startedAt', 'desc'))
    return onSnapshot(
      q,
      snap => {
        setReports(snap.docs.map(d => ({ id: d.id, lessonId: d.ref.parent.parent?.id ?? null, ...d.data() })))
        setReportsLoading(false)
      },
      () => setReportsLoading(false),
    )
  }, [])

  useEffect(() => {
    const q = collectionGroup(firestore, 'feedback')
    return onSnapshot(
      q,
      snap => {
        const items = snap.docs.map(d => ({
          id: d.id,
          lessonId: d.ref.parent.parent?.id ?? null,
          ...d.data(),
        }))
        items.sort((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0))
        setFeedback(items)
        setFeedbackLoading(false)
      },
      () => setFeedbackLoading(false),
    )
  }, [])

  useEffect(() => {
    if (loading || levelsLoading) return
    for (const lesson of lessons) {
      if (migratedRef.current.has(lesson.id)) continue
      const { level, lesson: migrated } = migrateLessonLevel(lesson)
      if (!level) continue
      migratedRef.current.add(lesson.id)
      setDoc(doc(firestore, LEVEL_COLLECTION, level.id), level, { merge: true })
        .then(() => updateDoc(doc(firestore, 'lessons', lesson.id), {
          level: migrated.level,
          levelId: migrated.levelId,
          levelRef: migrated.levelRef,
        }))
        .catch(err => console.warn('Could not migrate lesson level', lesson.id, err))
    }
  }, [lessons, levelsLoading, loading])

  async function handleDelete(lesson) {
    if (!window.confirm(`Delete lesson "${lesson.title || lesson.id}" from Firestore?\n\nThis cannot be undone.`)) return
    setDeletingId(lesson.id)
    try {
      await deletePublishedLesson(lesson.id)
      setDeletedIds(prev => { const next = new Set(prev); next.add(lesson.id); return next })
    } catch (err) {
      window.alert('Failed to delete: ' + err.message)
    } finally {
      setDeletingId(null)
    }
  }

  async function handleForkForClass(lesson, classId) {
    const cls = classes.find(item => item.id === classId)
    if (!cls) {
      window.alert('Choose a class before forking this lesson.')
      return
    }
    const forkId = makeForkLessonId(lesson.id, cls.id)
    const exists = lessons.some(item => item.id === forkId)
    const message = exists
      ? `Overwrite fork "${forkId}" with a fresh copy of "${lesson.title || lesson.id}" for ${cls.name}? Existing fork edits, reports, and feedback will be cleared.`
      : `Create fork "${forkId}" from "${lesson.title || lesson.id}" for ${cls.name}?`
    if (!window.confirm(message)) return

    setForkingId(lesson.id)
    try {
      const { fork } = await publishLessonFork(lesson, cls)
      window.open(makeBuilderUrl(fork.id), '_blank', 'noopener,noreferrer')
    } catch (err) {
      window.alert('Failed to fork lesson: ' + err.message)
    } finally {
      setForkingId(null)
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
      window.alert('Could not parse file: ' + err.message)
      return
    }
    const validation = validateLesson(parsed)
    if (validation.errors.length > 0) {
      window.alert('Cannot upload lesson until these validation errors are fixed:\n\n' + validation.errors.join('\n'))
      return
    }
    const lessonId = parsed.id
    const exists = lessons.some(l => l.id === lessonId)
    if (exists && !window.confirm(`A lesson with ID "${lessonId}" already exists in Firestore.\n\nOverwrite it?`)) return
    try {
      const { lesson, level } = migrateLessonLevel(parsed)
      if (level) await setDoc(doc(firestore, LEVEL_COLLECTION, level.id), level, { merge: true })
      await publishLesson(lesson)
    } catch (err) {
      window.alert('Failed to upload lesson: ' + err.message)
    }
  }

  async function handleResolveFeedback(item) {
    if (!item.lessonId) return
    await updateDoc(doc(firestore, 'lessons', item.lessonId, 'feedback', item.id), {
      archived: true,
      resolvedAt: Date.now(),
    })
  }

  const visibleLessons = useMemo(
    () => lessons.filter(l => !deletedIds.has(l.id)),
    [lessons, deletedIds],
  )
  const groups = useMemo(
    () => groupByTypeAndLevel(visibleLessons, levels),
    [visibleLessons, levels],
  )

  const firstPopulatedGroup = groups.find(g => g.lessons.length > 0)
  const displayType = activeType ?? firstPopulatedGroup?.type ?? groups[0]?.type ?? null
  const activeGroup = groups.find(g => g.type === displayType)
  const showActiveGroup = activeGroup && (visibleLessons.length > 0 || activeType)
  const filteredLessons = visibleLessons
  const levelBuckets = useMemo(
    () => makeLevelBuckets(filteredLessons, levels, null),
    [filteredLessons, levels],
  )

  function handleToggleLevel(levelId) {
    setOpenLevelIds(prev => {
      const next = new Set(prev)
      if (next.has(levelId)) next.delete(levelId)
      else next.add(levelId)
      return next
    })
  }

  if (view === 'levels') {
    return (
      <LevelManager
        levels={levels}
        lessons={visibleLessons}
        activeType={null}
        onTypeChange={() => {}}
        groups={[]}
        loading={levelsLoading}
      />
    )
  }

  if (view === 'classes') {
    return (
      <ClassManager
        classes={classes}
        loading={classesLoading}
      />
    )
  }

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

      {loading && <p style={s.muted}>Loading lessons...</p>}
      {error && <p style={s.error}>Could not load lessons: {error}</p>}
      {!loading && !error && visibleLessons.length === 0 && (
        <p style={s.muted}>No lessons found. Run the migration script to populate Firestore.</p>
      )}

      {false && groups.length > 0 && (
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

      {visibleLessons.length > 0 && (
        <div key="all-lessons" style={s.group}>
          {filteredLessons.length === 0 ? (
            <div style={s.emptyTableState}>
              No lessons match the selected stage filter.
            </div>
          ) : (
            <div style={s.levelAccordion}>
              {levelBuckets.map(bucket => (
                <LevelLessonGroup
                  key={bucket.id}
                  bucket={bucket}
                  open={openLevelIds.has(bucket.id)}
                  onToggle={() => handleToggleLevel(bucket.id)}
                  reports={reports}
                  feedback={feedback}
                  shareOpenId={shareOpenId}
                  copiedLink={copiedLink}
                  deletingId={deletingId}
                  deletedIds={deletedIds}
                  reportsLoading={reportsLoading}
                  feedbackLoading={feedbackLoading}
                  onToggleShare={handleToggleShare}
                  onCloseShare={() => setShareOpenId(null)}
                  onCopyLink={handleCopyLink}
                  onEditInBuilder={handleEditInBuilder}
                  onDelete={handleDelete}
                  onForkForClass={handleForkForClass}
                  onViewReport={setSelectedReport}
                  onResolveFeedback={handleResolveFeedback}
                  classes={classes}
                  classesLoading={classesLoading}
                  forkingId={forkingId}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {selectedReport && (
        <TeacherReportModal report={selectedReport} onClose={() => setSelectedReport(null)} />
      )}
    </section>
  )
}

function ShareMenu({ lessonId, open, copiedLink, onToggle, onClose, onCopy }) {
  const buttonRef = useRef(null)
  const panelRef = useRef(null)
  const [panelPosition, setPanelPosition] = useState(null)

  useLayoutEffect(() => {
    if (!open) {
      setPanelPosition(null)
      return undefined
    }

    function updatePanelPosition() {
      const button = buttonRef.current
      if (!button) return

      const rect = button.getBoundingClientRect()
      const margin = 12
      const gap = 8
      const panelWidth = panelRef.current?.offsetWidth || 360
      const panelHeight = panelRef.current?.offsetHeight || 0
      const maxLeft = Math.max(margin, window.innerWidth - panelWidth - margin)
      const left = Math.min(Math.max(margin, rect.right - panelWidth), maxLeft)
      const belowTop = rect.bottom + gap
      const top = panelHeight && belowTop + panelHeight > window.innerHeight - margin
        ? Math.max(margin, rect.top - panelHeight - gap)
        : belowTop

      setPanelPosition({ top, left })
    }

    updatePanelPosition()
    window.addEventListener('resize', updatePanelPosition)
    window.addEventListener('scroll', updatePanelPosition, true)
    return () => {
      window.removeEventListener('resize', updatePanelPosition)
      window.removeEventListener('scroll', updatePanelPosition, true)
    }
  }, [open])

  return (
    <div className="teacher-share" style={{ position: 'relative' }}>
      <button
        ref={buttonRef}
        className="btn-ghost-outline"
        style={s.actionBtn}
        onClick={onToggle}
        aria-expanded={open}
      >
        Share Links
      </button>
      {open && (
        <>
          <div className="teacher-share__overlay" onClick={onClose} />
          <div
            ref={panelRef}
            className="teacher-share__panel"
            style={{
              position: 'fixed',
              top: panelPosition?.top ?? 0,
              left: panelPosition?.left ?? 0,
              right: 'auto',
              minWidth: 320,
              maxWidth: 'calc(100vw - 24px)',
              visibility: panelPosition ? 'visible' : 'hidden',
            }}
          >
            <span className="teacher-share__title">Share lesson links</span>
            {(['join', 'solo']).map(type => (
              <div key={type} className="teacher-share__row">
                <div className="teacher-share__info">
                  <span className="teacher-share__type">
                    {type === 'join' ? 'Lesson Link (live or solo)' : 'Solo-Only Link'}
                  </span>
                  <span className="teacher-share__url">{getLessonLinks(lessonId)[type]}</span>
                </div>
                <button
                  className="btn-secondary teacher-share__copy-btn"
                  onClick={() => onCopy(lessonId, type)}
                >
                  {copiedLink?.id === lessonId && copiedLink?.type === type ? 'Copied!' : 'Copy'}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function LevelLessonGroup({
  bucket,
  open,
  onToggle,
  reports,
  feedback,
  shareOpenId,
  copiedLink,
  deletingId,
  deletedIds,
  reportsLoading,
  feedbackLoading,
  onToggleShare,
  onCloseShare,
  onCopyLink,
  onEditInBuilder,
  onDelete,
  onForkForClass,
  onViewReport,
  onResolveFeedback,
  classes,
  classesLoading,
  forkingId,
}) {
  const [openLessonIds, setOpenLessonIds] = useState(() => new Set())
  const [openForkFamilyIds, setOpenForkFamilyIds] = useState(() => new Set())

  function handleToggleLesson(lessonId) {
    setOpenLessonIds(prev => {
      const next = new Set(prev)
      if (next.has(lessonId)) next.delete(lessonId)
      else next.add(lessonId)
      return next
    })
  }

  function handleToggleForkFamily(familyId) {
    setOpenForkFamilyIds(prev => {
      const next = new Set(prev)
      if (next.has(familyId)) next.delete(familyId)
      else next.add(familyId)
      return next
    })
  }

  return (
    <div style={s.levelLessonGroup}>
      <button
        type="button"
        style={s.levelLessonToggle}
        onClick={onToggle}
        aria-expanded={open}
      >
        <span style={s.levelLessonTitleWrap}>
          <span style={{ ...s.levelColourDot, background: bucket.color }} />
          <span style={s.levelEmoji}>{displayLevelIcon(bucket.icon)}</span>
          <span>{bucket.title}</span>
        </span>
        <span style={s.levelLessonMeta}>
          {bucket.lessons.length} {bucket.lessons.length === 1 ? 'lesson' : 'lessons'}
          <span style={s.chevron}>{open ? '▾' : '▸'}</span>
        </span>
      </button>
      {open && (
        <div style={s.levelLessonBody}>
          {bucket.lessons.length === 0 ? (
            <p style={s.detailEmpty}>No lessons in this level yet.</p>
          ) : (
            <AdminTable
              headers={['Title', 'ID', 'Actions']}
              style={s.table}
              colgroup={(
                <colgroup>
                  <col style={{ width: '45%' }} />
                  <col style={{ width: '25%' }} />
                  <col style={{ width: '30%' }} />
                </colgroup>
              )}
            >
                {makeLessonFamilyGroups(bucket.lessons).map(family => (
                  <React.Fragment key={family.id}>
                    {family.items.map((lesson, index) => {
                      const isFork = isLessonFork(lesson)
                      const hasStockLesson = !isLessonFork(family.items[0])
                      const forkCount = hasStockLesson ? family.items.length - 1 : 0
                      const forksOpen = openForkFamilyIds.has(family.id)
                      if (isFork && hasStockLesson && !forksOpen) return null

                      const lessonReports = reports.filter(report => report.lessonId === lesson.id)
                      const lessonFeedback = feedback.filter(item => item.lessonId === lesson.id)
                      const lessonOpen = openLessonIds.has(lesson.id)
                      return (
                        <React.Fragment key={lesson.id}>
                          <tr>
                            <AdminCell>
                              <div style={s.lessonTitleCell}>
                                <button
                                  type="button"
                                  style={{ ...s.lessonToggle, ...(isFork ? s.forkLessonToggle : {}) }}
                                  onClick={() => handleToggleLesson(lesson.id)}
                                  aria-expanded={lessonOpen}
                                >
                                  <span style={s.lessonToggleIcon}>{lessonOpen ? '-' : '+'}</span>
                                  <span style={s.lessonToggleTitle}>{lesson.title || lesson.id}</span>
                                  {lesson.draft === true && (
                                    <span style={s.draftPill}>Draft</span>
                                  )}
                                  {isFork && (
                                    <span style={s.classPill}>{getForkClassLabel(lesson, classes)}</span>
                                  )}
                                </button>
                                {!isFork && forkCount > 0 && index === 0 && (
                                  <button
                                    type="button"
                                    style={s.forkFamilyToggle}
                                    onClick={() => handleToggleForkFamily(family.id)}
                                    aria-expanded={forksOpen}
                                    aria-label={`${forkCount} class ${forkCount === 1 ? 'fork' : 'forks'}`}
                                  >
                                    {forkCount} class {forkCount === 1 ? 'fork' : 'forks'}
                                    <span aria-hidden="true">{forksOpen ? '-' : '+'}</span>
                                  </button>
                                )}
                              </div>
                            </AdminCell>
                            <AdminCell style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#9ca3af' }}>{lesson.id}</AdminCell>
                            <AdminCell style={{ whiteSpace: 'nowrap' }}>
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
                                <a
                                  href={makePreviewUrl(lesson.id)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn-ghost-outline"
                                  style={s.actionBtn}
                                  title="Preview this lesson as a student — nothing is saved"
                                >
                                  Preview
                                </a>
                              </div>
                            </AdminCell>
                          </tr>
                          {lessonOpen && (
                            <tr>
                              <AdminCell colSpan={4} style={s.lessonDetailCell}>
                                <LessonAdminPanel
                                  lesson={lesson}
                                  reports={lessonReports}
                                  feedback={lessonFeedback}
                                  reportsLoading={reportsLoading}
                                  feedbackLoading={feedbackLoading}
                                  shareOpen={shareOpenId === lesson.id}
                                  copiedLink={copiedLink}
                                  deleting={deletingId === lesson.id || deletedIds.has(lesson.id)}
                                  classes={classes}
                                  classesLoading={classesLoading}
                                  forking={forkingId === lesson.id}
                                  onToggleShare={() => onToggleShare(lesson.id)}
                                  onCloseShare={onCloseShare}
                                  onCopyLink={onCopyLink}
                                  onEditInBuilder={() => onEditInBuilder(lesson)}
                                  onDelete={() => onDelete(lesson)}
                                  onForkForClass={classId => onForkForClass(lesson, classId)}
                                  onViewReport={onViewReport}
                                  onResolveFeedback={onResolveFeedback}
                                />
                              </AdminCell>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </React.Fragment>
                ))}
            </AdminTable>
          )}
        </div>
      )}
    </div>
  )
}

function LevelManager({ levels, lessons, activeType, onTypeChange, groups, loading }) {
  const [form, setForm] = useState(() => makeBlankLevelForm())
  const [editingLevelId, setEditingLevelId] = useState(null)
  const [saveState, setSaveState] = useState(null)

  useEffect(() => {
    setEditingLevelId(null)
    setForm(makeBlankLevelForm())
    setSaveState(null)
  }, [activeType])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaveState(null)
    const scopeId = 'lessons'
    const existingLevel = editingLevelId ? levels.find(level => level.id === editingLevelId) : null
    try {
      const level = normalizeLevelRecord({
        ...(existingLevel ?? {}),
        ...form,
        scopeType: 'collection',
        scopeId,
        id: editingLevelId ?? makeLevelId(form.title, scopeId),
        order: form.order === ''
          ? existingLevel?.order ?? levels.filter(item => item.scopeType === 'collection' && item.scopeId === scopeId).length + 1
          : Number(form.order),
      })
      await setDoc(doc(firestore, LEVEL_COLLECTION, level.id), level, { merge: true })
      if (editingLevelId) {
        const assignedLessons = lessons.filter(lesson => getLessonLevelRef(lesson)?.id === editingLevelId)
        await Promise.all(assignedLessons.map(lesson => updateDoc(doc(firestore, 'lessons', lesson.id), {
          level: level.title,
          levelId: level.id,
          levelRef: { id: level.id, scopeType: level.scopeType, scopeId: level.scopeId },
        })))
      }
      setEditingLevelId(null)
      setForm(makeBlankLevelForm())
      setSaveState({ type: 'success', message: `${editingLevelId ? 'Updated' : 'Saved'} ${level.title}.` })
    } catch (err) {
      setSaveState({ type: 'error', message: err.message || 'Could not save level.' })
    }
  }

  function handleEditLevel(bucket) {
    const level = bucket.level
    if (!level?.id) return
    setEditingLevelId(level.id)
    setSaveState(null)
    setForm({
      title: level.title ?? '',
      description: level.description ?? '',
      order: level.order == null ? '' : String(level.order),
      color: level.color ?? DEFAULT_LEVEL_COLOUR,
      icon: level.icon ?? DEFAULT_LEVEL_ICON,
    })
  }

  function handleCancelEdit() {
    setEditingLevelId(null)
    setSaveState(null)
    setForm(makeBlankLevelForm())
  }

  async function handleDeleteLevel(bucket) {
    const level = bucket.level
    if (!level?.id) return
    const assignedLessons = lessons.filter(lesson => getLessonLevelRef(lesson)?.id === level.id)
    const lessonWord = assignedLessons.length === 1 ? 'lesson' : 'lessons'
    const assignedText = assignedLessons.length > 0
      ? `\n\nThis will remove the level from ${assignedLessons.length} ${lessonWord}.`
      : ''
    if (!window.confirm(`Delete level "${level.title}"?${assignedText}`)) return
    setSaveState(null)
    try {
      await Promise.all(assignedLessons.map(lesson => updateDoc(doc(firestore, 'lessons', lesson.id), {
        level: null,
        levelId: null,
        levelRef: null,
      })))
      await deleteDoc(doc(firestore, LEVEL_COLLECTION, level.id))
      setSaveState({ type: 'success', message: `Deleted ${level.title}.` })
    } catch (err) {
      setSaveState({ type: 'error', message: err.message || 'Could not delete level.' })
    }
  }

  const activeLessons = lessons
  const activeBuckets = useMemo(
    () => makeLevelBuckets(activeLessons, levels, null),
    [activeLessons, levels],
  )

  return (
    <section style={s.section}>
      <div style={s.titleRow}>
        <div>
          <h2 style={s.title}>Levels</h2>
          <p style={s.subtitle}>Levels group lessons across the library. Lower order numbers appear first.</p>
        </div>
        <span style={s.levelManagerMeta}>{loading ? 'Loading...' : `${levels.length} total`}</span>
      </div>

      <div style={s.levelManager}>
        <div style={s.levelManagerBody}>

          <form style={s.levelForm} onSubmit={handleSubmit}>
            <label style={s.levelField}>
              <span style={s.levelLabel}>Level title</span>
              <input
                style={s.levelInput}
                value={form.title}
                onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Beginner"
                required
              />
            </label>

            <label style={s.levelField}>
              <span style={s.levelLabel}>Order</span>
              <input
                style={s.levelInput}
                type="number"
                value={form.order}
                onChange={e => setForm(prev => ({ ...prev, order: e.target.value }))}
                placeholder="1"
                min="0"
              />
              <span style={s.fieldHint}>Lower numbers show first.</span>
            </label>

            <label style={s.levelField}>
              <span style={s.levelLabel}>Colour</span>
              <div style={s.colorControl}>
                <input
                  style={s.colorPicker}
                  type="color"
                  value={form.color}
                  onChange={e => setForm(prev => ({ ...prev, color: e.target.value }))}
                  aria-label="Level colour"
                />
                <input
                  style={{ ...s.levelInput, flex: 1 }}
                  value={form.color}
                  onChange={e => setForm(prev => ({ ...prev, color: e.target.value }))}
                  placeholder="#7c3aed"
                />
              </div>
            </label>

            <label style={{ ...s.levelField, gridColumn: '1 / -1' }}>
              <span style={s.levelLabel}>Icon</span>
              <div style={s.emojiPicker} role="group" aria-label="Choose level icon">
                {COMMON_LEVEL_EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    style={{
                      ...s.emojiOption,
                      ...(form.icon === emoji ? s.emojiOptionActive : {}),
                    }}
                    onClick={() => setForm(prev => ({ ...prev, icon: emoji }))}
                    aria-label={`Use ${emoji} icon`}
                  >
                    {emoji}
                  </button>
                ))}
                <input
                  style={s.emojiInput}
                  value={form.icon}
                  onChange={e => setForm(prev => ({ ...prev, icon: e.target.value }))}
                  aria-label="Custom level emoji"
                  maxLength={4}
                />
              </div>
            </label>

            <label style={{ ...s.levelField, gridColumn: '1 / -1' }}>
              <span style={s.levelLabel}>Description</span>
              <input
                style={s.levelInput}
                value={form.description}
                onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Short description for admins"
              />
            </label>

            <div style={s.levelFormFooter}>
              {saveState && (
                <span style={saveState.type === 'error' ? s.formError : s.formSuccess}>
                  {saveState.message}
                </span>
              )}
              <div style={s.levelFormActions}>
                {editingLevelId && (
                  <button
                    type="button"
                    className="btn-ghost-outline"
                    style={s.levelSubmit}
                    onClick={handleCancelEdit}
                  >
                    Cancel
                  </button>
                )}
                <button type="submit" className="btn-secondary" style={s.levelSubmit}>
                  {editingLevelId ? 'Save Changes' : 'Create Level'}
                </button>
              </div>
            </div>
          </form>

          {activeBuckets.length === 0 ? (
            <p style={s.muted}>Create a library level, then assign lessons to it in the Builder lesson details.</p>
          ) : (
            <div style={s.levelPreviewList}>
              {activeBuckets.map(bucket => (
                <div key={bucket.id} style={s.levelPreviewItem}>
                  <span style={{ ...s.levelColourDot, background: bucket.color }} />
                  <span style={s.levelEmoji}>{displayLevelIcon(bucket.icon)}</span>
                  <span style={s.levelPreviewText}>
                    <strong style={s.levelPreviewTitle}>{bucket.title}</strong>
                    <span style={s.levelPreviewMeta}>{bucket.lessons.length} {bucket.lessons.length === 1 ? 'lesson' : 'lessons'}</span>
                  </span>
                  {bucket.level && (
                    <div style={s.levelPreviewActions}>
                      <button
                        type="button"
                        className="btn-ghost-outline"
                        style={s.levelDeleteBtn}
                        onClick={() => handleEditLevel(bucket)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn-danger"
                        style={s.levelDeleteBtn}
                        onClick={() => handleDeleteLevel(bucket)}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function ClassManager({ classes, loading }) {
  const [form, setForm] = useState({ id: '', name: '' })
  const [idTouched, setIdTouched] = useState(false)
  const [saveState, setSaveState] = useState(null)
  const activeClasses = classes.filter(cls => !cls.archived)
  const archivedClasses = classes.filter(cls => cls.archived)

  function setName(value) {
    setForm(prev => ({
      name: value,
      id: idTouched ? prev.id : slugifyClassId(value),
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaveState(null)
    try {
      const record = await saveClassRecord({ id: form.id, name: form.name, archived: false })
      setForm({ id: '', name: '' })
      setIdTouched(false)
      setSaveState({ type: 'success', message: `Saved ${record.name}.` })
    } catch (err) {
      setSaveState({ type: 'error', message: err.message })
    }
  }

  async function handleArchive(cls) {
    if (!window.confirm(`Archive class "${cls.name}"? Existing lesson forks will remain available.`)) return
    try {
      await saveClassRecord({ ...cls, archived: true, updatedAt: Date.now() })
    } catch (err) {
      window.alert('Failed to archive class: ' + err.message)
    }
  }

  return (
    <section style={s.section}>
      <div style={s.titleRow}>
        <div>
          <h2 style={s.title}>Classes</h2>
          <p style={s.subtitle}>Admin-only class records used to organise reusable lesson forks.</p>
        </div>
      </div>

      <form style={s.levelForm} onSubmit={handleSubmit}>
        <label style={s.levelField}>
          <span style={s.levelLabel}>Class name</span>
          <input
            style={s.levelInput}
            value={form.name}
            onChange={e => setName(e.target.value)}
            placeholder="Maple"
            required
          />
        </label>
        <label style={s.levelField}>
          <span style={s.levelLabel}>Class ID</span>
          <input
            style={s.levelInput}
            value={form.id}
            onChange={e => {
              setIdTouched(true)
              setForm(prev => ({ ...prev, id: slugifyClassId(e.target.value) }))
            }}
            placeholder="maple"
            required
          />
        </label>
        <div style={s.levelFormFooter}>
          {saveState && (
            <span style={saveState.type === 'error' ? s.formError : s.formSuccess}>
              {saveState.message}
            </span>
          )}
          <button type="submit" className="btn-secondary" style={s.levelSubmit}>Save Class</button>
        </div>
      </form>

      {loading ? (
        <p style={s.muted}>Loading classes...</p>
      ) : activeClasses.length === 0 ? (
        <p style={s.muted}>No classes yet.</p>
      ) : (
        <div style={s.levelPreviewList}>
          {activeClasses.map(cls => (
            <div key={cls.id} style={s.classPreviewItem}>
              <span style={s.levelPreviewText}>
                <strong style={s.levelPreviewTitle}>{cls.name}</strong>
                <span style={s.levelPreviewMeta}>{cls.id}</span>
              </span>
              <button
                type="button"
                className="btn-ghost-outline"
                style={s.levelDeleteBtn}
                onClick={() => handleArchive(cls)}
              >
                Archive
              </button>
            </div>
          ))}
        </div>
      )}

      {archivedClasses.length > 0 && (
        <CollapsibleDetail title="Archived" meta={`${archivedClasses.length} total`}>
          {archivedClasses.map(cls => (
            <div key={cls.id} style={s.detailItem}>
              <div>
                <strong>{cls.name}</strong>
                <span style={s.detailMeta}>{cls.id}</span>
              </div>
            </div>
          ))}
        </CollapsibleDetail>
      )}
    </section>
  )
}

function LessonAdminPanel({
  lesson,
  reports,
  feedback,
  reportsLoading,
  feedbackLoading,
  shareOpen,
  copiedLink,
  deleting,
  classes,
  classesLoading,
  forking,
  onToggleShare,
  onCloseShare,
  onCopyLink,
  onEditInBuilder,
  onDelete,
  onForkForClass,
  onViewReport,
  onResolveFeedback,
}) {
  const activeClasses = (classes ?? []).filter(cls => !cls.archived)
  const [selectedClassId, setSelectedClassId] = useState('')
  const selectedClass = activeClasses.find(cls => cls.id === selectedClassId)

  return (
    <div style={s.lessonAdminPanel}>
      <div style={s.lessonAdminActions}>
        <ShareMenu
          lessonId={lesson.id}
          open={shareOpen}
          copiedLink={copiedLink}
          onToggle={onToggleShare}
          onClose={onCloseShare}
          onCopy={onCopyLink}
        />
        <button
          className="btn-ghost-outline"
          style={s.actionBtn}
          onClick={onEditInBuilder}
        >
          Edit in Builder
        </button>
        <button
          className="btn-danger"
          style={s.actionBtn}
          disabled={deleting}
          onClick={onDelete}
        >
          {deleting ? '...' : 'Delete'}
        </button>
      </div>
      {isLessonFork(lesson) ? (
        <div style={s.forkMetaPanel}>
          <span style={s.forkMetaLabel}>Fork</span>
          <span style={s.forkMetaText}>
            {lesson.fork.sourceLessonTitle || lesson.fork.sourceLessonId} / {lesson.fork.className || lesson.fork.classId}
          </span>
        </div>
      ) : (
        <div style={s.forkActionPanel}>
          <label style={s.forkSelectLabel}>
            <span style={s.forkMetaLabel}>Fork for class</span>
            <select
              style={s.forkSelect}
              value={selectedClassId}
              disabled={classesLoading || activeClasses.length === 0 || forking}
              onChange={e => setSelectedClassId(e.target.value)}
            >
              <option value="">{classesLoading ? 'Loading classes...' : 'Choose class'}</option>
              {activeClasses.map(cls => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn-secondary"
            style={s.actionBtn}
            disabled={!selectedClass || forking}
            onClick={() => onForkForClass(selectedClassId)}
          >
            {forking ? 'Forking...' : selectedClass ? `Create ${makeForkLessonId(lesson.id, selectedClass.id)}` : 'Create Fork'}
          </button>
        </div>
      )}
      {reports.length > 0 && (
        <LessonReportsSection
          lesson={lesson}
          reports={reports}
          loading={reportsLoading}
          onViewReport={onViewReport}
        />
      )}
      {feedback.length > 0 && (
        <LessonFeedbackSection
          feedback={feedback}
          loading={feedbackLoading}
          onResolveFeedback={onResolveFeedback}
        />
      )}
    </div>
  )
}

function LessonReportsSection({ lesson, reports, loading, onViewReport }) {
  return (
    <CollapsibleDetail
      title="Reports"
      meta={loading ? 'Loading...' : `${reports.length} total`}
    >
      {reports.map(report => (
        <div key={report.id} style={s.detailItem}>
          <div>
            <strong>{report.lessonTitle || lesson.title || lesson.id}</strong>
            <span style={s.detailMeta}>
              {report.startedAt ? new Date(report.startedAt).toLocaleString() : 'No start time'} - {report.students?.length ?? 0} students
            </span>
          </div>
          <button className="btn-ghost-outline" style={s.detailBtn} onClick={() => onViewReport(report)}>View</button>
        </div>
      ))}
    </CollapsibleDetail>
  )
}

function LessonFeedbackSection({ feedback, loading, onResolveFeedback }) {
  const openFeedback = openCount(feedback)

  return (
    <CollapsibleDetail
      title="Feedback"
      meta={loading ? 'Loading...' : `${openFeedback} open / ${feedback.length} total`}
    >
      {feedback.map(item => (
        <div key={item.id} style={{ ...s.detailItem, opacity: item.archived || item.resolvedAt ? 0.62 : 1 }}>
          <div>
            <strong>{item.taskTitle || 'Lesson feedback'}</strong>
            <span style={s.detailMeta}>
              {item.teacherEmail || 'Unknown teacher'} - {item.submittedAt ? new Date(item.submittedAt).toLocaleString() : 'No date'}
            </span>
            <p style={s.feedbackText}>{item.text}</p>
          </div>
          <button
            className="btn-ghost-outline"
            style={s.detailBtn}
            disabled={item.archived || item.resolvedAt}
            onClick={() => onResolveFeedback(item)}
          >
            {item.archived || item.resolvedAt ? 'Resolved' : 'Resolve'}
          </button>
        </div>
      ))}
    </CollapsibleDetail>
  )
}

function CollapsibleDetail({ title, meta, children }) {
  const [open, setOpen] = useState(false)

  return (
    <div style={s.detailPanel}>
      <button
        type="button"
        style={{ ...s.detailToggle, ...(open ? s.detailToggleOpen : {}) }}
        onClick={() => setOpen(open => !open)}
        aria-expanded={open}
      >
        <span style={s.detailToggleTitle}>
          <span style={s.detailToggleIcon}>{open ? '-' : '+'}</span>
          <span>{title}</span>
        </span>
        <span style={s.detailToggleMeta}>{meta}</span>
      </button>
      {open && <div style={s.detailBody}>{children}</div>}
    </div>
  )
}

const s = {
  section:      { display: 'flex', flexDirection: 'column', gap: 20 },
  titleRow:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title:        { fontFamily: 'var(--font-title)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--colour-text)', margin: 0 },
  subtitle:     { margin: '4px 0 0', fontFamily: 'var(--font-body)', fontSize: '0.84rem', color: '#6b7280' },
  headerActions:{ display: 'flex', gap: 8 },
  headerBtn:    { padding: '6px 14px', fontSize: '0.85rem' },
  group:      { display: 'flex', flexDirection: 'column', gap: 0 },
  tabCount:   { background: '#f0eafa', color: 'var(--colour-primary)', borderRadius: 999, padding: '1px 6px', fontSize: '0.7rem', fontWeight: 700, marginLeft: 4 },
  table:      { tableLayout: 'fixed' },
  stageBadge: { display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 700, color: '#fff', letterSpacing: '0.02em' },
  actions:    { display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'nowrap' },
  actionBtn:  { padding: '4px 7px', fontSize: '0.76rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', flexShrink: 0 },
  lessonTitleCell: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 },
  lessonToggle: { width: '100%', border: 'none', background: 'transparent', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 8, textAlign: 'left', cursor: 'pointer', fontFamily: 'var(--font-body)', color: 'var(--colour-text)', fontSize: '0.9rem' },
  forkLessonToggle: { paddingLeft: 18 },
  lessonToggleIcon: { width: 18, height: 18, borderRadius: 999, border: '1px solid #e5e7eb', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: '0.78rem', fontWeight: 700, lineHeight: 1, flexShrink: 0, background: '#fff' },
  lessonToggleTitle: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  forkFamilyToggle: { border: 'none', background: 'transparent', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 5, color: '#6b7280', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.76rem', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 },
  classPill: { border: '1px solid #bfdbfe', borderRadius: 999, background: '#eff6ff', color: '#1d4ed8', fontSize: '0.68rem', fontWeight: 700, padding: '1px 7px', whiteSpace: 'nowrap', flexShrink: 0 },
  draftPill: { border: '1px solid #fde68a', borderRadius: 999, background: '#fffbeb', color: '#92400e', fontSize: '0.68rem', fontWeight: 700, padding: '1px 7px', whiteSpace: 'nowrap', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.02em' },
  lessonDetailCell: { padding: '0 12px 10px 38px', background: '#fbfbfd', borderBottom: '1px solid #eef0f4' },
  lessonAdminPanel: { display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8 },
  lessonAdminActions: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  forkActionPanel: { display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff' },
  forkSelectLabel: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 220, fontFamily: 'var(--font-body)' },
  forkSelect: { minWidth: 220, padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--colour-text)', background: '#fff' },
  forkMetaPanel: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', fontFamily: 'var(--font-body)' },
  forkMetaLabel: { fontSize: '0.72rem', color: '#6b7280', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' },
  forkMetaText: { fontSize: '0.84rem', color: '#374151', fontWeight: 600 },
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
  emptyTableState: { border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', padding: '20px 12px', textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: '0.86rem', color: '#9ca3af' },
  levelAccordion: { display: 'flex', flexDirection: 'column', gap: 8 },
  levelLessonGroup: { border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', overflow: 'hidden' },
  levelLessonToggle: { width: '100%', border: 'none', background: '#fff', padding: '11px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer', fontFamily: 'var(--font-title)', fontWeight: 700, color: 'var(--colour-text)' },
  levelLessonTitleWrap: { display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 },
  levelColourDot: { width: 12, height: 12, borderRadius: '50%', border: '1px solid rgba(0,0,0,0.12)', flexShrink: 0 },
  levelEmoji: { width: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 },
  levelLessonMeta: { display: 'inline-flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' },
  chevron: { color: '#9ca3af', fontSize: '0.9rem' },
  levelLessonBody: { borderTop: '1px solid #f3f4f6', padding: 10, overflowX: 'auto' },
  levelManager: { border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', overflow: 'hidden' },
  levelManagerMeta: { fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#6b7280', fontWeight: 600 },
  levelManagerBody: { padding: 14, display: 'flex', flexDirection: 'column', gap: 14 },
  levelTypeTabs: { flexWrap: 'wrap' },
  levelForm: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, alignItems: 'start', padding: 12, border: '1px solid #f3f4f6', borderRadius: 8, background: '#fafafa' },
  levelField: { minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5, fontFamily: 'var(--font-body)' },
  levelLabel: { fontSize: '0.76rem', fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.04em' },
  fieldHint: { fontSize: '0.75rem', color: '#6b7280', lineHeight: 1.35 },
  levelInput: { minWidth: 0, padding: '7px 9px', border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--colour-text)' },
  levelSubmit: { padding: '7px 12px', fontSize: '0.82rem', whiteSpace: 'nowrap' },
  colorControl: { display: 'flex', alignItems: 'center', gap: 8 },
  colorPicker: { width: 40, height: 34, padding: 2, border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer', flexShrink: 0 },
  emojiPicker: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  emojiOption: { width: 32, height: 32, border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontFamily: '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif' },
  emojiOptionActive: { borderColor: 'var(--colour-primary)', background: '#f0eafa', boxShadow: '0 0 0 1px var(--colour-primary)' },
  emojiInput: { width: 54, height: 32, border: '1px solid #d1d5db', borderRadius: 6, textAlign: 'center', fontSize: '1rem', background: '#fff' },
  levelFormFooter: { gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  levelFormActions: { marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' },
  formSuccess: { fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#15803d', fontWeight: 600 },
  formError: { fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#dc2626', fontWeight: 600 },
  levelPreviewList: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 8 },
  levelPreviewItem: { display: 'grid', gridTemplateColumns: '12px 22px minmax(0, 1fr) auto', alignItems: 'center', gap: 8, border: '1px solid #e5e7eb', borderRadius: 8, padding: '9px 10px', background: '#fff', fontFamily: 'var(--font-body)', color: 'var(--colour-text)', minWidth: 0 },
  classPreviewItem: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: 8, border: '1px solid #e5e7eb', borderRadius: 8, padding: '9px 10px', background: '#fff', fontFamily: 'var(--font-body)', color: 'var(--colour-text)', minWidth: 0 },
  levelPreviewText: { minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2, lineHeight: 1.2 },
  levelPreviewTitle: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  levelPreviewMeta: { color: '#6b7280', fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap' },
  levelPreviewActions: { display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, justifyContent: 'flex-end' },
  levelDeleteBtn: { padding: '4px 9px', fontSize: '0.76rem', flexShrink: 0 },
  detailPanel: { background: 'transparent', overflow: 'hidden' },
  detailToggle: { width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer', fontFamily: 'var(--font-title)', fontWeight: 700, color: '#374151', fontSize: '0.86rem' },
  detailToggleOpen: { borderColor: '#ddd6fe', background: '#fbfaff' },
  detailToggleTitle: { display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 },
  detailToggleIcon: { width: 18, height: 18, borderRadius: 999, border: '1px solid #d8b4fe', background: '#faf5ff', color: 'var(--colour-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 800, lineHeight: 1, flexShrink: 0 },
  detailToggleMeta: { fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#6b7280', fontWeight: 600 },
  detailBody: { padding: '4px 10px 6px', display: 'flex', flexDirection: 'column', gap: 0 },
  detailItem: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'start', gap: 12, padding: '9px 0', borderBottom: '1px solid #eef0f4', fontFamily: 'var(--font-body)', fontSize: '0.84rem', color: 'var(--colour-text)' },
  detailMeta: { display: 'block', marginTop: 2, color: '#6b7280', fontSize: '0.76rem' },
  detailBtn: { padding: '4px 10px', fontSize: '0.78rem' },
  detailEmpty: { margin: 0, fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#9ca3af' },
  feedbackText: { margin: '5px 0 0', whiteSpace: 'pre-wrap', lineHeight: 1.45, color: '#374151' },
}
