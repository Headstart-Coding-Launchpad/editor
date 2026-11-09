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

  it('never gives an id-less option a letter another option already uses', () => {
    const task = { options: ['Yes', { id: 'a', text: 'No' }, { text: 'Maybe' }] }
    const ids = withQuizOptionObjects(task).options.map((option) => option.id)
    expect(ids).toEqual(['b', 'a', 'c'])
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keeps the stored correct answer selected when it was the option text', () => {
    const task = {
      options: ['Red', 'Blue'],
      check: { type: 'answer_equals', value: 'Blue' },
    }
    const next = withQuizOptionObjects(task)
    expect(next.options).toEqual([
      { id: 'a', text: 'Red' },
      { id: 'b', text: 'Blue' },
    ])
    expect(next.check).toEqual({ type: 'answer_equals', value: 'b' })
  })

  it('leaves a stored answer that is already an option id alone', () => {
    const task = { options: ['Yes', 'No'], check: { type: 'answer_equals', value: 'b' } }
    expect(withQuizOptionObjects(task).check).toEqual({ type: 'answer_equals', value: 'b' })
  })

  it('returns the same task when the options are already objects, or there are none', () => {
    const fine = { options: [{ id: 'a', text: 'Yes' }] }
    expect(withQuizOptionObjects(fine)).toBe(fine)
    const none = { title: 'Code' }
    expect(withQuizOptionObjects(none)).toBe(none)
  })
})
