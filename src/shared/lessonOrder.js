// Lesson ordering and labels shared by every lesson list (Admin, Builder picker, CLI).
//
// Rules (see `lessonNumber` in docs/authoring/lesson-schema.md):
// - Lessons group by level; within a level, numbered lessons come first by `lessonNumber`
//   ascending, then unnumbered lessons by title.
// - On a shared number the lesson without `soloOnly` comes first, then any other `soloOnly`
//   lesson (a Solo Project), then by title.
// - A lesson with `companionOf` whose parent is in the same list sorts directly after its
//   parent (companions of one parent by title), whatever its own level or number. A companion
//   whose parent is missing sorts by its own level, number and title.
//
// Pure: no Firebase or React imports, so the CLI can use it directly.
import { getLessonLevelRef } from './lessonLevels.js'

export const LESSON_NUMBER_SEPARATOR = ' · '

export function isValidLessonNumber(value) {
  return Number.isInteger(value) && value > 0
}

// The lesson's number when it's a valid positive integer, otherwise null.
export function getLessonNumber(lesson) {
  return isValidLessonNumber(lesson?.lessonNumber) ? lesson.lessonNumber : null
}

function titleOf(lesson) {
  return String(lesson?.title || lesson?.id || '')
}

function compareText(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

// "9 · Boolean Flags", or just the title when the lesson has no number.
export function formatLessonLabel(lesson) {
  const title = titleOf(lesson)
  const number = getLessonNumber(lesson)
  return number == null ? title : `${number}${LESSON_NUMBER_SEPARATOR}${title}`
}

// Compares two lessons in the same level (companion placement is handled by sortLessons).
export function compareLessonsInLevel(a, b) {
  const numberA = getLessonNumber(a)
  const numberB = getLessonNumber(b)
  if (numberA != null && numberB == null) return -1
  if (numberA == null && numberB != null) return 1
  if (numberA != null && numberB != null) {
    if (numberA !== numberB) return numberA - numberB
    const soloA = a?.soloOnly === true ? 1 : 0
    const soloB = b?.soloOnly === true ? 1 : 0
    if (soloA !== soloB) return soloA - soloB
  }
  return compareText(titleOf(a), titleOf(b)) || compareText(String(a?.id), String(b?.id))
}

function defaultLevelKey(lesson) {
  return getLessonLevelRef(lesson)?.id ?? null
}

// Orders level keys: known levels by `order` then title, then unknown level ids by id, and
// lessons with no level (null key) last.
function makeLevelKeyComparator(levels = []) {
  const known = new Map(levels.map((level) => [level.id, level]))
  return (a, b) => {
    if (a === b) return 0
    if (a == null) return 1
    if (b == null) return -1
    const levelA = known.get(a)
    const levelB = known.get(b)
    if (levelA && !levelB) return -1
    if (!levelA && levelB) return 1
    if (levelA && levelB) {
      const order = (levelA.order ?? 0) - (levelB.order ?? 0)
      if (order !== 0) return order
      const byTitle = compareText(String(levelA.title ?? a), String(levelB.title ?? b))
      if (byTitle !== 0) return byTitle
    }
    return compareText(String(a), String(b))
  }
}

// Returns a new array in display order. Options:
// - levels: level records ({ id, order, title }) used to order level groups. Without them,
//   level groups sort by id with no-level lessons last.
// - getLevelKey(lesson): the lesson's level group key (default: its levelId/levelRef id).
//   Pass `() => null` to sort a list that is already one level.
export function sortLessons(lessons, { levels = [], getLevelKey = defaultLevelKey } = {}) {
  const list = Array.isArray(lessons) ? lessons.filter(Boolean) : []
  const byId = new Map(list.map((lesson) => [lesson.id, lesson]))

  // Attach companions whose parent is in the list. Follow the companionOf chain to its root
  // so a cycle (a ↔ b) leaves both lessons unattached instead of dropping them.
  function rootOf(lesson) {
    const seen = new Set([lesson.id])
    let current = lesson
    while (current.companionOf && byId.has(current.companionOf)) {
      if (seen.has(current.companionOf)) return null
      seen.add(current.companionOf)
      current = byId.get(current.companionOf)
    }
    return current
  }

  const childrenByParent = new Map()
  const roots = []
  for (const lesson of list) {
    const parentId = lesson.companionOf
    const attached = parentId && parentId !== lesson.id && byId.has(parentId) && rootOf(lesson)
    if (attached) {
      if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, [])
      childrenByParent.get(parentId).push(lesson)
    } else {
      roots.push(lesson)
    }
  }

  const compareLevelKeys = makeLevelKeyComparator(levels)
  const levelKeyOf = new Map(roots.map((lesson) => [lesson, getLevelKey(lesson) ?? null]))
  roots.sort(
    (a, b) => compareLevelKeys(levelKeyOf.get(a), levelKeyOf.get(b)) || compareLessonsInLevel(a, b)
  )

  const ordered = []
  const emitted = new Set()
  function emit(lesson) {
    if (emitted.has(lesson)) return
    emitted.add(lesson)
    ordered.push(lesson)
    const children = [...(childrenByParent.get(lesson.id) ?? [])].sort(
      (a, b) => compareText(titleOf(a), titleOf(b)) || compareText(String(a.id), String(b.id))
    )
    children.forEach(emit)
  }
  roots.forEach(emit)
  // Lessons sharing an id with another entry can leave a companion unreached; keep them all.
  for (const lesson of list) if (!emitted.has(lesson)) emit(lesson)
  return ordered
}

// The lesson's effective level key for grouping: a companion whose parent is in `lessons`
// uses its parent's level so it lists directly under the parent.
export function getEffectiveLevelKey(lesson, lessons, getLevelKey = defaultLevelKey) {
  const byId = new Map((lessons ?? []).map((item) => [item.id, item]))
  const seen = new Set([lesson?.id])
  let current = lesson
  while (current?.companionOf && byId.has(current.companionOf) && !seen.has(current.companionOf)) {
    seen.add(current.companionOf)
    current = byId.get(current.companionOf)
  }
  return getLevelKey(current) ?? null
}

// True when the lesson is a Solo Challenge listed under a parent present in `lessons`.
export function isAttachedCompanion(lesson, lessons) {
  if (!lesson?.companionOf || lesson.companionOf === lesson.id) return false
  return (lessons ?? []).some((item) => item.id === lesson.companionOf)
}
