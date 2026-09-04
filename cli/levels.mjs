import { db } from './firebase.mjs'
import { LEVEL_COLLECTION, makeLevelId, normalizeLevelRecord } from '../src/shared/lessonLevels.js'

export async function listLevels({ scopeType, scopeId } = {}) {
  let ref = db.collection(LEVEL_COLLECTION)
  if (scopeType) ref = ref.where('scopeType', '==', scopeType)
  if (scopeId) ref = ref.where('scopeId', '==', scopeId)
  const snap = await ref.get()
  return snap.docs
    .map((doc) => normalizeLevelRecord({ id: doc.id, ...doc.data() }))
    .sort((a, b) =>
      (a.scopeType + a.scopeId + String(a.order)).localeCompare(
        b.scopeType + b.scopeId + String(b.order)
      )
    )
}

export async function upsertLevel(fields) {
  const level = normalizeLevelRecord({
    ...fields,
    id: fields.id ?? makeLevelId(fields.title, fields.scopeId),
  })
  await db.collection(LEVEL_COLLECTION).doc(level.id).set(level, { merge: true })
  return { success: true, level }
}

export async function deleteLevel(id) {
  await db.collection(LEVEL_COLLECTION).doc(id).delete()
  return { success: true, id }
}
