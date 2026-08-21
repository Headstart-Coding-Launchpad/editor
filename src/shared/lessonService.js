import {
  collection, deleteDoc, doc, getDoc, getDocs, orderBy, query,
  setDoc, writeBatch,
} from 'firebase/firestore'
import { firestore } from './firebase'
import { encodeLessonBlocksForFirestore, decodeLessonBlocksFromFirestore } from './lessonBlocksCodec'
import { buildLessonFork, CLASS_COLLECTION, makeClassRecord } from './lessonForks'
import { LEVEL_COLLECTION, migrateLessonLevel } from './lessonLevels'

export async function fetchLessonById(lessonId) {
  if (!lessonId) return null
  const snap = await getDoc(doc(firestore, 'lessons', lessonId))
  if (snap.exists()) return decodeLessonBlocksFromFirestore({ id: snap.id, ...snap.data() })
  return null
}

export async function fetchLessonList() {
  const snap = await getDocs(collection(firestore, 'lessons'))
  const items = snap.docs.map(d => decodeLessonBlocksFromFirestore({ id: d.id, ...d.data() }))
  items.sort((a, b) => (a.title ?? a.id).localeCompare(b.title ?? b.id))
  return items
}

// Publishes a full lesson document. Callers should validate the lesson before
// invoking this helper so all direct lesson writes share encoding behaviour.
export async function publishLesson(lesson) {
  if (!lesson?.id) throw new Error('Lesson id is required')
  const migrated = migrateLessonLevel(lesson)
  if (migrated.level) {
    await setDoc(doc(firestore, LEVEL_COLLECTION, migrated.level.id), migrated.level, { merge: true })
  }
  await setDoc(doc(firestore, 'lessons', migrated.lesson.id), encodeLessonBlocksForFirestore(migrated.lesson))
}

// Permanently persists an edited task list to a published lesson (admin-only,
// enforced by Firestore rules). Only the tasks field is touched.
export async function publishLessonTasks(lessonId, tasks) {
  const { tasks: encodedTasks } = encodeLessonBlocksForFirestore({ tasks })
  await setDoc(doc(firestore, 'lessons', lessonId), { tasks: encodedTasks }, { merge: true })
}

// Deletes a published lesson document. Firestore does not cascade-delete
// subcollections, so this also purges the lesson's sessionReports/feedback
// subcollections first — otherwise a deleted lesson silently leaves orphaned
// run data behind despite the admin UI describing the delete as unrecoverable.
export async function deletePublishedLesson(lessonId) {
  if (!lessonId) throw new Error('Lesson id is required')
  await clearLessonRunData(lessonId)
  await deleteDoc(doc(firestore, 'lessons', lessonId))
}

export async function fetchClassList() {
  const snap = await getDocs(collection(firestore, CLASS_COLLECTION))
  return snap.docs
    .map(d => makeClassRecord({ id: d.id, ...d.data() }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function saveClassRecord(input) {
  const record = makeClassRecord(input)
  await setDoc(doc(firestore, CLASS_COLLECTION, record.id), record, { merge: true })
  return record
}

const FIRESTORE_BATCH_LIMIT = 500

async function clearLessonChildCollection(lessonId, collectionName) {
  const snap = await getDocs(collection(firestore, 'lessons', lessonId, collectionName))
  const docs = snap.docs
  for (let i = 0; i < docs.length; i += FIRESTORE_BATCH_LIMIT) {
    const batch = writeBatch(firestore)
    for (const item of docs.slice(i, i + FIRESTORE_BATCH_LIMIT)) batch.delete(item.ref)
    await batch.commit()
  }
  return snap.size
}

export async function clearLessonRunData(lessonId) {
  const [reportsDeleted, feedbackDeleted] = await Promise.all([
    clearLessonChildCollection(lessonId, 'sessionReports'),
    clearLessonChildCollection(lessonId, 'feedback'),
  ])
  return { reportsDeleted, feedbackDeleted }
}

export async function publishLessonFork(sourceLesson, classRecord) {
  const fork = buildLessonFork(sourceLesson, classRecord)
  await publishLesson(fork)
  const cleared = await clearLessonRunData(fork.id)
  return { fork, cleared }
}

// Returns the lesson with its tasks swapped for a live session override, if
// one is present. Used to merge a teacher's in-session task edits (broadcast
// via the Realtime DB session node) on top of the canonical Firestore lesson.
export function applyLessonOverride(lesson, overrideTasks) {
  if (!lesson || !overrideTasks) return lesson
  return { ...lesson, tasks: overrideTasks }
}

// ── Session Reports ───────────────────────────────────────────────────────────
// Fetches/writes the per-session-run report stored under lessons/{lessonId}/sessionReports.
// One doc per session run, doc ID = the report's sessionId (session.startedAt).

export async function saveSessionReport(lessonId, sessionId, report) {
  await setDoc(doc(firestore, 'lessons', lessonId, 'sessionReports', sessionId), report)
}

export async function fetchSessionReports(lessonId) {
  const q = query(
    collection(firestore, 'lessons', lessonId, 'sessionReports'),
    orderBy('startedAt', 'desc'),
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}
