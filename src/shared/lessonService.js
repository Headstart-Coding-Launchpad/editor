import {
  collection, doc, getDoc, getDocs, orderBy, query,
  serverTimestamp, setDoc, updateDoc,
} from 'firebase/firestore'
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

// ── Lesson Drafts ─────────────────────────────────────────────────────────────
// Drafts are Markdown planning documents (Ideas / Details) stored in
// `lessonDrafts/{id}`. They are admin-only and never exposed to students.

export async function fetchDraftList() {
  const q = query(collection(firestore, 'lessonDrafts'), orderBy('updatedAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function fetchLessonDraftById(id) {
  const snap = await getDoc(doc(firestore, 'lessonDrafts', id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}

export async function upsertDraft(draft) {
  const { id, ...fields } = draft
  if (!id) throw new Error('Draft id is required')
  const ref = doc(firestore, 'lessonDrafts', id)
  const existing = await getDoc(ref)
  const base = existing.exists() ? existing.data() : {}
  await setDoc(ref, {
    ...base,
    ...fields,
    id,
    updatedAt: serverTimestamp(),
    _meta: {
      ...(base._meta ?? {}),
      ...(fields._meta ?? {}),
      createdAt: base._meta?.createdAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
  })
}

export async function updateDraftStage(id, stage, reviewerEmail) {
  const update = { stage, updatedAt: serverTimestamp() }
  if (reviewerEmail) {
    update['_meta.reviewedBy'] = reviewerEmail
    update['_meta.reviewedAt'] = serverTimestamp()
  }
  await updateDoc(doc(firestore, 'lessonDrafts', id), update)
}

export async function addDraftReviewNote(id, note) {
  const snap = await getDoc(doc(firestore, 'lessonDrafts', id))
  if (!snap.exists()) throw new Error(`Draft '${id}' not found`)
  const existing = snap.data().reviewNotes ?? []
  const filtered = existing.filter(n => n.sectionId !== note.sectionId)
  await updateDoc(doc(firestore, 'lessonDrafts', id), {
    reviewNotes: [...filtered, { ...note, createdAt: Date.now() }],
    updatedAt: serverTimestamp(),
  })
}

export async function updateDraftReviewNote(id, sectionId, fields) {
  const snap = await getDoc(doc(firestore, 'lessonDrafts', id))
  if (!snap.exists()) throw new Error(`Draft '${id}' not found`)
  const notes = snap.data().reviewNotes ?? []
  const updated = notes.map(n => n.sectionId === sectionId ? { ...n, ...fields } : n)
  await updateDoc(doc(firestore, 'lessonDrafts', id), {
    reviewNotes: updated,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteDraftReviewNote(id, sectionId) {
  const snap = await getDoc(doc(firestore, 'lessonDrafts', id))
  if (!snap.exists()) throw new Error(`Draft '${id}' not found`)
  const notes = (snap.data().reviewNotes ?? []).filter(n => n.sectionId !== sectionId)
  await updateDoc(doc(firestore, 'lessonDrafts', id), {
    reviewNotes: notes,
    updatedAt: serverTimestamp(),
  })
}
