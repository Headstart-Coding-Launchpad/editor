// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  gradeItem,
  gradeTask,
  solutionFor,
  validateTemplateActivityTask,
} from '../template_activity.js'
import definition from '../definition.js'

// Pure logic tests for the Template Activity activity. The shared contract (default task
// validates, state round-trips, solution passes) is checked for every registered activity by
// src/activities/__tests__/activityInterface.test.js.
// TODO(new-activity): replace these with tests for the real rules, one per validation message
// and one per hint.

const TASK = {
  id: 1,
  taskType: 'activity',
  activityType: 'template_activity',
  items: [
    { id: 'a', prompt: 'What is 2 + 2?', answer: '4' },
    { id: 'b', prompt: 'Name the colour of grass.', answer: 'Green' },
  ],
}

describe('validateTemplateActivityTask', () => {
  it('accepts a valid task and the default task', () => {
    expect(validateTemplateActivityTask(TASK, 1)).toEqual([])
    expect(definition.validateTask(definition.defaultTask({ id: 1 }), { n: 1 }).errors).toEqual([])
  })

  it('reports each authoring mistake', () => {
    expect(validateTemplateActivityTask({ items: [] }, 2)).toEqual([
      'Task 2: template_activity task needs at least one item.',
    ])
    expect(
      validateTemplateActivityTask(
        {
          items: [
            { id: 'a', prompt: 'Q', answer: '1' },
            { id: 'a', prompt: '', answer: '' },
            { prompt: 'Q', answer: '1' },
          ],
        },
        3
      )
    ).toEqual([
      'Task 3 item 2: id "a" is used more than once.',
      'Task 3 item 2: prompt is required.',
      'Task 3 item 2: answer is required.',
      'Task 3 item 3: needs an id.',
    ])
  })
})

describe('grading', () => {
  it('marks answers ignoring case and spaces, with a hint when wrong', () => {
    const [, grass] = TASK.items
    expect(solutionFor(TASK, grass)).toEqual({ answer: 'Green' })
    expect(gradeItem(TASK, grass, { answer: '  green ' })).toEqual({ correct: true, hint: null })
    expect(gradeItem(TASK, grass, {})).toEqual({ correct: false, hint: 'Type your answer first.' })
    expect(gradeItem(TASK, grass, { answer: 'blue' }).hint).toMatch(/Not quite/)
  })

  it('summarises a whole task and grades through the definition', () => {
    const half = { v: 1, items: { a: { answer: '4' }, b: { answer: '' } } }
    expect(gradeTask(TASK, half)).toEqual({ total: 2, correct: 1, done: false })
    expect(definition.grade(TASK, half)).toMatchObject({
      passed: false,
      suggestion: 'Type your answer first.',
      itemResults: { a: true, b: false },
    })
    expect(definition.grade(TASK, definition.solutionState(TASK)).passed).toBe(true)
    expect(definition.summarize(TASK, half)).toEqual({ text: '1/2 correct', tone: 'neutral' })
  })

  it('classifies typing as continuous', () => {
    const before = definition.initialState(TASK)
    const after = { ...before, items: { ...before.items, a: { answer: '4' } } }
    expect(definition.classifyChange(before, after)).toBe('continuous')
    expect(definition.classifyChange(before, before)).toBe('discrete')
  })
})
