import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { firestore } from './firebase'

const DEFAULT_LESSON_TIMEOUT_MS = 7000

function withTimeout(promise, timeoutMs = DEFAULT_LESSON_TIMEOUT_MS) {
  let timeoutId
  const timeout = new Promise(resolve => {
    timeoutId = setTimeout(() => resolve(null), timeoutMs)
  })
  return Promise.race([promise, timeout])
    .finally(() => clearTimeout(timeoutId))
}

async function fetchStaticLesson(lessonId) {
  const base = import.meta.env.BASE_URL || '/'
  const res = await fetch(`${base}lessons/${encodeURIComponent(lessonId)}.json`)
  if (!res.ok) return null
  const lesson = await res.json()
  return { id: lesson.id ?? lessonId, ...lesson }
}

export async function fetchLessonById(lessonId, { timeoutMs = DEFAULT_LESSON_TIMEOUT_MS } = {}) {
  if (!lessonId) return null

  try {
    const snap = await withTimeout(getDoc(doc(firestore, 'lessons', lessonId)), timeoutMs)
    if (snap?.exists()) return { id: snap.id, ...snap.data() }
  } catch {
    // Static lesson JSON is a compatibility fallback for students when Firestore
    // is temporarily unreachable or a migrated lesson has not been fetched.
  }

  try {
    return await fetchStaticLesson(lessonId)
  } catch {
    return null
  }
}

export async function fetchLessonList() {
  const snap = await getDocs(collection(firestore, 'lessons'))
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  items.sort((a, b) => (a.title ?? a.id).localeCompare(b.title ?? b.id))
  return items
}
