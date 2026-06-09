import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
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
