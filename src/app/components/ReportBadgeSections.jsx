import React, { useMemo, useState } from 'react'
import { classWallText, reportClassWall } from '../../badges/badgeSummary'
import { ClassWall } from './badges/BadgeSummaryTask'
import CopyClassSummaryButton from './badges/CopyClassSummaryButton'
import { formatReportDuration, teacherSandboxCallout } from '../reportBadgeFormat'

// The session report's live-badge sections (docs/architecture/live-badges-plan.md, "Session
// report"): Coding moments, quiz groups, the teacher-sandbox callout and a student's badge
// details. The formatters for the new table columns are in ../reportBadgeFormat.js. The report
// is already anonymised (studentLabel only), so every name here is a "Student n" label.

function sandboxActivityText(activity) {
  if (!activity) return null
  const runs = `${activity.runs} run${activity.runs === 1 ? '' : 's'}`
  const errors = `${activity.errorRuns} with errors`
  const fixes = `${activity.fixes} fix${activity.fixes === 1 ? '' : 'es'}`
  return `${formatReportDuration(activity.timeMs)} · ${runs}, ${errors}, ${fixes}`
}

/** A student's badge-related extras, shown at the top of their section. */
export function StudentBadgeDetails({ student }) {
  const rows = []
  if (student.badges?.length > 0) {
    rows.push([
      'Coding moments',
      student.badges
        .map((b) => `${b.emoji} ${b.title}${b.reason ? ` (${b.reason})` : ''}`)
        .join('; '),
    ])
  }
  if (student.topicsOpened?.length > 0) {
    rows.push([
      'Topics opened',
      student.topicsOpened
        .map((t) => `${t.title ?? t.topicId}${t.source === 'teacher' ? ' (sent by tutor)' : ''}`)
        .join(', '),
    ])
  }
  if (student.shortcutsUsed?.length > 0) {
    rows.push(['Shortcuts', student.shortcutsUsed.map((s) => s.label).join(', ')])
  }
  if (student.personalSandbox) {
    rows.push(['Personal sandbox', sandboxActivityText(student.personalSandbox)])
  }
  if (student.teacherSandbox) {
    rows.push(['Teacher sandbox', sandboxActivityText(student.teacherSandbox)])
  }
  if (rows.length === 0) return null
  return (
    <dl style={s.details}>
      {rows.map(([label, value]) => (
        <div key={label} style={s.detailRow}>
          <dt style={s.detailLabel}>{label}</dt>
          <dd style={s.detailValue}>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

const SUMMARY_COLUMNS = [
  ['suggested', 'Suggested'],
  ['awarded', 'Awarded'],
  ['autoAwarded', 'Auto'],
  ['manual', 'Manual'],
  ['dismissed', 'Dismissed'],
  ['revoked', 'Revoked'],
]

/** Coding moments: the class wall, Copy class summary and the per-badge decision counts. */
export function CodingMomentsSection({ report }) {
  const wall = useMemo(() => reportClassWall(report), [report])
  const summary = Object.entries(report?.badgeSummary ?? {})
  if (wall.length === 0 && summary.length === 0) return null
  const title = report?.lessonTitle ? `Coding moments: ${report.lessonTitle}` : 'Coding moments'
  return (
    <section>
      <div style={s.sectionHeader}>
        <h3 style={s.sectionTitle}>Coding moments</h3>
        {wall.length > 0 && (
          <CopyClassSummaryButton text={classWallText(wall, { title })} style={s.smallBtn} />
        )}
      </div>
      <ClassWall wall={wall} emptyText="No badges were awarded this session." />
      {summary.length > 0 && (
        <div style={s.scroll}>
          <table style={{ ...s.table, marginTop: 10 }}>
            <thead>
              <tr>
                <th style={s.th}>Badge</th>
                {SUMMARY_COLUMNS.map(([, label]) => (
                  <th key={label} style={s.th}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.map(([badgeId, counts]) => {
                const row = wall.find((r) => r.badgeId === badgeId)
                return (
                  <tr key={badgeId}>
                    <td style={s.td}>{row ? `${row.badge.emoji} ${row.badge.title}` : badgeId}</td>
                    {SUMMARY_COLUMNS.map(([key]) => (
                      <td key={key} style={s.td}>
                        {counts[key] ?? 0}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {report?.shortcutSummary && (
        <p style={s.note}>
          Shortcuts:{' '}
          {Object.entries(report.shortcutSummary)
            .map(([id, n]) => `${id} (${n} student${n === 1 ? '' : 's'})`)
            .join(', ')}
        </p>
      )}
    </section>
  )
}

/** Each quiz group: every student's first-try score and the class median. */
export function QuizGroupsSection({ report }) {
  const groups = report?.quizGroups ?? []
  if (groups.length === 0) return null
  return (
    <section>
      <h3 style={s.sectionTitle}>Quiz groups: right first time</h3>
      {groups.map((group) => (
        <div key={group.groupId} style={s.groupBox}>
          <div style={s.groupTitle}>
            {group.title}
            <span style={s.muted}>
              {' '}
              · class median{' '}
              {group.medianFirstTryPercent != null ? `${group.medianFirstTryPercent}%` : '—'}
            </span>
          </div>
          <div style={s.note}>
            {group.students.length === 0
              ? 'Nobody attempted these quizzes.'
              : group.students
                  .map(
                    (st) => `${st.studentLabel}: ${st.right}/${st.total} (${st.firstTryPercent}%)`
                  )
                  .join(' · ')}
          </div>
        </div>
      ))}
    </section>
  )
}

function renderWork(entry) {
  if (entry?.code != null) return entry.code
  if (entry?.files) {
    return Object.entries(entry.files)
      .map(([name, content]) => `── ${name} ──\n${content}`)
      .join('\n\n')
  }
  if (entry?.explainer != null) return entry.explainer
  return '(nothing)'
}

function SandboxVisit({ visit }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div style={s.callout}>
      <button style={s.calloutHeader} onClick={() => setExpanded((v) => !v)}>
        <span style={s.expandArrow}>{expanded ? '▾' : '▸'}</span>
        <span>🧭 {teacherSandboxCallout(visit)}. A possible lesson gap?</span>
      </button>
      {expanded && (
        <div style={s.calloutBody}>
          {visit.explainer && (
            <>
              <div style={s.detailLabel}>Explainer</div>
              <pre style={s.code}>{visit.explainer}</pre>
            </>
          )}
          {visit.pushes?.length > 0 && (
            <>
              <div style={s.detailLabel}>What the tutor pushed ({visit.pushes.length})</div>
              {visit.pushes.map((push, i) => (
                <pre key={i} style={s.code}>
                  {renderWork(push)}
                </pre>
              ))}
            </>
          )}
          {visit.studentSnapshots?.length > 0 && (
            <>
              <div style={s.detailLabel}>Each student&apos;s last sandbox code</div>
              {visit.studentSnapshots.map((snapshot, i) => (
                <div key={`${snapshot.studentLabel}-${i}`}>
                  <div style={s.snapshotLabel}>{snapshot.studentLabel}</div>
                  <pre style={s.code}>{renderWork(snapshot)}</pre>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** The teacher sandbox, one callout per visit, with the size note when code was left out. */
export function TeacherSandboxSection({ report }) {
  const visits = report?.teacherSandbox?.visits ?? []
  if (visits.length === 0 && !report?.sizeNote) return null
  return (
    <section>
      <h3 style={s.sectionTitle}>Teacher sandbox</h3>
      {visits.map((visit) => (
        <SandboxVisit key={visit.visitId} visit={visit} />
      ))}
      {report?.sizeNote && <p style={s.note}>{report.sizeNote}</p>}
    </section>
  )
}

const s = {
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.95rem',
    margin: '0 0 10px',
  },
  smallBtn: { fontSize: 12, padding: '4px 10px' },
  scroll: { overflowX: 'auto' },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontFamily: 'var(--font-body)',
    fontSize: '0.85rem',
  },
  th: {
    textAlign: 'left',
    padding: '6px 10px',
    borderBottom: '2px solid var(--ui-border-neutral)',
    fontWeight: 600,
    fontSize: '0.72rem',
    color: 'var(--colour-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  td: {
    padding: '6px 10px',
    borderBottom: '1px solid var(--ui-surface-neutral-sunk)',
    verticalAlign: 'top',
  },
  note: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    color: 'var(--colour-muted)',
    margin: '8px 0 0',
  },
  muted: { color: 'var(--colour-muted)', fontWeight: 400 },
  groupBox: {
    border: '1px solid var(--ui-border-neutral)',
    borderRadius: 8,
    padding: '8px 12px',
    marginBottom: 8,
  },
  groupTitle: { fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.88rem' },
  details: { margin: '0 0 8px', display: 'flex', flexDirection: 'column', gap: 4 },
  detailRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  detailLabel: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.75rem',
    color: 'var(--colour-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    minWidth: 130,
  },
  detailValue: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    color: 'var(--colour-text)',
    margin: 0,
  },
  callout: {
    border: '1px solid var(--colour-warning-edge)',
    background: 'var(--colour-warning-bg)',
    borderRadius: 8,
    marginBottom: 8,
    overflow: 'hidden',
  },
  calloutHeader: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 12px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'var(--font-body)',
    fontSize: '0.88rem',
    color: 'var(--colour-warning-text)',
  },
  calloutBody: {
    padding: '4px 12px 12px 32px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    background: 'var(--ui-surface)',
  },
  expandArrow: { fontSize: 11, width: 12, flexShrink: 0 },
  snapshotLabel: { fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.8rem' },
  code: {
    fontFamily: 'var(--font-code)',
    fontSize: '0.78rem',
    background: 'var(--ui-surface-neutral)',
    border: '1px solid var(--ui-border-neutral)',
    borderRadius: 6,
    padding: 8,
    margin: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    maxHeight: 200,
    overflowY: 'auto',
  },
}
