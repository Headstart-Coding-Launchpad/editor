import { db } from './firebase.mjs'

export async function listGuidelines({ appliesTo = null } = {}) {
  let ref = db.collection('authoringGuidelines').orderBy('title')
  if (appliesTo) ref = db.collection('authoringGuidelines').where('appliesTo', '==', appliesTo).orderBy('title')
  const snap = await ref.get()
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function getGuideline(id) {
  const snap = await db.collection('authoringGuidelines').doc(id).get()
  if (!snap.exists) throw new Error(`Guideline '${id}' not found`)
  return { id: snap.id, ...snap.data() }
}

export async function upsertGuideline(id, fields) {
  if (!id) throw new Error('id is required')
  if (!fields.title?.trim()) throw new Error('title is required')
  await db.collection('authoringGuidelines').doc(id).set(
    { ...fields, updatedAt: new Date() },
    { merge: true },
  )
  return { success: true, id }
}

export async function deleteGuideline(id) {
  const snap = await db.collection('authoringGuidelines').doc(id).get()
  if (!snap.exists) throw new Error(`Guideline '${id}' not found`)
  await db.collection('authoringGuidelines').doc(id).delete()
  return { success: true, id }
}
