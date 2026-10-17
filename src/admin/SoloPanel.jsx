// Admin ▸ Solo & side-quests: who did the Solo Challenges (and any lesson opened solo) and who
// worked on side-quests in live sessions, per lesson and class. Solo comes from the RTDB
// `soloLog` (src/shared/soloLog.js), side-quests from the stored session reports. The download is
// anonymised ("Student N", no names) like a session report.
import { useEffect, useMemo, useState } from 'react'
import { collection, collectionGroup, onSnapshot, orderBy, query } from 'firebase/firestore'
import { firestore } from '../shared/firebase'
import { decodeLessonFromFirestore } from '../shared/lessonBlocksCodec'
import { readSoloLog } from '../app/soloLogService'
import { buildSideQuestRows, buildSoloExport, buildSoloRows } from '../shared/soloLog'
import {
  AdminBadge,
  AdminCell,
  AdminMessage,
  AdminSection,
  AdminTable,
  adminUiStyles,
} from './AdminUi'

const formatDateTime = (ms) => (ms ? new Date(ms).toLocaleString() : '—')

function lessonClass(lesson) {
  const fork = lesson?.fork
  if (!fork) return null
  return { id: fork.classId ?? fork.className ?? 'fork', name: fork.className ?? fork.classId }
}

function lessonLabel(lesson) {
  const kind = lesson.companionOf ? ' (Solo Challenge)' : lessonClass(lesson) ? ' (class fork)' : ''
  return `${lesson.title || lesson.id}${kind}`
}

function studentCell(row) {
  if (row.name) return row.name
  return `Unnamed (…${row.anonymousId.slice(-4)})`
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export default function SoloPanel() {
  const [lessons, setLessons] = useState([])
  const [soloLog, setSoloLog] = useState(null)
  const [reports, setReports] = useState([])
  const [error, setError] = useState(null)
  const [classId, setClassId] = useState('')
  const [lessonId, setLessonId] = useState('')

  useEffect(() => {
    return onSnapshot(collection(firestore, 'lessons'), (snap) => {
      setLessons(snap.docs.map((d) => ({ id: d.id, ...decodeLessonFromFirestore(d.data()) })))
    })
  }, [])

  useEffect(() => {
    const q = query(collectionGroup(firestore, 'sessionReports'), orderBy('startedAt', 'desc'))
    return onSnapshot(
      q,
      (snap) =>
        setReports(
          snap.docs.map((d) => ({ lessonId: d.ref.parent.parent?.id ?? null, ...d.data() }))
        ),
      () => {}
    )
  }, [])

  useEffect(() => {
    let cancelled = false
    readSoloLog()
      .then((data) => !cancelled && setSoloLog(data))
      .catch((err) => !cancelled && setError(err.message))
    return () => {
      cancelled = true
    }
  }, [])

  const lessonsById = useMemo(() => new Map(lessons.map((l) => [l.id, l])), [lessons])
  const sideQuestRows = useMemo(() => buildSideQuestRows(reports), [reports])

  // Lessons with anything to show: a solo log, or a side-quest in a stored report.
  const lessonOptions = useMemo(() => {
    const ids = new Set([
      ...Object.keys(soloLog ?? {}),
      ...sideQuestRows.map((row) => row.lessonId).filter(Boolean),
    ])
    return [...ids]
      .map((id) => lessonsById.get(id) ?? { id, title: id })
      .filter((lesson) => !classId || lessonClass(lesson)?.id === classId)
      .sort((a, b) => lessonLabel(a).localeCompare(lessonLabel(b)))
  }, [soloLog, sideQuestRows, lessonsById, classId])

  const classOptions = useMemo(() => {
    const byId = new Map()
    for (const lesson of lessons) {
      const cls = lessonClass(lesson)
      if (cls) byId.set(cls.id, cls.name)
    }
    return [...byId].sort((a, b) => String(a[1]).localeCompare(String(b[1])))
  }, [lessons])

  const lesson = lessonsById.get(lessonId) ?? null
  const soloRows = useMemo(
    () => (lessonId ? buildSoloRows(soloLog?.[lessonId], lesson?.tasks ?? null) : []),
    [soloLog, lessonId, lesson]
  )
  const lessonSideQuests = useMemo(
    () => sideQuestRows.filter((row) => row.lessonId === lessonId),
    [sideQuestRows, lessonId]
  )

  function handleDownload() {
    downloadJson(`${lessonId}-solo-and-side-quests.json`, {
      ...buildSoloExport({
        lessonId,
        lessonTitle: lesson?.title ?? null,
        lessonLog: soloLog?.[lessonId],
        lessonTasks: lesson?.tasks ?? null,
      }),
      // Side-quest labels are the session reports' own ("Student N" within one session).
      sideQuests: lessonSideQuests,
    })
  }

  return (
    <AdminSection
      title="Solo & side-quests"
      subtitle="Who did the Solo Challenges and side-quests, per lesson"
    >
      {error && <AdminMessage tone="error">{error}</AdminMessage>}
      {!soloLog && !error && <AdminMessage>Loading solo log…</AdminMessage>}
      <div style={s.filters}>
        <label style={s.label}>
          Class
          <select
            style={s.select}
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value)
              setLessonId('')
            }}
          >
            <option value="">All classes</option>
            {classOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label style={s.label}>
          Lesson
          <select style={s.select} value={lessonId} onChange={(e) => setLessonId(e.target.value)}>
            <option value="">Pick a lesson…</option>
            {lessonOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {lessonLabel(item)}
              </option>
            ))}
          </select>
        </label>
        {lessonId && (
          <button
            className="btn-ghost-outline"
            style={adminUiStyles.actionBtn}
            onClick={handleDownload}
          >
            Download (no names)
          </button>
        )}
      </div>

      {lessonId && (
        <>
          <h3 style={s.heading}>Solo study</h3>
          {soloRows.length === 0 ? (
            <AdminMessage>No one has opened this lesson solo yet.</AdminMessage>
          ) : (
            <AdminTable
              headers={[
                'Student',
                'Started',
                'Finished',
                'Tasks passed',
                'First attempt',
                'Last active',
              ]}
            >
              {soloRows.map((row) => (
                <SoloRow key={row.anonymousId} row={row} />
              ))}
            </AdminTable>
          )}

          <h3 style={s.heading}>Side-quests in live sessions</h3>
          {lessonSideQuests.length === 0 ? (
            <AdminMessage>No side-quests opened in this lesson&apos;s ended sessions.</AdminMessage>
          ) : (
            <AdminTable
              headers={[
                'Session',
                'Student',
                'Task',
                'Side-quest',
                'Opened',
                'Runs',
                'Done (self-reported)',
              ]}
            >
              {lessonSideQuests.map((row) => (
                <tr key={`${row.sessionId}-${row.studentLabel}-${row.taskId}-${row.index}`}>
                  <AdminCell>{formatDateTime(row.startedAt)}</AdminCell>
                  <AdminCell>{row.studentLabel}</AdminCell>
                  <AdminCell>{row.taskTitle ?? row.taskId}</AdminCell>
                  <AdminCell>{row.title ?? `#${row.index + 1}`}</AdminCell>
                  <AdminCell>{formatDateTime(row.openedAt)}</AdminCell>
                  <AdminCell>
                    {row.runs}
                    {row.errorRuns > 0 ? ` (${row.errorRuns} errors)` : ''}
                  </AdminCell>
                  <AdminCell>
                    {row.done ? (
                      <AdminBadge style={s.done}>Done {formatDateTime(row.doneAt)}</AdminBadge>
                    ) : (
                      'Not marked'
                    )}
                  </AdminCell>
                </tr>
              ))}
            </AdminTable>
          )}
          <p style={s.note}>
            Side-quest students show as in the session report (&quot;Student N&quot;, a different
            number per session). Solo students show by name only when they joined a live lesson on
            that device first.
          </p>
        </>
      )}
    </AdminSection>
  )
}

