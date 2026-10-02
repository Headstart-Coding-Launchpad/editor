// Shown short answers: on an open (unchecked) short_answer task authored with
// `showResponses: teacher_picks`, the teacher picks students' answers to show on the
// presentation window (useSession.showResponse), anonymised unless the task sets
// `anonymiseResponses: false` or the teacher turns a name on for one answer. Graded quizzes
// never broadcast a student's answer. Every answer shown goes into the session report.
//
// RTDB shape (docs/agents/runtime-model.md):
//   sessions/{lessonId}/shownResponses/{responseId}: { taskId, anonymousId, text, showName,
//                                                     shownAt, hiddenAt }
// One entry per student per task: hiding sets `hiddenAt` (kept for the report), showing again
// clears it. The text is a copy taken when the teacher showed it.
//
// Pure and Node-safe: used by useSession, the teacher and presentation UI and lessonReport.js.
import { getTaskActivity } from '../activities/registry.pure.js'

export const SHOWN_RESPONSE_MAX_LENGTH = 1000

function finiteOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

// True when the teacher may show this task's answers on the presentation window (the activity
// decides: open short answers with `showResponses: teacher_picks`).
export function canShowResponses(task) {
  return !!getTaskActivity(task)?.showsResponses(task)
}

// Names are hidden by default; `anonymiseResponses: false` shows them unless turned off.
export function defaultShowName(task) {
  return task?.anonymiseResponses === false
}

// The answer text as stored: trimmed and capped.
export function normalizeShownText(text) {
  return String(text ?? '')
    .trim()
    .slice(0, SHOWN_RESPONSE_MAX_LENGTH)
}

function entries(session) {
  const raw = session?.shownResponses
  if (!raw || typeof raw !== 'object') return []
  return Object.entries(raw)
    .filter(([, entry]) => entry && typeof entry === 'object' && entry.taskId && entry.anonymousId)
    .map(([responseId, entry]) => ({ responseId, ...entry }))
}

// The entry for one student's answer on one task (shown or hidden), or null.
export function findShownResponse(session, taskId, anonymousId) {
  if (taskId == null || taskId === '' || !anonymousId) return null
  return (
    entries(session).find(
      (entry) => String(entry.taskId) === String(taskId) && entry.anonymousId === anonymousId
    ) ?? null
  )
}

// Answers on screen for a task, in the order they were shown, each with the student's name
// only when `showName` is on.
export function getShownResponses(session, taskId) {
  if (taskId == null || taskId === '') return []
  return entries(session)
    .filter(
      (entry) => String(entry.taskId) === String(taskId) && finiteOrNull(entry.hiddenAt) == null
    )
    .sort((a, b) => (finiteOrNull(a.shownAt) ?? 0) - (finiteOrNull(b.shownAt) ?? 0))
    .map((entry) => ({
      responseId: entry.responseId,
      anonymousId: entry.anonymousId,
      text: String(entry.text ?? ''),
      showName: entry.showName === true,
      name:
        entry.showName === true
          ? String(session?.students?.[entry.anonymousId]?.displayName ?? '').trim() || null
          : null,
    }))
}

/**
 * Per task, the answers the teacher showed (session report `shownResponses` on the task
 * summary, docs/authoring/session-reports.md). `labelFor(anonymousId)` gives the report's
 * anonymous "Student N" label. Returns `{ [taskId]: [...] }`.
 */
export function buildShownResponsesByTask(session, labelFor) {
  const byTask = {}
  const sorted = entries(session).sort(
    (a, b) => (finiteOrNull(a.shownAt) ?? 0) - (finiteOrNull(b.shownAt) ?? 0)
  )
  for (const entry of sorted) {
    ;(byTask[entry.taskId] ??= []).push({
      studentLabel: labelFor(entry.anonymousId),
      text: String(entry.text ?? ''),
      showName: entry.showName === true,
      shownAt: finiteOrNull(entry.shownAt),
      hiddenAt: finiteOrNull(entry.hiddenAt),
    })
  }
  return byTask
}
