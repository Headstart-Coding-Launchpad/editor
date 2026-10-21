// Tutor-only "who earned which badge" export, with names (Hub handoff 2026-10-18, for awarding
// LaunchPad badges in Pencilcase). Session reports stay anonymous ("Student N"), so this is built
// in the tutor's browser from the live session while its names still exist, and is only ever
// downloaded: never saved to Firebase, never in a report, never behind a link.
import { listAwards } from './celebration.js'
import { resolveBadge } from './badgeDisplay.js'
import { findTaskById } from '../shared/taskUtils.js'

const AWARDED_BY = { manual: 'Tutor', rule: 'Tutor (suggested)', auto: 'Automatic' }

export const NAMED_BADGE_COLUMNS = [
  'Student',
  'Badge',
  'Emoji',
  'Lesson',
  'Task',
  'Date',
  'Awarded by',
]

function localDate(ms) {
  if (!ms) return ''
  const d = new Date(ms)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * One row per badge a student still holds (revoked and dismissed left out), sorted by student
 * then date. The name is the class roster name when the tutor matched the student, else the
 * name they typed when joining.
 *
 * @param {object} args
 * @param {object} args.session  live RTDB session (`badges`, `students`)
 * @param {object} args.lesson   the lesson (title, tasks)
 * @param {object} [args.rosterNames]  { [anonymousId]: roster displayName } for matched students
 * @param {Array}  [args.catalogueBadges]  Admin-catalogue badges, for their titles
 */
export function buildNamedBadgeRows({ session, lesson, rosterNames = {}, catalogueBadges = [] }) {
  const rows = listAwards(session?.badges).map(({ studentId, badgeId, decision }) => {
    const badge = resolveBadge(badgeId, catalogueBadges, decision)
    const task = decision.taskId != null ? findTaskById(lesson?.tasks, decision.taskId) : null
    return {
      student:
        rosterNames[studentId] || session?.students?.[studentId]?.displayName || 'Unnamed student',
      badge: badge?.title ?? badgeId,
      emoji: badge?.emoji ?? '',
      lesson: lesson?.title ?? '',
      task: task?.title ?? '',
      date: localDate(decision.decidedAt),
      awardedBy: AWARDED_BY[decision.source] ?? '',
      at: decision.decidedAt ?? 0,
    }
  })
  return rows.sort(
    (a, b) => a.student.localeCompare(b.student, undefined, { sensitivity: 'base' }) || a.at - b.at
  )
}

// Quotes a cell when needed, and stops a typed name like "=SUM(...)" running as a spreadsheet
// formula when the file is opened.
function csvCell(value) {
  let text = String(value ?? '')
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function namedBadgeCsv(rows) {
  const lines = [
    NAMED_BADGE_COLUMNS,
    ...rows.map((r) => [r.student, r.badge, r.emoji, r.lesson, r.task, r.date, r.awardedBy]),
  ]
  // A BOM so Excel opens the emoji and accented names as UTF-8.
  return `\uFEFF${lines.map((cells) => cells.map(csvCell).join(',')).join('\r\n')}\r\n`
}

export function namedBadgeFilename(lesson, at = Date.now()) {
  const slug = String(lesson?.title || lesson?.id || 'lesson')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `badges-with-names-${slug || 'lesson'}-${localDate(at)}.csv`
}

export function downloadNamedBadgeCsv(rows, lesson) {
  const blob = new Blob([namedBadgeCsv(rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = namedBadgeFilename(lesson)
  a.click()
  URL.revokeObjectURL(url)
}
