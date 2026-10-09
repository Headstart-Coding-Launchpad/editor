// Live answer drafts: the text a student has typed into a submit-to-reveal answer (an open
// short answer, the gaps of a typed fill-in-the-gaps) but not submitted yet, so the tutor can
// see it at all times (2026-10-09 "tutors see what students are doing" principle).
//
// Data (docs/agents/runtime-model.md):
//   sessions/{lessonId}/students/{id}/currentDraft = { taskId, text, at }
//     written by the student's tab (useActivityState): after ANSWER_DRAFT_IDLE_MS of no typing
//     normally, and throttled like code (~250ms) only while this student is open in the
//     teacher's StudentModal (activeStudentView). Never per keystroke otherwise. Cleared (null)
//     on submit, when the box is emptied, and by the teacher's setTaskId on a task change.
//   sessions/{lessonId}/draftLog/{id}/{taskId} = { text, at }
//     the last draft of a student who never submitted that task, copied by the teacher's
//     setTaskId when the class moves on (draftLogUpdates), so the session report can show it
//     as `lastDraft`. Cleared by createSession and endSession.
//
// A draft is never an attempt: it is not logged, checked, counted or shown on the
// presentation window.
//
// Pure and Node-safe.
import { realAttemptEntries } from './autoCheck.js'

// Quiet period after the last keystroke before an unwatched student's draft is written.
export const ANSWER_DRAFT_IDLE_MS = 1500
// A draft longer than this is cut (the tutor's card and modal only need to read it).
export const ANSWER_DRAFT_MAX_LENGTH = 1000

// The draft text to store: '' for nothing worth showing (empty or whitespace), cut to the
// maximum length otherwise.
export function normalizeDraftText(text) {
  const value = typeof text === 'string' ? text : ''
  if (!value.trim()) return ''
  return value.length > ANSWER_DRAFT_MAX_LENGTH ? value.slice(0, ANSWER_DRAFT_MAX_LENGTH) : value
}

// The draft record written to students/{id}/currentDraft, or null to clear it.
export function buildDraftRecord(taskId, text, at = Date.now()) {
  const value = normalizeDraftText(text)
  return value && taskId != null ? { taskId, text: value, at } : null
}

// The student's unsubmitted draft for `taskId` (the class's current task), or null.
export function readAnswerDraft(student, taskId) {
  const draft = student?.currentDraft
  if (!draft || typeof draft.text !== 'string' || !draft.text.trim()) return null
  if (taskId == null || String(draft.taskId) !== String(taskId)) return null
  return draft.text
}

// A typed fill-in-the-gaps answer as one line ("print · ___ · input"), or '' when no gap has
// any text. `state` is { [blankId]: typedText }.
export function fillBlankDraftText(task, state) {
  const blanks = Array.isArray(task?.blanks) ? task.blanks : []
  const values = blanks.map((blank) => String(state?.[blank.id] ?? '').trim())
  if (!values.some(Boolean)) return ''
  return values.map((value) => value || '___').join(' · ')
}

// Whether the student has submitted (or run) this task: any attempt but an auto-check on leave.
function hasRealAttempt(session, anonymousId, taskId) {
  const entries = Object.values(session?.attemptLog?.[anonymousId]?.[taskId] ?? {}).filter(
    (entry) => entry && typeof entry === 'object'
  )
  return realAttemptEntries(entries).length > 0
}

/**
 * The teacher's setTaskId update fields that keep each student's unsubmitted draft for the
 * report: `{ 'draftLog/{id}/{taskId}': { text, at } }` for every student whose currentDraft
 * has text and who has no real attempt logged for that task. Merged into the same update that
 * clears currentDraft.
 */
export function draftLogUpdates(session) {
  const updates = {}
  for (const [anonymousId, student] of Object.entries(session?.students ?? {})) {
    const draft = student?.currentDraft
    if (!draft || draft.taskId == null) continue
    const text = normalizeDraftText(draft.text)
    if (!text || hasRealAttempt(session, anonymousId, draft.taskId)) continue
    updates[`draftLog/${anonymousId}/${draft.taskId}`] = {
      text,
      at: typeof draft.at === 'number' ? draft.at : null,
    }
  }
  return updates
}

/**
 * The last unsubmitted draft a student left on a task, for the session report: the student's
 * live currentDraft when it is for this task (the task the session ended on), otherwise the
 * draftLog copy made when the class moved on. Null when there is none.
 */
export function lastDraftFor(session, anonymousId, taskId) {
  const live = readAnswerDraft(session?.students?.[anonymousId], taskId)
  if (live) return normalizeDraftText(live)
  const logged = session?.draftLog?.[anonymousId]?.[taskId]
  const text = normalizeDraftText(logged?.text)
  return text || null
}
