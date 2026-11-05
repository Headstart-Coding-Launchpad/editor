import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { firestore } from '../../shared/firebase'
import { equivalentTaskIds } from '../../shared/taskUtils'
import { normaliseReviewNote } from './reviewNotes'

// Preview review notes: lessons/{lessonId}/reviewNotes/{noteId}. Admins write and read them
// (firestore.rules); the status moves on only from the CLI (Admin SDK). See
// docs/authoring/feedback-cli.md.

function notesCollection(lessonId) {
  return collection(firestore, 'lessons', lessonId, 'reviewNotes')
}

// A safety cap per task: far above any real review, so a runaway writer cannot flood the box.
export const REVIEW_NOTES_PER_TASK_LIMIT = 200

// One task's notes (its id as a number or text, like the feedback queries). Filtered on taskId
// only, with no orderBy: an `in` filter plus an orderBy on createdAt would need a composite
// index, so callers sort (notesForTask oldest first, the Builder newest first).
function taskNotesQuery(lessonId, taskId) {
  return query(
    notesCollection(lessonId),
    where('taskId', 'in', equivalentTaskIds(taskId)),
    limit(REVIEW_NOTES_PER_TASK_LIMIT)
  )
}

/** Live list of one task's notes; returns the unsubscribe function. */
export function subscribeReviewNotes(lessonId, taskId, onNotes, onError) {
  return onSnapshot(
    taskNotesQuery(lessonId, taskId),
    (snap) => onNotes(snap.docs.map((d) => normaliseReviewNote({ id: d.id, ...d.data() }))),
    (err) => onError?.(err)
  )
}

/** One write per Save. `createdAt` and `statusChangedAt` are both the server time. */
export async function addReviewNote(lessonId, { taskId, lessonVersion, text, tag, createdBy }) {
  const ref = await addDoc(notesCollection(lessonId), {
    lessonId,
    taskId,
    lessonVersion,
    text,
    tag: tag ?? null,
    status: 'new',
    createdAt: serverTimestamp(),
    statusChangedAt: serverTimestamp(),
    createdBy,
  })
  return ref.id
}

/** Only text and tag change, and the rules allow it only while the note is New. */
export function updateReviewNote(lessonId, noteId, { text, tag }) {
  return updateDoc(doc(firestore, 'lessons', lessonId, 'reviewNotes', noteId), {
    text,
    tag: tag ?? null,
  })
}

export function deleteReviewNote(lessonId, noteId) {
  return deleteDoc(doc(firestore, 'lessons', lessonId, 'reviewNotes', noteId))
}

/** The Builder's read-only list for one task, newest first. */
export async function listTaskReviewNotes(lessonId, taskId) {
  const snap = await getDocs(taskNotesQuery(lessonId, taskId))
  return snap.docs
    .map((d) => normaliseReviewNote({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
}
