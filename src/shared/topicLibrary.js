import { useEffect, useState } from 'react'
import { escapeRegExp } from './textUtils.js'
import { collection, getDocs } from 'firebase/firestore'
import { firestore } from './firebase'
import { getModuleDefinition } from '../modules/definitions.js'

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

// The topic library is not offered for modules without `capabilities.topicLibrary` at all (no
// inline topic links, no browse dialog) — Scratch's explainer content doesn't use it, and the
// topic reference UI (built for reading dense text explanations) doesn't fit Scratch's
// block-based teaching. Unknown types (composed lessons, none) keep it.
function offersTopicLibrary(lessonType) {
  return getModuleDefinition(lessonType)?.capabilities.topicLibrary ?? true
}

export function useTopicLibrary(lessonType = null, enabled = true) {
  const offered = offersTopicLibrary(lessonType)
  const shouldFetch = enabled && offered
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

  const filteredTopics = !offered
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

// The topic a piece of task text is about, for opening the Topic Library on it rather than on
// the first topic alphabetically: the first [[topic]] / #topic/ link to a known topic, else the
// first inline code span named exactly like a topic (`print()`), else the earliest topic named
// in the text. Null when nothing matches.
export function findRelatedTopicId(content, topics = []) {
  const text = String(content ?? '')
  if (!text || topics.length === 0) return null
  const byId = new Map(topics.map((topic) => [topic.id.toLowerCase(), topic.id]))
  const link = /\[\[([a-z0-9][a-z0-9._-]*)(?:\|[^\]\n]+)?\]\]|\(#topic\/([^)\s]+)\)/gi
  for (const match of text.matchAll(link)) {
    const id = byId.get(decodeURIComponent(match[1] ?? match[2]).toLowerCase())
    if (id) return id
  }
  const byName = new Map()
  for (const topic of topics) {
    for (const name of [topic.title, ...(topic.aliases ?? [])]) {
      const key = String(name ?? '')
        .trim()
        .toLowerCase()
      if (key && !byName.has(key)) byName.set(key, topic.id)
    }
  }
  for (const match of text.matchAll(/`([^`\n]+)`/g)) {
    const id = byName.get(match[1].trim().toLowerCase())
    if (id) return id
  }
  const named = findAllTopicSuggestions(text, topics)
  if (named.length === 0) return null
  return named.reduce((first, item) => (item.start < first.start ? item : first)).topic.id
}
