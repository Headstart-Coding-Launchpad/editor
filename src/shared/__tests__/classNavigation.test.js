import { describe, expect, it } from 'vitest'
import {
  classTaskPosition,
  countOptionalAhead,
  countOptionalTasks,
  nextClassTaskId,
} from '../classNavigation.js'

const tasks = [
  { id: 1, title: 'One' },
  { id: 2, title: 'Two' },
  { id: 3, title: 'Bonus', priority: 'optional' },
  { id: 4, title: 'Four' },
  { id: 5, title: 'Extra', priority: 'optional' },
]

describe('nextClassTaskId', () => {
  it('steps to the next task when skipping is off', () => {
    expect(nextClassTaskId(tasks, 2)).toBe(3)
  })

  it('jumps past optional tasks when skipping is on', () => {
    expect(nextClassTaskId(tasks, 2, { skipOptional: true })).toBe(4)
  })

  it('has no next task when only optional tasks are left', () => {
    expect(nextClassTaskId(tasks, 4, { skipOptional: true })).toBeNull()
    expect(nextClassTaskId(tasks, 5)).toBeNull()
  })

  it('moves on from an optional task the class was moved to by hand', () => {
    expect(nextClassTaskId(tasks, 3, { skipOptional: true })).toBe(4)
  })

  it('has no next task when the class task is unknown (never the first task)', () => {
    expect(nextClassTaskId(tasks, null)).toBeNull()
    expect(nextClassTaskId(tasks, 99)).toBeNull()
    expect(nextClassTaskId(tasks, 99, { skipOptional: true })).toBeNull()
  })
})

describe('optional counts and position', () => {
  it('counts the optional tasks ahead and in the lesson', () => {
    expect(countOptionalAhead(tasks, 2)).toBe(2)
    expect(countOptionalAhead(tasks, 4)).toBe(1)
    expect(countOptionalTasks(tasks)).toBe(2)
  })

  it('numbers the class task among the tasks Next stops on', () => {
    expect(classTaskPosition(tasks, 4)).toEqual({ number: 4, total: 5 })
    expect(classTaskPosition(tasks, 4, { skipOptional: true })).toEqual({ number: 3, total: 3 })
    expect(classTaskPosition(tasks, 3, { skipOptional: true })).toEqual({ number: 3, total: 4 })
  })

  it('has no place and nothing ahead when the class task is unknown', () => {
    expect(classTaskPosition(tasks, null)).toEqual({ number: null, total: 5 })
    expect(classTaskPosition(tasks, 99, { skipOptional: true })).toEqual({
      number: null,
      total: 3,
    })
    expect(countOptionalAhead(tasks, 99)).toBe(0)
  })
})
