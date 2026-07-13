import React, { useRef, useState } from 'react'
import { reportToYamlText } from '../../shared/lessonReport'

function renderSubmission(submission) {
  if (submission == null) return '(none)'
  if (typeof submission === 'string') return submission
  try { return JSON.stringify(submission, null, 2) } catch { return String(submission) }
}

function StudentTaskRow({ task }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div style={s.taskRow}>
      <button style={s.taskRowHeader} onClick={() => setExpanded(v => !v)}>
        <span style={{ ...s.badge, ...(task.completed ? s.badgePass : task.finalResult === 'failed' ? s.badgeFail : s.badgeNone) }}>
          {task.finalResult === 'not attempted' ? 'Not attempted' : task.completed ? 'Passed' : 'Failed'}
        </span>
        <span style={s.taskTitle}>{task.title}</span>
        {task.attempts > 0 && <span style={s.attemptsCount}>{task.attempts} attempt{task.attempts === 1 ? '' : 's'}</span>}
        {task.distinctAttempts.length > 0 && <span style={s.expandArrow}>{expanded ? '▾' : '▸'}</span>}
      </button>
      {expanded && task.distinctAttempts.length > 0 && (
        <div style={s.attemptsList}>
          {task.distinctAttempts.map((a, i) => (
            <div key={i} style={s.attemptItem}>
              <div style={s.attemptHeader}>
                <span style={{ ...s.badge, ...(a.passed ? s.badgePass : s.badgeFail) }}>
                  Attempt {a.attemptNumber}{a.retries > 0 ? ` (retried ${a.retries}×)` : ''}
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
        <span style={s.studentName}>{student.displayName}</span>
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

export default function TeacherReportModal({ report, onClose }) {
  const overlayRef = useRef(null)

  function handleExportYaml() {
    const yamlText = reportToYamlText(report)
    const blob = new Blob([yamlText], { type: 'text/yaml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${report.lessonId || 'lesson'}-report-${report.sessionId || Date.now()}.yaml`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!report) return null

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
            <div style={s.subtitle}>{report.lessonTitle}</div>
          </div>
          <div style={s.headerActions}>
            <button className="btn-primary" style={s.exportBtn} onClick={handleExportYaml}>Export YAML</button>
            <button className="btn-ghost" style={s.closeBtn} onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        <div style={s.body}>
          <section>
            <h3 style={s.sectionTitle}>Task Summary</h3>
            <table style={s.table}>
              <thead>
                <tr>
                  {['Task', 'Completed', 'Avg Attempts', 'Common Failures'].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.taskSummary.map(task => (
                  <tr key={task.taskId}>
                    <td style={s.td}>{task.title}</td>
                    <td style={s.td}>{task.completedCount}/{task.totalStudents} ({Math.round(task.completionRate * 100)}%)</td>
                    <td style={s.td}>{task.avgAttempts}</td>
                    <td style={s.td}>
                      {task.commonFailures.length === 0 ? '—' : task.commonFailures.map(f => `${f.suggestion} (${f.count})`).join('; ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <h3 style={s.sectionTitle}>Students</h3>
            {report.students.length === 0 ? (
              <p style={s.muted}>No students joined this session.</p>
            ) : (
              report.students.map(student => <StudentSection key={student.anonymousId} student={student} />)
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
  muted: { fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: '#9ca3af' },
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
  badge: { display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 600, flexShrink: 0 },
  badgePass: { background: '#dcfce7', color: '#15803d' },
  badgeFail: { background: '#fee2e2', color: '#b91c1c' },
  badgeNone: { background: '#f3f4f6', color: '#6b7280' },
  attemptsList: { padding: '4px 4px 8px 20px', display: 'flex', flexDirection: 'column', gap: 8 },
  attemptItem: { display: 'flex', flexDirection: 'column', gap: 4 },
  attemptHeader: { display: 'flex', alignItems: 'center', gap: 8 },
  suggestion: { fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#6b7280' },
  submission: {
    fontFamily: 'var(--font-mono, monospace)', fontSize: '0.78rem', background: '#f9fafb',
    border: '1px solid #e5e7eb', borderRadius: 6, padding: 8, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    maxHeight: 160, overflowY: 'auto',
  },
}
