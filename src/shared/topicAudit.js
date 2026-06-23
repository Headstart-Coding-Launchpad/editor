const TOPIC_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/i
const WIKI_LINK_PATTERN = /\[\[([a-z0-9][a-z0-9._-]*)(?:\|[^\]\n]+)?\]\]/gi
const TOPIC_HREF_PATTERN = /#topic\/([a-z0-9][a-z0-9._-]*)/gi

function normalizeId(value) {
  return String(value ?? '').trim().toLowerCase()
}

export function extractTopicIdsFromText(value) {
  const text = String(value ?? '')
  const ids = new Set()
  for (const match of text.matchAll(WIKI_LINK_PATTERN)) ids.add(normalizeId(match[1]))
  for (const match of text.matchAll(TOPIC_HREF_PATTERN)) ids.add(normalizeId(match[1]))
  return [...ids]
}

export function normalizeTopicLinks(value) {
  const values = Array.isArray(value) ? value : [value]
  const ids = new Set()

  for (const entry of values) {
    if (entry == null) continue
    const text = String(entry).trim()
    const markedIds = extractTopicIdsFromText(text)
    if (markedIds.length > 0) {
      markedIds.forEach(id => ids.add(id))
      continue
    }
    text.split(/[\s,]+/).forEach(part => {
      const id = normalizeId(part)
      if (TOPIC_ID_PATTERN.test(id)) ids.add(id)
    })
  }

  return [...ids]
}

export function validateTopicProposals(proposals) {
  if (proposals == null) return []
  if (!Array.isArray(proposals)) return ['topicProposals must be an array']
  const errors = []
  const seen = new Set()
  proposals.forEach((proposal, index) => {
    const label = `Topic proposal ${index + 1}`
    const id = normalizeId(proposal?.id)
    if (!id) errors.push(`${label} is missing an id`)
    else if (!TOPIC_ID_PATTERN.test(id)) errors.push(`${label} id must be a topic slug`)
    else if (seen.has(id)) errors.push(`${label} duplicates id "${id}"`)
    else seen.add(id)
    if (!String(proposal?.title ?? '').trim()) errors.push(`${label} is missing a title`)
    if (!String(proposal?.description ?? '').trim()) errors.push(`${label} is missing a description`)
    if (!['proposed', 'deferred'].includes(normalizeId(proposal?.status))) {
      errors.push(`${label} status must be proposed or deferred`)
    }
  })
  return errors
}

function collectMarkedIds(value, ids, key = '') {
  if (value == null) return
  if (key === 'topicLinks') {
    normalizeTopicLinks(value).forEach(id => ids.add(id))
    return
  }
  if (typeof value === 'string') {
    extractTopicIdsFromText(value).forEach(id => ids.add(id))
    return
  }
  if (Array.isArray(value)) {
    value.forEach(item => collectMarkedIds(item, ids))
    return
  }
  if (typeof value === 'object') {
    Object.entries(value).forEach(([childKey, childValue]) => {
      collectMarkedIds(childValue, ids, childKey)
    })
  }
}

function flattenTaskReferences(tasks, groupTitle = null, result = []) {
  for (const item of tasks ?? []) {
    if (item?.type === 'group') {
      flattenTaskReferences(item.subtasks, item.title ?? null, result)
      continue
    }
    result.push({
      task: item ?? {},
      id: item?.id ?? result.length + 1,
      title: item?.title ?? '',
      index: result.length + 1,
      groupTitle,
    })
  }
  return result
}

export function collectLessonTopicReferences(lesson) {
  const byId = new Map()
  for (const reference of flattenTaskReferences(lesson?.tasks)) {
    const ids = new Set()
    collectMarkedIds(reference.task, ids)
    for (const id of ids) {
      if (!byId.has(id)) byId.set(id, [])
      byId.get(id).push({
        id: reference.id,
        title: reference.title,
        index: reference.index,
        groupTitle: reference.groupTitle,
      })
    }
  }
  return [...byId.entries()]
    .map(([id, tasks]) => ({ id, tasks }))
    .sort((a, b) => a.id.localeCompare(b.id))
}

export function auditLessonTopics(lesson, topics = []) {
  const existingIds = new Set((topics ?? []).map(topic => normalizeId(topic?.id ?? topic)).filter(Boolean))
  const proposals = (Array.isArray(lesson?.topicProposals) ? lesson.topicProposals : [])
    .filter(proposal => proposal && normalizeId(proposal.id))
    .map(proposal => ({ ...proposal, id: normalizeId(proposal.id) }))
  const proposalById = new Map(proposals.map(proposal => [proposal.id, proposal]))
  const references = collectLessonTopicReferences(lesson)
  const referencedIds = new Set(references.map(reference => reference.id))

  const withStatus = references.map(reference => ({
    ...reference,
    exists: existingIds.has(reference.id),
    proposal: proposalById.get(reference.id) ?? null,
  }))

  return {
    references: withStatus,
    existing: withStatus.filter(reference => reference.exists),
    missing: withStatus.filter(reference => !reference.exists),
    unusedProposals: proposals.filter(proposal => !referencedIds.has(proposal.id)),
  }
}

export function validateTopicStage(lesson, topics, nextStage = lesson?.stage ?? 'ideas') {
  const audit = auditLessonTopics(lesson, topics)
  const errors = validateTopicProposals(lesson?.topicProposals)
  const warnings = []
  const missingIds = audit.missing.map(item => item.id)

  if (nextStage === 'review') {
    const unresolved = audit.missing.filter(item => {
      const status = normalizeId(item.proposal?.status)
      return !item.proposal || !['proposed', 'deferred'].includes(status)
    })
    if (unresolved.length > 0) {
      errors.push(`Missing topics need a proposal or deferred status before Review: ${unresolved.map(item => item.id).join(', ')}`)
    }
  } else if (nextStage === 'published' && missingIds.length > 0) {
    errors.push(`Cannot publish while Topic Library entries are missing: ${missingIds.join(', ')}`)
  }

  if (missingIds.length > 0) {
    warnings.push(`Missing Topic Library entries: ${missingIds.join(', ')}`)
  }
  if (audit.unusedProposals.length > 0) {
    warnings.push(`Unused topic proposals: ${audit.unusedProposals.map(item => item.id).join(', ')}`)
  }

  return { valid: errors.length === 0, errors, warnings, audit }
}
