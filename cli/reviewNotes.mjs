import { db } from './firebase.mjs'

// Preview review notes (platform request #127): one-line notes an admin leaves on a task while
// previewing a lesson, at lessons/{lessonId}/reviewNotes/{noteId}. Agents read them with
// `lessons notes <id>` and move them on with `--set <noteId> --status picked_up|done`. Only this
// CLI (Admin SDK) changes a status; the rules refuse it from the web app.
// See docs/authoring/feedback-cli.md.

export const REVIEW_NOTE_STATUSES = ['new', 'picked_up', 'done']
const SETTABLE = ['picked_up', 'done']

function toIso(value) {
  if (value == null) return null
  if (typeof value.toDate === 'function') return value.toDate().toISOString()
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'number') return new Date(value).toISOString()
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000).toISOString()
  return null
}

function noteFromDoc(id, d) {
  return {
    noteId: id,
    lessonId: d.lessonId ?? null,
    taskId: d.taskId ?? null,
    lessonVersion: d.lessonVersion ?? null,
    text: d.text ?? '',
    tag: d.tag ?? null,
    status: d.status ?? 'new',
    createdAt: toIso(d.createdAt),
    statusChangedAt: toIso(d.statusChangedAt),
    createdBy: d.createdBy ?? null,
  }
}

function parseSince(since) {
  if (since == null || since === '') return null
  const ms = Date.parse(since)
  if (!Number.isFinite(ms)) throw new Error(`--since must be an ISO date, got '${since}'`)
  return ms
}

/** Docs ({ id, ...data }) → notes, filtered by --since / --status, oldest first. */
export function summariseReviewNotes(docs, { since = null, status = null } = {}) {
  if (status != null && !REVIEW_NOTE_STATUSES.includes(status))
    throw new Error(`--status must be one of ${REVIEW_NOTE_STATUSES.join(', ')}`)
  const sinceMs = parseSince(since)
  return docs
    .map(({ id, ...d }) => noteFromDoc(id, d))
    .filter((n) => (status ? n.status === status : true))
    .filter((n) => (sinceMs == null ? true : n.createdAt && Date.parse(n.createdAt) >= sinceMs))
    .sort((a, b) => String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')))
}

/** Statuses only move forward: new → picked_up → done (new → done is allowed). */
export function checkStatusMove(from, to) {
  if (!SETTABLE.includes(to)) throw new Error(`--status must be picked_up or done, got '${to}'`)
  const rank = (s) => REVIEW_NOTE_STATUSES.indexOf(s)
  if (rank(to) < rank(from ?? 'new')) throw new Error(`A note cannot go back from ${from} to ${to}`)
  return rank(to) > rank(from ?? 'new')
}

function notesCollection(lessonId) {
  if (!lessonId) throw new Error('lessonId is required')
  return db.collection('lessons').doc(lessonId).collection('reviewNotes')
}

export async function listReviewNotes(lessonId, { since = null, status = null } = {}) {
  const snap = await notesCollection(lessonId).get()
  return summariseReviewNotes(
    snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    { since, status }
  )
}

/** Moves one note on and returns it. Setting the status it already has changes nothing. */
export async function setReviewNoteStatus(lessonId, noteId, status) {
  if (!noteId) throw new Error('--set needs a note id')
  const ref = notesCollection(lessonId).doc(noteId)
  const snap = await ref.get()
  if (!snap.exists) throw new Error(`No review note '${noteId}' on lesson '${lessonId}'`)
  const data = snap.data()
  if (!checkStatusMove(data.status, status)) return noteFromDoc(noteId, data)
  const statusChangedAt = new Date()
  await ref.update({ status, statusChangedAt })
  return noteFromDoc(noteId, { ...data, status, statusChangedAt })
}
