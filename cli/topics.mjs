import { db } from './firebase.mjs'
import { normalizeTopic, normalizeTopicLibrary, validateTopic, validateTopicLibrary } from './topic-utils.mjs'
import { parseYamlTopicLibrary } from './yaml-converter.mjs'

export { normalizeTopic, normalizeTopicLibrary, validateTopic, validateTopicLibrary }

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
  const normalized = normalizeTopic(topic)
  const errors = validateTopic(normalized)
  if (errors.length > 0) return { success: false, errors }
  await db.collection('topicLibrary').doc(normalized.id).set(normalized)
  return { success: true, id: normalized.id }
}

export async function upsertTopicLibrary(input) {
  const validation = validateTopicLibrary(input)
  if (!validation.valid) return { success: false, errors: validation.errors }

  for (const topic of validation.topics) {
    await db.collection('topicLibrary').doc(topic.id).set(topic)
  }

  return {
    success: true,
    count: validation.topics.length,
    ids: validation.topics.map(topic => topic.id),
  }
}

export async function deleteTopic(id) {
  const snap = await db.collection('topicLibrary').doc(id).get()
  if (!snap.exists) throw new Error(`Topic '${id}' not found`)
  await db.collection('topicLibrary').doc(id).delete()
  return { success: true, id }
}

export function yamlToTopicLibrary(yamlText) {
  const topics = parseYamlTopicLibrary(yamlText)
  const validation = validateTopicLibrary(topics)
  return { topics: validation.topics, valid: validation.valid, errors: validation.errors }
}

export async function publishYamlTopicLibrary(yamlText, includeTopics = false) {
  const converted = yamlToTopicLibrary(yamlText)
  if (!converted.valid) return { success: false, errors: converted.errors }
  const result = await upsertTopicLibrary(converted.topics)
  if (includeTopics && result.success) result.topics = converted.topics
  return result
}
