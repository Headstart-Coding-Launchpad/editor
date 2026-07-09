import {
  collection, deleteDoc, doc, getDoc, getDocs, orderBy, query,
  serverTimestamp, setDoc, updateDoc,
} from 'firebase/firestore'
import { firestore } from './firebase'
import { encodeLessonBlocksForFirestore, decodeLessonBlocksFromFirestore } from './lessonBlocksCodec'

function makeEntryId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

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

// Permanently persists an edited task list to a published lesson (admin-only,
// enforced by Firestore rules). Only the tasks field is touched.
export async function publishLessonTasks(lessonId, tasks) {
  const { tasks: encodedTasks } = encodeLessonBlocksForFirestore({ tasks })
  await setDoc(doc(firestore, 'lessons', lessonId), { tasks: encodedTasks }, { merge: true })
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

// ── Draft Entries ─────────────────────────────────────────────────────────────
// Each entry is a structured plan step: { id, order, title, entryType, purpose,
// body, expectedOutcome, pitfalls, reviewNote: { decision, suggestedChange, extraNote } }

export async function addDraftEntry(draftId, fields) {
  const ref = doc(firestore, 'lessonDrafts', draftId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error(`Draft '${draftId}' not found`)
  const entries = snap.data().entries ?? []
  const entry = { id: makeEntryId(), order: entries.length + 1, ...fields, createdAt: Date.now() }
  await updateDoc(ref, { entries: [...entries, entry], updatedAt: serverTimestamp() })
  return entry
}

export async function updateDraftEntry(draftId, entryId, fields) {
  const ref = doc(firestore, 'lessonDrafts', draftId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error(`Draft '${draftId}' not found`)
  const entries = snap.data().entries ?? []
  const updated = entries.map(e => e.id === entryId ? { ...e, ...fields } : e)
  await updateDoc(ref, { entries: updated, updatedAt: serverTimestamp() })
}

export async function deleteDraftEntry(draftId, entryId) {
  const ref = doc(firestore, 'lessonDrafts', draftId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error(`Draft '${draftId}' not found`)
  const remaining = (snap.data().entries ?? [])
    .filter(e => e.id !== entryId)
    .map((e, i) => ({ ...e, order: i + 1 }))
  await updateDoc(ref, { entries: remaining, updatedAt: serverTimestamp() })
}

export async function reorderDraftEntries(draftId, orderedIds) {
  const ref = doc(firestore, 'lessonDrafts', draftId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error(`Draft '${draftId}' not found`)
  const byId = Object.fromEntries((snap.data().entries ?? []).map(e => [e.id, e]))
  const reordered = orderedIds.filter(id => byId[id]).map((id, i) => ({ ...byId[id], order: i + 1 }))
  await updateDoc(ref, { entries: reordered, updatedAt: serverTimestamp() })
}

export async function deleteDraft(id) {
  await deleteDoc(doc(firestore, 'lessonDrafts', id))
}

export async function updateEntryReviewNote(draftId, entryId, noteFields) {
  const ref = doc(firestore, 'lessonDrafts', draftId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error(`Draft '${draftId}' not found`)
  const entries = snap.data().entries ?? []
  const updated = entries.map(e =>
    e.id === entryId ? { ...e, reviewNote: { ...(e.reviewNote ?? {}), ...noteFields } } : e
  )
  await updateDoc(ref, { entries: updated, updatedAt: serverTimestamp() })
}

// ── Authoring Guidelines ──────────────────────────────────────────────────────
// Standalone admin guidance docs stored in authoringGuidelines/{id}.
// Fields: id, title, body (Markdown), appliesTo (python|html|scratch|all)

export async function fetchGuidelineList() {
  const q = query(collection(firestore, 'authoringGuidelines'), orderBy('title'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function fetchGuideline(id) {
  const snap = await getDoc(doc(firestore, 'authoringGuidelines', id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}

export async function upsertGuideline({ id, ...fields }) {
  if (!id) throw new Error('Guideline id is required')
  await setDoc(doc(firestore, 'authoringGuidelines', id), { ...fields, updatedAt: serverTimestamp() }, { merge: true })
}

export async function deleteGuideline(id) {
  await deleteDoc(doc(firestore, 'authoringGuidelines', id))
}

// ── Lesson Feedback (for authoring view) ─────────────────────────────────────
// Fetches teacher/student feedback stored under lessons/{lessonId}/feedback.
// Used in the authoring panel to show feedback alongside review notes per entry.

export async function fetchLessonFeedbackItems(lessonId) {
  const q = query(
    collection(firestore, 'lessons', lessonId, 'feedback'),
    orderBy('submittedAt', 'desc'),
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}
