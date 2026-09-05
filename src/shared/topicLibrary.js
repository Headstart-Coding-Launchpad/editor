import { useEffect, useState } from 'react'
import { escapeRegExp } from './textUtils.js'
import { collection, getDocs } from 'firebase/firestore'
import { firestore } from './firebase'

let cachedTopics = null
let fetchPromise = null

export function clearTopicCache() {
  cachedTopics = null
  fetchPromise = null
}

function normalizedText(value) {
  return String(value ?? '').trim()
}

export function normalizeTopicLibrary(data) {
  const rawTopics = Array.isArray(data) ? data : data?.topics
  if (!Array.isArray(rawTopics)) return []

  return rawTopics
    .filter((topic) => topic && normalizedText(topic.id) && normalizedText(topic.title))
    .map((topic) => ({
      id: normalizedText(topic.id),
      title: normalizedText(topic.title),
      types: Array.isArray(topic.types) ? topic.types.map(normalizedText).filter(Boolean) : [],
      category: normalizedText(topic.category),
      summary: normalizedText(topic.summary),
      description: normalizedText(topic.description),
      syntax: normalizedText(topic.syntax),
      aliases: Array.isArray(topic.aliases)
        ? topic.aliases.map(normalizedText).filter(Boolean)
        : [],
      related: Array.isArray(topic.related)
        ? topic.related.map(normalizedText).filter(Boolean)
        : [],
    }))
}

function loadTopics() {
  if (cachedTopics) return Promise.resolve(cachedTopics)
  if (!fetchPromise) {
    fetchPromise = Promise.resolve(getDocs(collection(firestore, 'topicLibrary')))
      .then((snap) => {
        const raw = (snap?.docs ?? []).map((d) => ({ id: d.id, ...d.data() }))
        cachedTopics = normalizeTopicLibrary(raw)
        return cachedTopics
      })
      .catch((error) => {
        fetchPromise = null
        throw error
      })
  }
  return fetchPromise
}

// The topic library is not offered for Scratch lessons at all (no inline topic links, no
// browse dialog) — Scratch's explainer content doesn't use it, and the topic reference UI
// (built for reading dense text explanations) doesn't fit Scratch's block-based teaching.
export function useTopicLibrary(lessonType = null, enabled = true) {
  const shouldFetch = enabled && lessonType !== 'scratch'
  const [topics, setTopics] = useState(cachedTopics ?? [])
  const [loading, setLoading] = useState(shouldFetch && !cachedTopics)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!shouldFetch) {
      setLoading(false)
      return
    }
    if (cachedTopics) {
      setTopics(cachedTopics)
      setLoading(false)
      return
    }
    loadTopics()
      .then((result) => {
        setTopics(result)
        setLoading(false)
      })
      .catch((nextError) => {
        setError(nextError)
        setLoading(false)
      })
  }, [shouldFetch])

  const filteredTopics =
    lessonType === 'scratch'
      ? []
      : lessonType
        ? topics.filter((topic) => topic.types.length === 0 || topic.types.includes(lessonType))
        : topics

  return { topics: filteredTopics, allTopics: topics, loading, error }
}

export function searchTopics(topics, query) {
  const needle = normalizedText(query).toLowerCase()
  if (!needle) return topics
  return topics.filter((topic) =>
    [topic.title, topic.category, topic.summary, topic.description, ...topic.aliases].some(
      (value) => value.toLowerCase().includes(needle)
    )
  )
}

export function topicHref(id) {
  return `#topic/${encodeURIComponent(id)}`
}

export function parseTopicHref(href) {
  const match = String(href ?? '').match(/^#topic\/(.+)$/)
  return match ? decodeURIComponent(match[1]) : null
}

function mapOutsideCode(content, replace) {
  return String(content ?? '')
    .split(/(```[\s\S]*?```|`[^`\n]*`)/g)
    .map((part, index) => (index % 2 ? part : replace(part)))
    .join('')
}

export function expandTopicLinks(content, topics = []) {
  const titles = new Map(topics.map((topic) => [topic.id.toLowerCase(), topic.title]))
  return mapOutsideCode(content, (text) =>
    text.replace(
      /\[\[([a-z0-9][a-z0-9._-]*)(?:\|([^\]\n]+))?\]\]/gi,
      (_, id, label) => `[${label || titles.get(id.toLowerCase()) || id}](${topicHref(id)})`
    )
  )
}

export function findTopicSuggestion(content, topics = []) {
  const results = findAllTopicSuggestions(content, topics)
  return results[0] ?? null
}

export function findAllTopicSuggestions(content, topics = []) {
  const protectedContent = String(content ?? '').replace(
    /```[\s\S]*?```|`[^`\n]*`|\[\[[^\]\n]+\]\]/g,
    (match) => ' '.repeat(match.length)
  )

  const results = []
  for (const topic of topics) {
    const labels = [topic.title, ...topic.aliases].filter((label) => label.length > 2)
    for (const label of labels) {
      const match = new RegExp(`\\b${escapeRegExp(label)}\\b`, 'i').exec(protectedContent)
      if (match) {
        results.push({
          topic,
          start: match.index,
          end: match.index + match[0].length,
          label: String(content).slice(match.index, match.index + match[0].length),
        })
        break
      }
    }
  }
  return results
}