function SoloRow({ row }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <tr>
        <AdminCell>
          <button type="button" style={s.linkBtn} onClick={() => setOpen((v) => !v)}>
            {open ? '▾' : '▸'} {studentCell(row)}
          </button>
        </AdminCell>
        <AdminCell>{formatDateTime(row.startedAt)}</AdminCell>
        <AdminCell>{row.finishedAt ? formatDateTime(row.finishedAt) : 'Not finished'}</AdminCell>
        <AdminCell>
          {row.tasksPassed}/{row.taskCount}
        </AdminCell>
        <AdminCell>{row.firstAttemptPasses}</AdminCell>
        <AdminCell>{formatDateTime(row.lastAt)}</AdminCell>
      </tr>
      {open && (
        <tr>
          <AdminCell colSpan={6}>
            {row.tasks.map((task) => (
              <div key={task.taskId} style={s.taskLine}>
                {task.passed ? (task.firstTry ? '✓ first try' : '✓ passed') : '○ not passed'} —{' '}
                {task.title} ({task.attempts} {task.attempts === 1 ? 'attempt' : 'attempts'}
                {task.passedAt ? `, ${formatDateTime(task.passedAt)}` : ''})
              </div>
            ))}
          </AdminCell>
        </tr>
      )}
    </>
  )
}

const s = {
  filters: { display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 },
  label: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.85rem' },
  select: { minWidth: 220, padding: '6px 8px' },
  heading: { margin: '16px 0 8px', fontFamily: 'var(--font-display)', fontSize: '1.05rem' },
  linkBtn: {
    background: 'none',
    border: 'none',
    padding: 0,
    font: 'inherit',
    cursor: 'pointer',
    color: 'inherit',
    textAlign: 'left',
  },
  taskLine: { fontSize: '0.85rem', padding: '2px 0' },
  done: { background: '#dcfce7', color: '#15803d' },
  note: { fontSize: '0.8rem', color: '#6b7280', marginTop: 12 },
}
