function normalizedText(value) {
  return String(value ?? '').trim()
}

export function normalizeTopic(topic) {
  return {
    id: normalizedText(topic.id),
    title: normalizedText(topic.title),
    types: Array.isArray(topic.types) ? topic.types.map(normalizedText).filter(Boolean) : [],
    category: normalizedText(topic.category),
    summary: normalizedText(topic.summary),
    description: normalizedText(topic.description),
    syntax: normalizedText(topic.syntax),
    aliases: Array.isArray(topic.aliases) ? topic.aliases.map(normalizedText).filter(Boolean) : [],
    related: Array.isArray(topic.related) ? topic.related.map(normalizedText).filter(Boolean) : [],
  }
}

export function normalizeTopicLibrary(input) {
  const rawTopics = Array.isArray(input) ? input : input?.topics
  if (!Array.isArray(rawTopics)) {
    if (input && typeof input === 'object' && !Array.isArray(input) && (input.id || input.title)) {
      return [normalizeTopic(input)]
    }
    return []
  }
  return rawTopics
    .filter(topic => topic && typeof topic === 'object' && !Array.isArray(topic))
    .map(normalizeTopic)
}

export function validateTopic(topic) {
  if (!topic || typeof topic !== 'object' || Array.isArray(topic)) {
    return ['topic must be a JSON object']
  }
  const errors = []
  if (!topic.id || !String(topic.id).trim()) errors.push('id is required')
  else if (!/^[a-z0-9._-]+$/.test(topic.id)) errors.push('id must be a slug (lowercase, digits, dots, underscores, hyphens only)')
  if (!topic.title || !String(topic.title).trim()) errors.push('title is required')
  return errors
}

export function validateTopicLibrary(input) {
  const topics = normalizeTopicLibrary(input)
  const errors = []
  if (topics.length === 0) errors.push('topic library must contain at least one topic')

  const seen = new Set()
  topics.forEach((topic, index) => {
    const topicErrors = validateTopic(topic)
    for (const error of topicErrors) errors.push(`Topic ${index + 1}: ${error}`)
    if (topic.id) {
      if (seen.has(topic.id)) errors.push(`Topic ${index + 1}: duplicate id '${topic.id}'`)
      seen.add(topic.id)
    }
  })

  return { valid: errors.length === 0, errors, topics }
}
