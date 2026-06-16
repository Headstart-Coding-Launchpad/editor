import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore'
import { firestore } from './firebase'

export async function fetchLessonById(lessonId) {
  if (!lessonId) return null
  const snap = await getDoc(doc(firestore, 'lessons', lessonId))
  if (snap.exists()) return { id: snap.id, ...snap.data() }
  return null
}

export async function fetchLessonList() {
  const snap = await getDocs(collection(firestore, 'lessons'))
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  items.sort((a, b) => (a.title ?? a.id).localeCompare(b.title ?? b.id))
  return items
}

// Permanently persists an edited task list to a published lesson (admin-only,
// enforced by Firestore rules). Only the tasks field is touched.
export async function publishLessonTasks(lessonId, tasks) {
  await setDoc(doc(firestore, 'lessons', lessonId), { tasks }, { merge: true })
}

// Returns the lesson with its tasks swapped for a live session override, if
// one is present. Used to merge a teacher's in-session task edits (broadcast
// via the Realtime DB session node) on top of the canonical Firestore lesson.
export function applyLessonOverride(lesson, overrideTasks) {
  if (!lesson || !overrideTasks) return lesson
  return { ...lesson, tasks: overrideTasks }
}
