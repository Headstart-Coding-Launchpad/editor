import { describe, expect, it } from 'vitest'
import { withQuizOptionObjects } from '../quizBuilder.js'

describe('withQuizOptionObjects (old string-shaped quiz options)', () => {
  it('turns strings and numbers into lettered {id, text} options and skips the rest', () => {
    const task = { id: 1, options: ['Yes', 42, null, ['x'], { text: 'Maybe' }] }
    expect(withQuizOptionObjects(task).options).toEqual([
      { id: 'a', text: 'Yes' },
      { id: 'b', text: '42' },
      { id: 'c', text: 'Maybe' },
    ])
  })

  it('keeps an object option’s own id and every other field', () => {
    const task = { options: ['Yes', { id: 'z', text: 'No', feedback: 'Nope' }] }
    expect(withQuizOptionObjects(task).options).toEqual([
      { id: 'a', text: 'Yes' },
      { id: 'z', text: 'No', feedback: 'Nope' },
    ])
  })

  it('returns the same task when the options are already objects, or there are none', () => {
    const fine = { options: [{ id: 'a', text: 'Yes' }] }
    expect(withQuizOptionObjects(fine)).toBe(fine)
    const none = { title: 'Code' }
    expect(withQuizOptionObjects(none)).toBe(none)
  })
})
