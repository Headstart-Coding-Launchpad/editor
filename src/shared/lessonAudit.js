function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted)
  if (!isObject(value)) return value
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, sorted(value[key])]))
}

function same(value, other) {
  return JSON.stringify(sorted(value)) === JSON.stringify(sorted(other))
}

function taskWithoutAudit(task, { includeIntent = true } = {}) {
  const {
    intentLastChangedAt: _intentLastChangedAt,
    taskLastChangedAt: _taskLastChangedAt,
    intent,
    ...rest
  } = task
  return includeIntent ? { ...rest, intent: intent ?? '' } : rest
}

function flattenTasks(tasks = []) {
  return (Array.isArray(tasks) ? tasks : []).flatMap(item => item?.type === 'group'
    ? (Array.isArray(item.subtasks) ? item.subtasks : [])
    : [item])
}

function withTaskAudit(tasks, priorTasks, timestamp) {
  const previousById = new Map(flattenTasks(priorTasks)
    .filter(task => task && typeof task === 'object')
    .map(task => [String(task.id), task]))
  return (Array.isArray(tasks) ? tasks : []).map(item => {
    if (item?.type === 'group') {
      return { ...item, subtasks: withTaskAudit(item.subtasks ?? [], priorTasks, timestamp) }
    }
    const previous = previousById.get(String(item.id))
    const intent = item.intent ?? previous?.intent ?? ''
    const intentChanged = !previous || (previous.intent ?? '') !== intent
    const taskChanged = !previous || !same(
      taskWithoutAudit({ ...previous, intent: intent ?? previous.intent ?? '' }, { includeIntent: false }),
      taskWithoutAudit({ ...item, intent }, { includeIntent: false })
    )
    const next = { ...item, intent }
    const intentLastChangedAt = intentChanged ? timestamp : previous?.intentLastChangedAt
    const taskLastChangedAt = taskChanged ? timestamp : previous?.taskLastChangedAt
    if (intentLastChangedAt != null) next.intentLastChangedAt = intentLastChangedAt
    if (taskLastChangedAt != null) next.taskLastChangedAt = taskLastChangedAt
    return next
  })
}

function lessonWithoutAudit(lesson) {
  const { version: _version, tasks = [], ...rest } = lesson
  return { ...rest, tasks: tasks.map(item => item?.type === 'group'
    ? { ...item, subtasks: (item.subtasks ?? []).map(task => taskWithoutAudit(task)) }
    : taskWithoutAudit(item)) }
}

/**
 * Applies the current-state lesson audit fields. The returned lesson is safe to
 * persist as-is; a no-op returns the prior value without changing timestamps.
 */
export function applyLessonAuditMetadata(existing, candidate, timestamp = new Date().toISOString()) {
  const normalized = { ...candidate, draft: candidate.draft === true }
  const baseline = existing ? { ...existing, draft: existing.draft === true } : null
  if (baseline && same(lessonWithoutAudit(baseline), lessonWithoutAudit(normalized))) {
    return { lesson: baseline, material: false }
  }

  return {
    lesson: {
      ...normalized,
      version: (Number.isInteger(baseline?.version) ? baseline.version : 0) + 1,
      tasks: withTaskAudit(normalized.tasks ?? [], baseline?.tasks ?? [], timestamp),
    },
    material: true,
  }
}
