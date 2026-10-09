// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  compareLessonsInLevel,
  formatLessonLabel,
  getEffectiveLevelKey,
  getLessonNumber,
  isAttachedCompanion,
  isValidLessonNumber,
  sortLessons,
} from '../lessonOrder'

const ids = (lessons) => lessons.map((lesson) => lesson.id)
const lesson = (id, fields = {}) => ({ id, title: id, levelId: 'py-1', ...fields })

describe('isValidLessonNumber / getLessonNumber', () => {
  it.each([1, 2, 9, 120])('accepts %s', (value) => {
    expect(isValidLessonNumber(value)).toBe(true)
    expect(getLessonNumber({ lessonNumber: value })).toBe(value)
  })

  it.each([0, -1, 1.5, '9', NaN, Infinity, null, undefined, true, [9]])('rejects %s', (value) => {
    expect(isValidLessonNumber(value)).toBe(false)
    expect(getLessonNumber({ lessonNumber: value })).toBeNull()
  })

  it('handles a missing lesson', () => {
    expect(getLessonNumber(undefined)).toBeNull()
  })
})

describe('formatLessonLabel', () => {
  it('prefixes the number', () => {
    expect(formatLessonLabel({ id: 'k3f9x2qp7a', title: 'Boolean Flags', lessonNumber: 9 })).toBe(
      '9 · Boolean Flags'
    )
  })

  it('shows just the title without a valid number', () => {
    expect(formatLessonLabel({ id: 'a', title: 'Loops' })).toBe('Loops')
    expect(formatLessonLabel({ id: 'a', title: 'Loops', lessonNumber: 0 })).toBe('Loops')
    expect(formatLessonLabel({ id: 'a', title: 'Loops', lessonNumber: '3' })).toBe('Loops')
  })

  it('falls back to the id when there is no title', () => {
    expect(formatLessonLabel({ id: 'abc', lessonNumber: 2 })).toBe('2 · abc')
  })
})

describe('compareLessonsInLevel', () => {
  it('orders numbered lessons ascending (numerically, not as text)', () => {
    const list = [
      lesson('a', { lessonNumber: 10 }),
      lesson('b', { lessonNumber: 2 }),
      lesson('c', { lessonNumber: 9 }),
    ]
    expect(ids([...list].sort(compareLessonsInLevel))).toEqual(['b', 'c', 'a'])
  })

  it('puts unnumbered lessons after numbered ones, by title', () => {
    const list = [
      lesson('x', { title: 'Zebra' }),
      lesson('y', { title: 'Apple' }),
      lesson('z', { title: 'Middle', lessonNumber: 30 }),
    ]
    expect(ids([...list].sort(compareLessonsInLevel))).toEqual(['z', 'y', 'x'])
  })

  it('treats an invalid number as unnumbered', () => {
    const list = [
      lesson('bad', { title: 'A', lessonNumber: '1' }),
      lesson('ok', { lessonNumber: 5 }),
    ]
    expect(ids([...list].sort(compareLessonsInLevel))).toEqual(['ok', 'bad'])
  })

  it('on a shared number puts the non-soloOnly lesson before a soloOnly one', () => {
    const list = [
      lesson('project', { title: 'A Solo Project', lessonNumber: 6, soloOnly: true }),
      lesson('main', { title: 'Z Main lesson', lessonNumber: 6 }),
    ]
    expect(ids([...list].sort(compareLessonsInLevel))).toEqual(['main', 'project'])
  })

  it('breaks remaining ties by title, then id', () => {
    const list = [
      lesson('b', { title: 'Same', lessonNumber: 3 }),
      lesson('a', { title: 'Same', lessonNumber: 3 }),
      lesson('c', { title: 'Earlier', lessonNumber: 3 }),
    ]
    expect(ids([...list].sort(compareLessonsInLevel))).toEqual(['c', 'a', 'b'])
  })
})

