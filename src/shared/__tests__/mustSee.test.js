import { describe, expect, it } from 'vitest'
import { findSkippedMustSeeTask } from '../mustSee.js'

const tasks = [{ id: 1 }, { id: 2, title: 'See the error', mustSee: true }, { id: 3 }, { id: 4 }]

describe('findSkippedMustSeeTask', () => {
  it('finds a must-see task jumped over, from Next-Next or the task list', () => {
    expect(findSkippedMustSeeTask(tasks, 1, 3, {})?.id).toBe(2)
    expect(findSkippedMustSeeTask(tasks, 1, 4, { 1: 5 })?.id).toBe(2)
  })

  it('does not warn when moving onto the must-see task itself', () => {
    expect(findSkippedMustSeeTask(tasks, 1, 2, {})).toBeNull()
  })

  it('is cleared once the class has been on the task', () => {
    expect(findSkippedMustSeeTask(tasks, 1, 4, { 2: 123 })).toBeNull()
  })

  it('ignores backward moves, the task being left and unknown ids', () => {
    expect(findSkippedMustSeeTask(tasks, 4, 1, {})).toBeNull()
    expect(findSkippedMustSeeTask(tasks, 2, 4, {})).toBeNull()
    expect(findSkippedMustSeeTask(tasks, 1, 99, {})).toBeNull()
  })
})
