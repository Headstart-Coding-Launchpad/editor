// Formatting for the session report's live-badge columns (TeacherReportModal and
// ReportBadgeSections). Pure.

export function formatReportDuration(ms) {
  if (ms == null) return '—'
  const totalSeconds = Math.round(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes === 0 ? `${seconds}s` : `${minutes}m ${seconds}s`
}

function formatMinutes(ms) {
  if (ms == null) return 'some time'
  const minutes = Math.round(ms / 60000)
  if (minutes < 1) return 'under a minute'
  return `${minutes} min`
}

/** Task summary: "6s median (2s–40s, 12 students)". */
export function formatTimeToFirstEdit(task) {
  const edit = task.timeToFirstEdit
  if (!edit) return '-'
  const range =
    edit.minMs === edit.maxMs
      ? ''
      : ` (${formatReportDuration(edit.minMs)}–${formatReportDuration(edit.maxMs)})`
  return `${formatReportDuration(edit.medianMs)} median${range}`
}

/** Task summary: "3 students". */
export function formatErrorStudents(task) {
  const n = task.errorStudentCount ?? 0
  return n > 0 ? `${n} student${n === 1 ? '' : 's'}` : '-'
}

/** Task summary: "4 student, 1 tutor-sent". */
export function formatTopicOpens(task) {
  const opens = task.topicOpens
  if (!opens) return '-'
  const parts = []
  if (opens.student > 0) parts.push(`${opens.student} student`)
  if (opens.teacher > 0) parts.push(`${opens.teacher} tutor-sent`)
  return parts.join(', ') || '-'
}

/** Task summary: "Student 3 · 2m 10s in". */
export function formatFirstRealPass(task) {
  const first = task.firstRealPass
  if (!first) return '-'
  return first.afterMs != null
    ? `${first.studentLabel} · ${formatReportDuration(first.afterMs)} in`
    : first.studentLabel
}

/** A student's per-task badge signals, for their task row: ["✏️ first edit 6s", …]. */
export function studentTaskSignalLabels(task) {
  const labels = []
  if (task.timeToFirstEditMs != null) {
    labels.push(`✏️ first edit ${formatReportDuration(task.timeToFirstEditMs)}`)
  }
  if (task.errorAttempts > 0) {
    labels.push(`⚠️ ${task.errorAttempts} error run${task.errorAttempts === 1 ? '' : 's'}`)
  }
  if (task.uniqueFailedAttempts > 0) {
    const n = task.uniqueFailedAttempts
    labels.push(`${n} different failed tr${n === 1 ? 'y' : 'ies'}`)
  }
  if (task.firstPassInClass) labels.push('⭐ first real pass in class')
  return labels
}

/** "The class spent 14 min in the teacher sandbox after Task 7". */
export function teacherSandboxCallout(visit) {
  const after = visit.previousTaskTitle
    ? ` after “${visit.previousTaskTitle}”`
    : visit.previousTaskId != null
      ? ` after Task ${visit.previousTaskId}`
      : ''
  return `The class spent ${formatMinutes(visit.durationMs)} in the teacher sandbox${after}`
}
