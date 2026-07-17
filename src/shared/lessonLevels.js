export const LEVEL_COLLECTION = 'lessonLevels'

export const DEFAULT_LEVEL_COLOUR = '#7c3aed'
export const DEFAULT_LEVEL_ICON = '⭐'

export function getLessonLevelScope(lesson = {}) {
  const scopeType = lesson.courseId ? 'course'
    : lesson.module ? 'module'
      : lesson.collectionId ? 'collection'
        : 'type'
  const scopeId = lesson.courseId ?? lesson.module ?? lesson.collectionId ?? lesson.type ?? 'general'
  return { scopeType, scopeId: String(scopeId || 'general') }
}

export function makeLevelId(title, scopeId = '') {
  const base = String(title ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const prefix = String(scopeId ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return [prefix, base || 'level'].filter(Boolean).join('-')
}

export function normalizeLevelRecord(record = {}) {
  const title = String(record.title ?? record.label ?? record.level ?? '').trim()
  const scopeType = record.scopeType ?? 'type'
  const scopeId = String(record.scopeId ?? record.type ?? 'general')
  const id = String(record.id ?? makeLevelId(title, scopeId))
  return {
    id,
    title: title || id,
    description: record.description ?? '',
    order: Number.isFinite(Number(record.order)) ? Number(record.order) : 0,
    color: record.color ?? DEFAULT_LEVEL_COLOUR,
    icon: record.icon ?? DEFAULT_LEVEL_ICON,
    scopeType,
    scopeId,
  }
}

export function levelTitleFromLesson(lesson = {}, levels = []) {
  const ref = getLessonLevelRef(lesson)
  if (ref?.id) {
    const level = levels.find(candidate => candidate.id === ref.id)
    if (level?.title) return level.title
  }
  if (lesson.level && typeof lesson.level === 'object') return lesson.level.title ?? lesson.level.id ?? ''
  return lesson.level ?? ''
}

export function getLessonLevelRef(lesson = {}) {
  if (lesson.levelRef?.id) return lesson.levelRef
  if (lesson.levelId) return { ...getLessonLevelScope(lesson), id: lesson.levelId }
  if (lesson.level && typeof lesson.level === 'object' && lesson.level.id) {
    return { ...getLessonLevelScope(lesson), id: lesson.level.id }
  }
  return null
}

export function migrateLessonLevel(lesson = {}) {
  const ref = getLessonLevelRef(lesson)
  if (ref?.id) return { lesson, level: null }
  if (lesson.level == null || lesson.level === '') return { lesson, level: null }
  const scope = getLessonLevelScope(lesson)
  const title = String(lesson.level)
  const level = normalizeLevelRecord({
    id: makeLevelId(title, scope.scopeId),
    title,
    order: Number.isFinite(Number(lesson.level)) ? Number(lesson.level) : 0,
    ...scope,
  })
  return {
    lesson: {
      ...lesson,
      levelId: level.id,
      levelRef: { id: level.id, scopeType: level.scopeType, scopeId: level.scopeId },
      level: level.title,
    },
    level,
  }
}

export function compareLevels(a, b) {
  const order = (a.order ?? 0) - (b.order ?? 0)
  if (order !== 0) return order
  return String(a.title ?? a.id).localeCompare(String(b.title ?? b.id))
}
