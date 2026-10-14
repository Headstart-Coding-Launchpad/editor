// Class roster: Firebase reads and writes. Tutor and admin only (firestore.rules: the roster and
// its `work` / `typing` subcollections are teacher/admin read+write and never public; the RTDB
// `rosterMatches` / `classId` session fields are teacher/admin write). Students never call this.
// Pure helpers are in ./rosterModel.js; W3-a (cross-lesson carry) and W3-b (typing history)
// build on listRoster / getSavedWork / appendTyping / listTyping.
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit as limitTo,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { ref, remove, update } from 'firebase/database'
import { db, firestore } from '../firebase'
import { CLASS_COLLECTION } from '../lessonForks'
import {
  buildRosterWorkDoc,
  compareRosterEntries,
  makeRosterMatch,
  makeRosterWorkId,
  normaliseRosterName,
  readRosterWorkDoc,
  ROSTER_SUBCOLLECTION,
  ROSTER_TYPING_SUBCOLLECTION,
  ROSTER_WORK_CHUNKS_SUBCOLLECTION,
  ROSTER_WORK_SUBCOLLECTION,
} from './rosterModel'

const BATCH_LIMIT = 400

function rosterCollection(classId) {
  return collection(firestore, CLASS_COLLECTION, classId, ROSTER_SUBCOLLECTION)
}

function rosterEntryDoc(classId, rosterId) {
  return doc(firestore, CLASS_COLLECTION, classId, ROSTER_SUBCOLLECTION, rosterId)
}

function workDoc(classId, rosterId, workId) {
  return doc(rosterEntryDoc(classId, rosterId), ROSTER_WORK_SUBCOLLECTION, workId)
}

function chunksCollection(classId, rosterId, workId) {
  return collection(workDoc(classId, rosterId, workId), ROSTER_WORK_CHUNKS_SUBCOLLECTION)
}

function toEntry(snap) {
  const data = snap.data() ?? {}
  return {
    id: snap.id,
    displayName: data.displayName ?? '',
    createdAt: data.createdAt ?? null,
    createdBy: data.createdBy ?? null,
  }
}

// ── Roster entries ────────────────────────────────────────────────────────────

// The class's roster, sorted by name: [{ id, displayName, createdAt, createdBy }].
export async function listRoster(classId) {
  if (!classId) return []
  const snap = await getDocs(rosterCollection(classId))
  return snap.docs.map(toEntry).sort(compareRosterEntries)
}

// Live roster for the Admin editor and the tutor's Match students panel. Returns unsubscribe.
export function subscribeRoster(classId, onChange, onError) {
  if (!classId) {
    onChange([])
    return () => {}
  }
  return onSnapshot(
    rosterCollection(classId),
    (snap) => onChange(snap.docs.map(toEntry).sort(compareRosterEntries)),
    (err) => onError?.(err)
  )
}

// Adds "Jamie B." to the class roster (Admin → Classes, or the tutor's "New student").
// Returns the new entry.
export async function addRosterEntry(classId, displayName, createdBy = null) {
  const name = normaliseRosterName(displayName)
  if (!classId) throw new Error('A class is required')
  if (!name) throw new Error('Enter a first name and initial (up to 30 characters)')
  const data = { displayName: name, createdAt: Date.now(), createdBy: createdBy ?? null }
  const created = await addDoc(rosterCollection(classId), data)
  return { id: created.id, ...data }
}

export async function renameRosterEntry(classId, rosterId, displayName) {
  const name = normaliseRosterName(displayName)
  if (!name) throw new Error('Enter a first name and initial (up to 30 characters)')
  await updateDoc(rosterEntryDoc(classId, rosterId), { displayName: name })
}

async function deleteDocsInBatches(refs) {
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(firestore)
    for (const item of refs.slice(i, i + BATCH_LIMIT)) batch.delete(item)
    await batch.commit()
  }
}

// Deletes the entry and everything saved for it: its work (and work chunks) and typing scores.
export async function deleteRosterEntry(classId, rosterId) {
  if (!classId || !rosterId) throw new Error('A roster entry is required')
  const entry = rosterEntryDoc(classId, rosterId)
  const work = await getDocs(collection(entry, ROSTER_WORK_SUBCOLLECTION))
  const refs = []
  for (const item of work.docs) {
    const chunks = await getDocs(collection(item.ref, ROSTER_WORK_CHUNKS_SUBCOLLECTION))
    refs.push(...chunks.docs.map((chunk) => chunk.ref), item.ref)
  }
  const typing = await getDocs(collection(entry, ROSTER_TYPING_SUBCOLLECTION))
  refs.push(...typing.docs.map((item) => item.ref))
  await deleteDocsInBatches(refs)
  await deleteDoc(entry)
}

// ── Saved work ────────────────────────────────────────────────────────────────

