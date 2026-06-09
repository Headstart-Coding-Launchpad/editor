import { z } from 'zod'
import { db } from './firebase.mjs'

function validateTopic(topic) {
  const errors = []
  if (!topic || typeof topic !== 'object' || Array.isArray(topic)) {
    return ['topic must be a JSON object']
  }
  if (!topic.id || !String(topic.id).trim()) errors.push('id is required')
  else if (!/^[a-z0-9._-]+$/.test(topic.id)) errors.push('id must be a slug (lowercase, digits, dots, underscores, hyphens only)')
  if (!topic.title || !String(topic.title).trim()) errors.push('title is required')
  return errors
}

export function registerTopicTools(server) {
  server.tool(
    'list_topics',
    'List all topics in the topic library with id, title, category, and types',
    {},
    async () => {
      const snap = await db.collection('topicLibrary').get()
      const items = snap.docs
        .map(doc => {
          const d = doc.data()
          return { id: doc.id, title: d.title ?? '', category: d.category ?? '', types: d.types ?? [] }
        })
        .sort((a, b) => a.title.localeCompare(b.title))
      return { content: [{ type: 'text', text: JSON.stringify(items, null, 2) }] }
    }
  )

  server.tool(
    'get_topic',
    'Fetch a full topic by ID',
    { id: z.string().describe('Topic ID slug') },
    async ({ id }) => {
      const snap = await db.collection('topicLibrary').doc(id).get()
      if (!snap.exists) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: `Topic '${id}' not found` }) }] }
      }
      return { content: [{ type: 'text', text: JSON.stringify({ id: snap.id, ...snap.data() }, null, 2) }] }
    }
  )

  server.tool(
    'upsert_topic',
    'Create or update a topic in the topic library',
    { topic: z.object({}).passthrough().describe('Full topic JSON object') },
    async ({ topic }) => {
      const errors = validateTopic(topic)
      if (errors.length > 0) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, errors }) }] }
      }
      try {
        await db.collection('topicLibrary').doc(topic.id).set(topic)
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, id: topic.id }) }] }
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: err.message }) }] }
      }
    }
  )

  server.tool(
    'delete_topic',
    'Delete a topic from the topic library by ID',
    { id: z.string().describe('Topic ID to delete') },
    async ({ id }) => {
      const snap = await db.collection('topicLibrary').doc(id).get()
      if (!snap.exists) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: `Topic '${id}' not found` }) }] }
      }
      try {
        await db.collection('topicLibrary').doc(id).delete()
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, id }) }] }
      } catch (err) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: err.message }) }] }
      }
    }
  )
}
