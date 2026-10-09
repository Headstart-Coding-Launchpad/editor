// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { applyLessonAuditMetadata } from '../lessonAudit'

const timestamp = '2026-07-25T12:00:00.000Z'
const lesson = {
  id: 'audit-demo',
  type: 'python',
  title: 'Audit',
  description: 'Audit lesson',
  draft: true,
  tasks: [{ id: 9, title: 'Task', intent: 'First brief', starterCode: '' }],
}

describe('applyLessonAuditMetadata', () => {
  it('creates current version and task timestamps, then leaves no-op saves untouched', () => {
    const first = applyLessonAuditMetadata(null, lesson, timestamp)
    expect(first).toMatchObject({
      material: true,
      lesson: {
        version: 1,
        tasks: [{ intentLastChangedAt: timestamp, taskLastChangedAt: timestamp }],
      },
    })

    const noOp = applyLessonAuditMetadata(first.lesson, first.lesson, '2026-07-25T13:00:00.000Z')
    expect(noOp.material).toBe(false)
    expect(noOp.lesson).toStrictEqual(first.lesson)
  })

  it('separates intent-only changes from learner-facing task changes and preserves ids/order', () => {
    const first = applyLessonAuditMetadata(null, lesson, timestamp).lesson
    const intentOnly = applyLessonAuditMetadata(
      first,
      { ...first, tasks: [{ ...first.tasks[0], intent: 'Updated brief' }] },
      '2026-07-25T13:00:00.000Z'
    ).lesson
    expect(intentOnly.version).toBe(2)
    expect(intentOnly.tasks[0]).toMatchObject({
      id: 9,
      intentLastChangedAt: '2026-07-25T13:00:00.000Z',
      taskLastChangedAt: timestamp,
    })

    const contentChange = applyLessonAuditMetadata(
      intentOnly,
      { ...intentOnly, tasks: [{ ...intentOnly.tasks[0], starterCode: 'print(1)' }] },
      '2026-07-25T14:00:00.000Z'
    ).lesson
    expect(contentChange.tasks[0]).toMatchObject({
      id: 9,
      intentLastChangedAt: '2026-07-25T13:00:00.000Z',
      taskLastChangedAt: '2026-07-25T14:00:00.000Z',
    })
  })

  describe('lessonNumber', () => {
    const numbered = { ...lesson, lessonNumber: 9 }

    it('stores a lessonNumber and treats a number change as a new version', () => {
      const first = applyLessonAuditMetadata(null, numbered, timestamp).lesson
      expect(first).toMatchObject({ lessonNumber: 9, version: 1 })

      const renumbered = applyLessonAuditMetadata(first, { ...first, lessonNumber: 10 }, timestamp)
      expect(renumbered).toMatchObject({ material: true, lesson: { lessonNumber: 10, version: 2 } })
    })

    it('keeps a stored lessonNumber when a save leaves the field out', () => {
      const first = applyLessonAuditMetadata(null, numbered, timestamp).lesson
      const { lessonNumber: _omitted, ...withoutNumber } = first

      const noOp = applyLessonAuditMetadata(first, withoutNumber, '2026-07-25T13:00:00.000Z')
      expect(noOp.material).toBe(false)
      expect(noOp.lesson.lessonNumber).toBe(9)

      const contentChange = applyLessonAuditMetadata(
        first,
        { ...withoutNumber, title: 'Audit renamed' },
        '2026-07-25T13:00:00.000Z'
      )
      expect(contentChange).toMatchObject({
        material: true,
        lesson: { lessonNumber: 9, title: 'Audit renamed', version: 2 },
      })
    })

    it('clears a stored lessonNumber on an explicit null', () => {
      const first = applyLessonAuditMetadata(null, numbered, timestamp).lesson
      const cleared = applyLessonAuditMetadata(first, { ...first, lessonNumber: null }, timestamp)
      expect(cleared.material).toBe(true)
      expect(cleared.lesson.lessonNumber).toBeNull()
    })

    it('does not invent a lessonNumber for a lesson that never had one', () => {
      const first = applyLessonAuditMetadata(null, lesson, timestamp).lesson
      expect('lessonNumber' in first).toBe(false)
      const next = applyLessonAuditMetadata(first, { ...first, title: 'Changed' }, timestamp)
      expect('lessonNumber' in next.lesson).toBe(false)
    })
  })
})
