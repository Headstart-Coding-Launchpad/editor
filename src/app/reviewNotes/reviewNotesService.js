import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
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

/** Live list of every note on the lesson; returns the unsubscribe function. */
export function subscribeReviewNotes(lessonId, onNotes, onError) {
  return onSnapshot(
    notesCollection(lessonId),
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
  const snap = await getDocs(
    query(notesCollection(lessonId), where('taskId', 'in', equivalentTaskIds(taskId)))
  )
  return snap.docs
    .map((d) => normaliseReviewNote({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
}