// Writes one task's work (rosterModel's extractRosterWork result) to
// classes/{classId}/roster/{rosterId}/work/{workId}. Large content goes to the `chunks`
// subcollection first, then the document that names how many chunks to read.
export async function saveRosterWork(classId, rosterId, workId, work, meta) {
  if (!classId || !rosterId || !workId) throw new Error('A roster work path is required')
  const { doc: data, chunks } = buildRosterWorkDoc(work, meta)
  for (let i = 0; i < chunks.length; i++) {
    await setDoc(doc(chunksCollection(classId, rosterId, workId), String(i)), { data: chunks[i] })
  }
  await setDoc(workDoc(classId, rosterId, workId), { ...data, savedAt: serverTimestamp() })
  return data.hash
}

// A matched student's saved work for a stock lesson's task, or null:
// { kind: 'code', code } | { kind: 'files', files: [{ name, content }] } |
// { kind: 'blocks', scratchState }, plus moduleType, sessionLessonId, taskId, sourceLessonId,
// sourceTaskId, origin ('run' | 'submission' | 'leave'), hash and savedAt.
// `sourceLessonId` / `sourceTaskId` are the stock ids (rosterModel's resolveSourceIds).
export async function getSavedWork(classId, rosterId, sourceLessonId, sourceTaskId) {
  const workId = makeRosterWorkId(sourceLessonId, sourceTaskId)
  if (!classId || !rosterId || !workId) return null
  const snap = await getDoc(workDoc(classId, rosterId, workId))
  if (!snap.exists()) return null
  const data = snap.data()
  let chunks = []
  if (data.chunkCount > 0) {
    const chunkSnap = await getDocs(chunksCollection(classId, rosterId, workId))
    const byIndex = new Map(chunkSnap.docs.map((item) => [item.id, item.data()?.data ?? '']))
    chunks = Array.from({ length: data.chunkCount }, (_, i) => byIndex.get(String(i)))
    if (chunks.some((chunk) => typeof chunk !== 'string')) return null
  }
  return readRosterWorkDoc(data, chunks)
}

// ── Typing scores (W3-b) ──────────────────────────────────────────────────────

// Appends one keyboard result to classes/{classId}/roster/{rosterId}/typing. The entry's shape
// is W3-b's to define; `recordedAt` is added here.
export async function appendTyping(classId, rosterId, entry) {
  if (!classId || !rosterId) throw new Error('A roster entry is required')
  const created = await addDoc(
    collection(rosterEntryDoc(classId, rosterId), ROSTER_TYPING_SUBCOLLECTION),
    { ...(entry ?? {}), recordedAt: serverTimestamp() }
  )
  return created.id
}

// Saves one keyboard result under a fixed id (src/shared/typingHistory.js makeTypingEntryId,
// which is its dedupe key), so saving the same finished attempt again changes nothing.
export async function saveTyping(classId, rosterId, entryId, entry) {
  if (!classId || !rosterId || !entryId) throw new Error('A typing entry path is required')
  await setDoc(doc(rosterEntryDoc(classId, rosterId), ROSTER_TYPING_SUBCOLLECTION, entryId), {
    ...(entry ?? {}),
    recordedAt: serverTimestamp(),
  })
  return entryId
}

// The entry's typing results, newest first.
export async function listTyping(classId, rosterId, { max = 50 } = {}) {
  if (!classId || !rosterId) return []
  const snap = await getDocs(
    query(
      collection(rosterEntryDoc(classId, rosterId), ROSTER_TYPING_SUBCOLLECTION),
      orderBy('recordedAt', 'desc'),
      limitTo(max)
    )
  )
  return snap.docs.map((item) => ({ id: item.id, ...item.data() }))
}

// ── Session links (RTDB, teacher/admin write) ─────────────────────────────────

// Matches a joined student to a roster entry: sessions/{lessonId}/rosterMatches/{anonymousId}.
export async function matchStudent(lessonId, anonymousId, rosterId, matchedBy = null) {
  if (!lessonId || !anonymousId) throw new Error('A student is required')
  await update(ref(db, `sessions/${lessonId}/rosterMatches`), {
    [anonymousId]: makeRosterMatch(rosterId, matchedBy),
  })
}

// Pushes typing-history summaries to students: sessions/{lessonId}/typingHistory/{anonymousId}
// (teacher/admin write; src/shared/typingHistory.js). `updates` maps anonymousId → node or null.
export async function setTypingHistoryNodes(lessonId, updates) {
  if (!lessonId || !updates || Object.keys(updates).length === 0) return
  await update(ref(db, `sessions/${lessonId}/typingHistory`), updates)
}

export async function unmatchStudent(lessonId, anonymousId) {
  if (!lessonId || !anonymousId) return
  await remove(ref(db, `sessions/${lessonId}/rosterMatches/${anonymousId}`))
}

// The class a stock lesson's session uses (a fork always uses fork.classId): a class id, or null
// for "No class". Changing class clears the matches, which belonged to the old roster.
export async function setSessionClass(lessonId, classId) {
  if (!lessonId) return
  await update(ref(db, `sessions/${lessonId}`), {
    classId: classId || null,
    classChosenAt: Date.now(),
    rosterMatches: null,
  })
}
