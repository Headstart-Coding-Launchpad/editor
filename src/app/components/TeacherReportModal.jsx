import React, { useMemo, useRef, useState } from 'react'
import { anonymizeSessionReport, reportToYamlText } from '../../shared/lessonReport'

function formatDuration(ms) {
  if (ms == null) return '—'
  const totalSeconds = Math.round(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes === 0 ? `${seconds}s` : `${minutes}m ${seconds}s`
}

function renderSubmission(submission) {
  if (submission == null) return '(none)'
  if (typeof submission === 'string') return submission
  try { return JSON.stringify(submission, null, 2) } catch { return String(submission) }
}

function formatFinalResult(task) {
  if (task.finalResult === 'not_attempted' || task.finalResult === 'not attempted') return 'Not attempted'
  if (task.finalResult === 'not_applicable') return task.completed ? 'Answered' : 'No response'
  if (task.finalResult === 'overridden_failed') return 'Overridden'
  if (task.finalResult === 'overridden_unattempted') return 'Skipped'
  return task.completed ? 'Passed' : 'Failed'
}

function resultBadgeStyle(task) {
  if (task.finalResult === 'not_applicable') return task.completed ? s.badgeInfo : s.badgeNone
  if (task.finalResult === 'not_attempted' || task.finalResult === 'not attempted') return s.badgeNone
  if (task.finalResult === 'overridden_failed' || task.finalResult === 'overridden_unattempted') return s.badgeInfo
  return task.completed ? s.badgePass : s.badgeFail
}

function formatAttemptStatus(attempt) {
  if (attempt.passed == null) return 'Response'
  return attempt.passed ? 'Passed' : 'Failed'
}

function attemptBadgeStyle(attempt) {
  if (attempt.passed == null) return s.badgeInfo
  return attempt.passed ? s.badgePass : s.badgeFail
}

function formatSummaryCompletion(task) {
  const overrideLabel = task.overrideCount > 0
    ? `, ${task.overrideCount} override${task.overrideCount === 1 ? '' : 's'}`
    : ''
  if (typeof task.completionRate === 'number') {
    return `${task.completedCount}/${task.totalStudents} (${Math.round(task.completionRate * 100)}%)${overrideLabel}`
  }
  if (typeof task.respondedCount === 'number') {
    return `${task.respondedCount}/${task.totalStudents} responded${overrideLabel}`
  }
  return '-'
}

function formatOverrideDetail(task) {
  if (!task.override) return null
  const attempts = task.override.attemptNumber ?? 0
  return task.override.previousCheckState === 'failed'
    ? `Teacher moved on after ${attempts} attempt${attempts === 1 ? '' : 's'}`
    : 'Teacher moved on before an attempt'
}

function formatSummaryFailures(task) {
  const parts = []
  const commonFailures = task.commonFailures ?? []
  if (commonFailures.length > 0) {
    parts.push(commonFailures.map(f => `${f.suggestion} (${f.count})`).join('; '))
  }
  if (task.blankFailures?.length > 0) {
    parts.push(`Blank misses: ${task.blankFailures.map(f => `${f.blankId} (${f.count})`).join(', ')}`)
  }
  if (task.pairFailures?.length > 0) {
    parts.push(`Pair misses: ${task.pairFailures.map(f => `${f.pairId} (${f.count})`).join(', ')}`)
  }
  if (task.ratingDistribution) {
    parts.push(`Ratings: ${Object.entries(task.ratingDistribution).map(([rating, count]) => `${rating}:${count}`).join(', ')}`)
  }
  return parts.length > 0 ? parts.join('; ') : '-'
}

function StudentTaskRow({ task }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div style={s.taskRow}>
      <button style={s.taskRowHeader} onClick={() => setExpanded(v => !v)}>
        <span style={{ ...s.badge, ...resultBadgeStyle(task) }}>
          {formatFinalResult(task)}
        </span>
        <span style={s.taskTitle}>{task.title}</span>
        {(task.attempts > 0 || task.timeOnTaskMs != null) && (
          <span style={s.attemptsCount}>
            {task.attempts > 0 ? `${task.attempts} attempt${task.attempts === 1 ? '' : 's'}` : ''}
            {task.attempts > 0 && task.timeOnTaskMs != null ? ' · ' : ''}
            {task.timeOnTaskMs != null ? formatDuration(task.timeOnTaskMs) : ''}
          </span>
        )}
        {task.override && <span style={s.overrideNote}>{formatOverrideDetail(task)}</span>}
        {task.distinctAttempts.length > 0 && <span style={s.expandArrow}>{expanded ? '▾' : '▸'}</span>}
      </button>
      {expanded && task.distinctAttempts.length > 0 && (
        <div style={s.attemptsList}>
          {task.distinctAttempts.map((a, i) => (
            <div key={i} style={s.attemptItem}>
              <div style={s.attemptHeader}>
                <span style={{ ...s.badge, ...attemptBadgeStyle(a) }}>
                  {formatAttemptStatus(a)} {a.attemptNumber}{a.retries > 0 ? ` (retried ${a.retries}x)` : ''}
                </span>
                {a.suggestion && <span style={s.suggestion}>{a.suggestion}</span>}
              </div>
              <pre style={s.submission}>{renderSubmission(a.submission)}</pre>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StudentSection({ student }) {
  const [expanded, setExpanded] = useState(false)
  const completedCount = student.tasks.filter(t => t.completed).length
  return (
    <div style={s.studentSection}>
      <button style={s.studentHeader} onClick={() => setExpanded(v => !v)}>
        <span style={s.expandArrow}>{expanded ? '▾' : '▸'}</span>
        <span style={s.studentName}>{student.studentLabel}</span>
        <span style={s.studentSummary}>{completedCount}/{student.tasks.length} tasks completed</span>
      </button>
      {expanded && (
        <div style={s.studentBody}>
          {student.tasks.map(task => <StudentTaskRow key={task.taskId} task={task} />)}
        </div>
      )}
    </div>
  )
}

const STAR_VALUES = [1, 2, 3, 4, 5]

function TeacherFeedbackForm({ onSave }) {
  const [rating, setRating] = useState(0)
  const [whatWorkedWell, setWhatWorkedWell] = useState('')
  const [whatDidntWork, setWhatDidntWork] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await onSave({ rating: rating > 0 ? rating : null, whatWorkedWell, whatDidntWork })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={s.feedbackBox}>
      <p style={s.feedbackFormIntro}>Optional: rate this lesson run and leave any notes for next time.</p>

      <div style={s.feedbackField}>
        <span style={s.feedbackLabel}>How did this lesson go?</span>
        <div style={s.feedbackStarsRow} role="radiogroup" aria-label="Lesson rating">
          {STAR_VALUES.map(value => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={rating === value}
              aria-label={`${value} star${value === 1 ? '' : 's'}`}
              style={s.feedbackStarBtn}
              onClick={() => setRating(current => (current === value ? 0 : value))}
            >
              {value <= rating ? '★' : '☆'}
            </button>
          ))}
        </div>
      </div>

      <label style={s.feedbackField}>
        <span style={s.feedbackLabel}>What worked well?</span>
        <textarea style={s.feedbackTextarea} rows={2} value={whatWorkedWell} onChange={e => setWhatWorkedWell(e.target.value)} />
      </label>

      <label style={s.feedbackField}>
        <span style={s.feedbackLabel}>What didn't work, or was broken?</span>
        <textarea style={s.feedbackTextarea} rows={2} value={whatDidntWork} onChange={e => setWhatDidntWork(e.target.value)} />
      </label>

      <button className="btn-primary" style={s.feedbackSaveBtn} onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save Feedback'}
      </button>
    </div>
  )
}

export default function TeacherReportModal({ report, onClose, onSaveFeedback }) {
  const overlayRef = useRef(null)
  const displayReport = useMemo(() => anonymizeSessionReport(report), [report])

  function handleExportYaml() {
    const yamlText = reportToYamlText(displayReport)
    const blob = new Blob([yamlText], { type: 'text/yaml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${displayReport.lessonId || 'lesson'}-report-${displayReport.sessionId || Date.now()}.yaml`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!displayReport) return null

  return (
    <div
      ref={overlayRef}
      style={s.overlay}
      onClick={e => { if (e.target === overlayRef.current) onClose?.() }}
      role="dialog"
      aria-modal="true"
      aria-label="Session report"
    >
      <div style={s.modal}>
        <div style={s.header}>
          <div>
            <span style={s.title}>Session Report</span>
            <div style={s.subtitle}>{displayReport.lessonTitle}</div>
          </div>
          <div style={s.headerActions}>
            <button className="btn-primary" style={s.exportBtn} onClick={handleExportYaml}>Export YAML</button>
            <button className="btn-ghost" style={s.closeBtn} onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        <div style={s.body}>
          {displayReport.teacherFeedback ? (
            <section>
              <h3 style={s.sectionTitle}>Teacher Feedback</h3>
              <div style={s.feedbackBox}>
                {displayReport.teacherFeedback.rating != null && (
                  <div style={s.feedbackStars} aria-label={`Rated ${displayReport.teacherFeedback.rating} out of 5 stars`}>
                    {STAR_VALUES.map(value => (
                      <span key={value}>{value <= displayReport.teacherFeedback.rating ? '★' : '☆'}</span>
                    ))}
                  </div>
                )}
                {displayReport.teacherFeedback.whatWorkedWell && (
                  <div style={s.feedbackField}>
                    <span style={s.feedbackLabel}>What worked well</span>
                    <p style={s.feedbackText}>{displayReport.teacherFeedback.whatWorkedWell}</p>
                  </div>
                )}
                {displayReport.teacherFeedback.whatDidntWork && (
                  <div style={s.feedbackField}>
                    <span style={s.feedbackLabel}>What didn't work, or was broken</span>
                    <p style={s.feedbackText}>{displayReport.teacherFeedback.whatDidntWork}</p>
                  </div>
                )}
              </div>
            </section>
          ) : onSaveFeedback ? (
            <section>
              <h3 style={s.sectionTitle}>Rate This Session</h3>
              <TeacherFeedbackForm onSave={onSaveFeedback} />
            </section>
          ) : null}

          <section>
            <h3 style={s.sectionTitle}>Task Summary</h3>
            <table style={s.table}>
              <thead>
                <tr>
                  {['Task', 'Completed', 'Avg Attempts', 'Avg Time', 'Common Failures'].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayReport.taskSummary.map(task => (
                  <tr key={task.taskId}>
                    <td style={s.td}>
                      <div style={s.summaryTaskTitle}>
                        <span>{task.title}</span>
                        {task.priority === 'optional' && <span style={s.priorityBadge}>optional</span>}
                      </div>
                    </td>
                    <td style={s.td}>{formatSummaryCompletion(task)}</td>
                    <td style={s.td}>{task.avgAttempts ?? '-'}</td>
                    <td style={s.td}>{formatDuration(task.avgTimeOnTaskMs)}</td>
                    <td style={s.td}>{formatSummaryFailures(task)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <h3 style={s.sectionTitle}>Students</h3>
            {displayReport.students.length === 0 ? (
              <p style={s.muted}>No students joined this session.</p>
            ) : (
              displayReport.students.map((student, index) => (
                <StudentSection key={`${student.studentLabel}-${index}`} student={student} />
              ))
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

const s = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 24,
  },
  modal: {
    background: '#fff', borderRadius: 12, width: 'min(900px, 94vw)', maxHeight: '90vh',
    display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  header: {
    background: 'var(--colour-primary)', color: '#fff', padding: '12px 16px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
  },
  title: { fontFamily: 'var(--font-title)', fontWeight: 700, fontSize: '1.05rem' },
  subtitle: { fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)' },
  headerActions: { display: 'flex', alignItems: 'center', gap: 8 },
  exportBtn: { fontSize: 13, padding: '6px 14px' },
  closeBtn: { fontSize: 13, padding: '5px 10px', color: 'rgba(255,255,255,0.8)' },
  body: { padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 },
  sectionTitle: { fontFamily: 'var(--font-title)', fontWeight: 700, fontSize: '0.95rem', margin: '0 0 10px' },
  table: { width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-body)', fontSize: '0.85rem' },
  th: {
    textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid #e5e7eb', fontWeight: 600,
    fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  td: { padding: '8px 10px', borderBottom: '1px solid #f3f4f6', verticalAlign: 'top' },
  summaryTaskTitle: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  priorityBadge: {
    display: 'inline-block',
    fontSize: '0.62rem',
    fontWeight: 700,
    color: '#0369a1',
    background: '#e0f2fe',
    border: '1px solid #7dd3fc',
    borderRadius: 4,
    padding: '1px 5px',
    lineHeight: 1.25,
  },
  muted: { fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#9ca3af' },
  feedbackBox: {
    border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 14px',
    display: 'flex', flexDirection: 'column', gap: 10, background: '#f9fafb',
  },
  feedbackStars: { fontSize: '1.1rem', color: '#f59e0b', letterSpacing: 2 },
  feedbackFormIntro: { fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: '#6b7280', margin: 0 },
  feedbackStarsRow: { display: 'flex', gap: 4 },
  feedbackStarBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', lineHeight: 1, color: '#f59e0b', padding: 0 },
  feedbackTextarea: {
    fontFamily: 'var(--font-body)', fontSize: '0.85rem', border: '1px solid #d1d5db',
    borderRadius: 8, padding: '8px 10px', resize: 'vertical', minHeight: 44,
  },
  feedbackSaveBtn: { alignSelf: 'flex-start', fontSize: 13, padding: '6px 14px' },
  feedbackField: { display: 'flex', flexDirection: 'column', gap: 4 },
  feedbackLabel: {
    fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.75rem',
    color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  feedbackText: {
    fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: 'var(--colour-text)',
    margin: 0, whiteSpace: 'pre-wrap',
  },
  studentSection: { border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 8, overflow: 'hidden' },
  studentHeader: {
    width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
    background: '#f9fafb', border: 'none', cursor: 'pointer', textAlign: 'left',
  },
  studentName: { fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.9rem', color: 'var(--colour-text)' },
  studentSummary: { fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#6b7280', marginLeft: 'auto' },
  studentBody: { padding: '8px 12px' },
  expandArrow: { fontSize: 11, color: '#9ca3af', width: 12, flexShrink: 0 },
  taskRow: { borderBottom: '1px solid #f3f4f6' },
  taskRowHeader: {
    width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 4px',
    background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
  },
  taskTitle: { fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--colour-text)' },
  attemptsCount: { fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: '#6b7280', marginLeft: 'auto' },
  overrideNote: { fontFamily: 'var(--font-body)', fontSize: '0.76rem', color: '#1d4ed8', marginLeft: 'auto' },
  badge: { display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 600, flexShrink: 0 },
  badgePass: { background: '#dcfce7', color: '#15803d' },
  badgeFail: { background: '#fee2e2', color: '#b91c1c' },
  badgeNone: { background: '#f3f4f6', color: '#6b7280' },
  badgeInfo: { background: '#dbeafe', color: '#1d4ed8' },
  attemptsList: { padding: '4px 4px 8px 20px', display: 'flex', flexDirection: 'column', gap: 8 },
  attemptItem: { display: 'flex', flexDirection: 'column', gap: 4 },
  attemptHeader: { display: 'flex', alignItems: 'center', gap: 8 },
  suggestion: { fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#6b7280' },
  submission: {
    fontFamily: 'var(--font-code)', fontSize: '0.78rem', background: '#f9fafb',
    border: '1px solid #e5e7eb', borderRadius: 6, padding: 8, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    maxHeight: 160, overflowY: 'auto',
  },
}
