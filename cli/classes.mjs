import { db } from './firebase.mjs'
import { CLASS_COLLECTION, makeClassRecord } from '../src/shared/lessonForks.js'

export async function listClasses({ includeArchived = false } = {}) {
  const snap = await db.collection(CLASS_COLLECTION).get()
  return snap.docs
    .map(doc => makeClassRecord({ id: doc.id, ...doc.data() }))
    .filter(cls => includeArchived || !cls.archived)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function getClass(id) {
  const snap = await db.collection(CLASS_COLLECTION).doc(id).get()
  if (!snap.exists) throw new Error(`Class '${id}' not found`)
  return makeClassRecord({ id: snap.id, ...snap.data() })
}

export async function upsertClass(input) {
  const existing = input.id
    ? await db.collection(CLASS_COLLECTION).doc(input.id).get()
    : null
  const previous = existing?.exists ? existing.data() : {}
  const record = makeClassRecord({
    ...previous,
    ...input,
    createdAt: previous.createdAt ?? Date.now(),
    updatedAt: Date.now(),
  })
  await db.collection(CLASS_COLLECTION).doc(record.id).set(record, { merge: true })
  return { success: true, class: record }
}

export async function archiveClass(id) {
  const cls = await getClass(id)
  await db.collection(CLASS_COLLECTION).doc(cls.id).set({
    ...cls,
    archived: true,
    updatedAt: Date.now(),
  }, { merge: true })
  return { success: true, id: cls.id }
}