describe('sortLessons', () => {
  it('returns a new array and leaves the input alone', () => {
    const input = [lesson('b', { lessonNumber: 2 }), lesson('a', { lessonNumber: 1 })]
    const sorted = sortLessons(input)
    expect(ids(sorted)).toEqual(['a', 'b'])
    expect(ids(input)).toEqual(['b', 'a'])
  })

  it('handles empty and non-array input', () => {
    expect(sortLessons([])).toEqual([])
    expect(sortLessons(undefined)).toEqual([])
  })

  it('implements the request example: lesson, its Solo Challenge, then the Solo Project', () => {
    const list = [
      {
        id: 'z5h1q9vb4e',
        title: 'Solo Project 1',
        soloOnly: true,
        levelId: 'python-level-1',
        lessonNumber: 6,
      },
      {
        id: 'm8d2r6tw1c',
        title: 'Boolean Flags — Solo Challenge',
        soloOnly: true,
        companionOf: 'k3f9x2qp7a',
      },
      { id: 'k3f9x2qp7a', title: 'Boolean Flags', levelId: 'python-level-1', lessonNumber: 9 },
      { id: 'l6', title: 'Lesson Six', levelId: 'python-level-1', lessonNumber: 6 },
      { id: 'l7', title: 'Lesson Seven', levelId: 'python-level-1', lessonNumber: 7 },
    ]
    expect(ids(sortLessons(list))).toEqual(['l6', 'z5h1q9vb4e', 'l7', 'k3f9x2qp7a', 'm8d2r6tw1c'])
  })

  it('places a companion straight after its parent, before another soloOnly lesson sharing the number', () => {
    const list = [
      lesson('project', { title: 'Aardvark Project', lessonNumber: 6, soloOnly: true }),
      lesson('challenge', { title: 'Challenge', soloOnly: true, companionOf: 'main' }),
      lesson('main', { title: 'Zz Main', lessonNumber: 6 }),
    ]
    expect(ids(sortLessons(list))).toEqual(['main', 'challenge', 'project'])
  })

  it('ignores the companion’s own number and level when its parent is present', () => {
    const list = [
      lesson('parent', { lessonNumber: 5 }),
      lesson('first', { lessonNumber: 1 }),
      { id: 'child', title: 'Child', companionOf: 'parent', lessonNumber: 1, levelId: 'other' },
    ]
    expect(ids(sortLessons(list))).toEqual(['first', 'parent', 'child'])
  })

  it('orders several companions of one parent by title', () => {
    const list = [
      lesson('c2', { title: 'Zeta challenge', companionOf: 'p' }),
      lesson('p', { lessonNumber: 1 }),
      lesson('c1', { title: 'Alpha challenge', companionOf: 'p' }),
      lesson('next', { lessonNumber: 2 }),
    ]
    expect(ids(sortLessons(list))).toEqual(['p', 'c1', 'c2', 'next'])
  })

  it('keeps an unnumbered parent’s companion with it among the unnumbered lessons', () => {
    const list = [
      lesson('child', { title: 'A child', companionOf: 'parent', soloOnly: true }),
      lesson('parent', { title: 'M parent' }),
      lesson('other', { title: 'Z other' }),
      lesson('numbered', { lessonNumber: 1 }),
    ]
    expect(ids(sortLessons(list))).toEqual(['numbered', 'parent', 'child', 'other'])
  })

  it('falls back to the companion’s own number and title when its parent is missing', () => {
    const list = [
      lesson('orphan-numbered', { companionOf: 'gone', soloOnly: true, lessonNumber: 2 }),
      lesson('orphan', { title: 'B orphan', companionOf: 'gone', soloOnly: true }),
      lesson('one', { lessonNumber: 1 }),
      lesson('three', { lessonNumber: 3 }),
      lesson('plain', { title: 'A plain' }),
    ]
    expect(ids(sortLessons(list))).toEqual(['one', 'orphan-numbered', 'three', 'plain', 'orphan'])
  })

  it('supports nested companions and survives companionOf cycles', () => {
    const nested = [
      lesson('grandchild', { companionOf: 'child' }),
      lesson('child', { companionOf: 'root' }),
      lesson('root', { lessonNumber: 1 }),
    ]
    expect(ids(sortLessons(nested))).toEqual(['root', 'child', 'grandchild'])

    const cycle = [
      lesson('a', { title: 'A', companionOf: 'b' }),
      lesson('b', { title: 'B', companionOf: 'a' }),
      lesson('self', { title: 'C', companionOf: 'self' }),
    ]
    expect(ids(sortLessons(cycle))).toEqual(['a', 'b', 'self'])
  })

  it('groups by level using level order, with no-level lessons last', () => {
    const levels = [
      { id: 'py-2', order: 2, title: 'Level 2' },
      { id: 'py-1', order: 1, title: 'Level 1' },
    ]
    const list = [
      { id: 'none', title: 'No level' },
      { id: 'l2-1', title: 'L2 first', levelId: 'py-2', lessonNumber: 1 },
      { id: 'l1-2', title: 'L1 second', levelId: 'py-1', lessonNumber: 2 },
      { id: 'l1-1', title: 'L1 first', levelId: 'py-1', lessonNumber: 1 },
      { id: 'unknown', title: 'Unknown level', levelId: 'zz-unknown' },
    ]
    expect(ids(sortLessons(list, { levels }))).toEqual(['l1-1', 'l1-2', 'l2-1', 'unknown', 'none'])
  })

  it('groups by level id without level records, and reads levelRef too', () => {
    const list = [
      { id: 'b1', levelRef: { id: 'b' }, lessonNumber: 1 },
      { id: 'a2', levelId: 'a', lessonNumber: 2 },
      { id: 'a1', levelId: 'a', lessonNumber: 1 },
    ]
    expect(ids(sortLessons(list))).toEqual(['a1', 'a2', 'b1'])
  })

  it('keeps a level-less companion under a parent in another level group', () => {
    const levels = [
      { id: 'py-1', order: 1 },
      { id: 'py-2', order: 2 },
    ]
    const list = [
      { id: 'challenge', title: 'Challenge', soloOnly: true, companionOf: 'p2' },
      { id: 'p2', title: 'Level two lesson', levelId: 'py-2', lessonNumber: 1 },
      { id: 'p1', title: 'Level one lesson', levelId: 'py-1', lessonNumber: 1 },
    ]
    expect(ids(sortLessons(list, { levels }))).toEqual(['p1', 'p2', 'challenge'])
  })

  it('treats the list as a single level with getLevelKey returning null', () => {
    const list = [
      { id: 'b', levelId: 'zz', lessonNumber: 1 },
      { id: 'a', levelId: 'aa', lessonNumber: 2 },
    ]
    expect(ids(sortLessons(list, { getLevelKey: () => null }))).toEqual(['b', 'a'])
  })
})

describe('getEffectiveLevelKey / isAttachedCompanion', () => {
  const parent = { id: 'p', levelId: 'py-3' }
  const child = { id: 'c', companionOf: 'p' }
  const orphan = { id: 'o', companionOf: 'missing', levelId: 'py-1' }

  it('uses the parent level for a companion whose parent is listed', () => {
    expect(getEffectiveLevelKey(child, [parent, child])).toBe('py-3')
    expect(getEffectiveLevelKey(orphan, [parent, orphan])).toBe('py-1')
    expect(getEffectiveLevelKey(child, [child])).toBeNull()
  })

  it('reports whether a companion attaches to a listed parent', () => {
    expect(isAttachedCompanion(child, [parent, child])).toBe(true)
    expect(isAttachedCompanion(orphan, [parent, orphan])).toBe(false)
    expect(isAttachedCompanion(parent, [parent, child])).toBe(false)
    expect(isAttachedCompanion({ id: 's', companionOf: 's' }, [{ id: 's' }])).toBe(false)
  })
})
