import { describe, expect, it } from 'vitest'
import { applyCopyCodeOverrides, effectiveCopyCode } from '../copyCodeOverrides'

const lesson = {
  tasks: [
    { id: 'a', copyCode: 'print(1)' },
    { id: 'g', type: 'group', subtasks: [{ id: 'b', copyCode: 'print(2)' }] },
  ],
}

describe('copyCodeOverrides', () => {
  it('prefers the student text, then the class text, then the lesson', () => {
    const task = lesson.tasks[0]
    expect(effectiveCopyCode(task, { a: 'class' }, { a: 'mine' })).toBe('mine')
    expect(effectiveCopyCode(task, { a: 'class' }, {})).toBe('class')
    expect(effectiveCopyCode(task, {}, {})).toBe('print(1)')
  })

  it('treats an empty string as a deliberate blank (hides the panel)', () => {
    expect(effectiveCopyCode(lesson.tasks[0], { a: '' }, null)).toBe('')
  })

  it('patches tasks inside groups and returns the same lesson when nothing applies', () => {
    expect(applyCopyCodeOverrides(lesson, null, null)).toBe(lesson)
    const next = applyCopyCodeOverrides(lesson, { b: 'x' }, { a: 'y' })
    expect(next.tasks[0].copyCode).toBe('y')
    expect(next.tasks[1].subtasks[0].copyCode).toBe('x')
  })
})
