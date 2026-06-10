import { db } from './firebase.mjs'

function validateTopic(topic) {
  if (!topic || typeof topic !== 'object' || Array.isArray(topic)) {
    return ['topic must be a JSON object']
  }
  const errors = []
  if (!topic.id || !String(topic.id).trim()) errors.push('id is required')
  else if (!/^[a-z0-9._-]+$/.test(topic.id)) errors.push('id must be a slug (lowercase, digits, dots, underscores, hyphens only)')
  if (!topic.title || !String(topic.title).trim()) errors.push('title is required')
  return errors
}

export async function listTopics() {
  const snap = await db.collection('topicLibrary').get()
  return snap.docs
    .map(doc => {
      const d = doc.data()
      return { id: doc.id, title: d.title ?? '', category: d.category ?? '', types: d.types ?? [] }
    })
    .sort((a, b) => a.title.localeCompare(b.title))
}

export async function getTopic(id) {
  const snap = await db.collection('topicLibrary').doc(id).get()
  if (!snap.exists) throw new Error(`Topic '${id}' not found`)
  return { id: snap.id, ...snap.data() }
}

export async function upsertTopic(topic) {
  const errors = validateTopic(topic)
  if (errors.length > 0) return { success: false, errors }
  await db.collection('topicLibrary').doc(topic.id).set(topic)
  return { success: true, id: topic.id }
}

export async function deleteTopic(id) {
  const snap = await db.collection('topicLibrary').doc(id).get()
  if (!snap.exists) throw new Error(`Topic '${id}' not found`)
  await db.collection('topicLibrary').doc(id).delete()
  return { success: true, id }
}
