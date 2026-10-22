// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  firstOpenIndex,
  gradeItem,
  gradeTask,
  revealLines,
  solutionFor,
  summaryText,
  tellLabel,
  validateRealOrAiTask,
} from '../real_or_ai.js'
import definition from '../definition.js'

const TASK = {
  id: 1,
  taskType: 'activity',
  activityType: 'real_or_ai',
  tells: ['hands', 'too_smooth', 'none_reliable'],
  items: [
    {
      id: 'p1',
      kind: 'image',
      a: 'images/real-1.jpg',
      b: 'images/ai-1.jpg',
      answer: 'b',
      tell: 'hands',
      reliable: false,
      reveal: 'Newer models get hands right.',
    },
    {
      id: 'p2',
      kind: 'text',
      a: 'Human text',
      b: 'Robot text',
      answer: 'a',
      tell: 'too_smooth',
      reliable: true,
      reveal: 'Very even wording.',
    },
  ],
}

const done = (pick, tell) => ({ pick, tell, done: true })

describe('validateRealOrAiTask', () => {
  it('accepts a valid task and the default task', () => {
    expect(validateRealOrAiTask(TASK, 1)).toEqual([])
    expect(definition.validateTask(definition.defaultTask({ id: 1 }), { n: 1 }).errors).toEqual([])
  })

  it('reports task-level mistakes', () => {
    expect(validateRealOrAiTask({ tells: ['x'], items: [] }, 2)).toEqual([
      'Task 2: tells needs at least two entries.',
      'Task 2: real_or_ai task needs at least one item.',
    ])
    expect(validateRealOrAiTask({ tells: ['x', 'x', ' '], items: TASK.items }, 2)).toEqual([
      'Task 2: tell "x" is listed more than once.',
      'Task 2: tell 3 must be a non-empty string.',
      'Task 2 item 1: tell "hands" is not in the task\'s tells list.',
      'Task 2 item 2: tell "too_smooth" is not in the task\'s tells list.',
    ])
  })

  it('reports each item mistake', () => {
    expect(
      validateRealOrAiTask(
        {
          tells: ['x', 'y'],
          items: [
            { id: 'a', a: 'p', b: 'q', answer: 'a', tell: 'x', reliable: true, reveal: 'r' },
            {
              id: 'a',
              kind: 'video',
              a: '',
              answer: 'c',
              tell: 'x',
              reliable: 'yes',
              reveal: ' ',
              altA: 5,
            },
            { a: 'p', b: 'q', answer: 'b', reliable: false, reveal: 'r' },
          ],
        },
        3
      )
    ).toEqual([
      'Task 3 item 2: id "a" is used more than once.',
      'Task 3 item 2: kind must be image or text.',
      'Task 3 item 2: a is required.',
      'Task 3 item 2: b is required.',
      'Task 3 item 2: answer must be a or b.',
      'Task 3 item 2: reliable must be true or false.',
      'Task 3 item 2: reveal is required.',
      'Task 3 item 2: altA must be text.',
      'Task 3 item 3: needs an id.',
      'Task 3 item 3: tell is required.',
    ])
  })
})

describe('grading', () => {
  const [photo, text] = TASK.items

  it('tells the student what is still to do', () => {
    expect(gradeItem(TASK, photo, {}).hint).toMatch(/Pick the picture or text/)
    expect(gradeItem(TASK, photo, { pick: 'b' }).hint).toMatch(/clue that gave it away/)
    expect(gradeItem(TASK, photo, { pick: 'b', tell: 'hands' }).hint).toMatch(/Press Reveal/)
    expect(gradeItem(TASK, photo, { pick: 'b', tell: 'hands' }).done).toBe(false)
  })

  it('marks the pick and the clue separately once revealed', () => {
    expect(gradeItem(TASK, photo, done('b', 'hands'))).toEqual({
      done: true,
      correct: true,
      tellMatches: true,
      hint: null,
    })
    expect(gradeItem(TASK, photo, done('a', 'too_smooth'))).toMatchObject({
      done: true,
      correct: false,
      tellMatches: false,
    })
    expect(gradeItem(TASK, text, done('a', 'hands'))).toMatchObject({
      correct: true,
      tellMatches: false,
    })
  })

  it('writes plain reveal lines', () => {
    const right = revealLines(TASK, photo, done('b', 'hands'))
    expect(right.pickLine).toBe('Yes! B is the AI one.')
    expect(right.tellLine).toBe('Your clue matches: Hands.')
    expect(right.reliableLine).toMatch(/not a reliable clue/)
    expect(right.reveal).toBe('Newer models get hands right.')
    const wrong = revealLines(TASK, text, done('b', 'hands'))
    expect(wrong.pickLine).toBe('Not this time. A is the AI one.')
    expect(wrong.tellLine).toMatch(/You said "Hands"/)
    expect(wrong.reliableLine).toMatch(/is a reliable clue/)
    expect(revealLines(TASK, photo, { pick: 'b', tell: 'hands' })).toBeNull()
  })

  it('grades the whole task and the definition', () => {
    const half = { v: 1, items: { p1: done('b', 'hands'), p2: { pick: 'a', tell: '' } } }
    expect(gradeTask(TASK, half)).toEqual({
      total: 2,
      done: 1,
      correct: 1,
      tellsMatched: 1,
      finished: false,
    })
    expect(definition.grade(TASK, half)).toMatchObject({
      passed: false,
      suggestion: 'Now pick the clue that gave it away.',
      itemResults: { p1: true, p2: false },
    })
    expect(definition.getProgress(TASK, half)).toEqual({
      kind: 'items',
      filled: 1,
      total: 2,
      correct: 1,
    })
    // A wrong pick still finishes the task: the score is reported separately.
    const wrong = { v: 1, items: { p1: done('a', 'hands'), p2: done('b', 'hands') } }
    expect(definition.grade(TASK, wrong).passed).toBe(true)
    expect(definition.getProgress(TASK, wrong).correct).toBe(0)
    expect(definition.grade(TASK, definition.solutionState(TASK)).passed).toBe(true)
    expect(solutionFor(TASK, text)).toEqual({ pick: 'a', tell: 'too_smooth', done: true })
  })

  it('summarises for the teacher card, including the pair in progress', () => {
    const start = definition.initialState(TASK)
    expect(summaryText(TASK, start)).toBe('0/0 right so far')
    const live = { v: 1, items: { p1: done('b', 'hands'), p2: { pick: 'b', tell: 'too_smooth' } } }
    expect(summaryText(TASK, live)).toBe('1/1 right so far, item 2: picked B, Too smooth')
    expect(firstOpenIndex(TASK, live)).toBe(1)
    expect(definition.summarize(TASK, definition.solutionState(TASK))).toEqual({
      text: '2/2 right',
      tone: 'success',
    })
  })

  it('labels clues', () => {
    expect(tellLabel('text_in_image')).toBe('Text in image')
    expect(tellLabel('Odd lighting')).toBe('Odd lighting')
  })

  it('treats every change as discrete and completes itself', () => {
    expect(definition.classifyChange({}, {}, TASK)).toBe('discrete')
    expect(definition.completion).toBe('auto')
  })

  it('reports per-item results from the latest attempts', () => {
    const attempt = (state) => ({ distinctAttempts: [{ submission: JSON.stringify(state) }] })
    const fields = definition.report.summaryFields(TASK, [
      attempt({ v: 1, items: { p1: done('b', 'hands'), p2: done('b', 'hands') } }),
      attempt({ v: 1, items: { p1: done('a', 'hands'), p2: done('a', 'too_smooth') } }),
    ])
    expect(fields.itemResults).toEqual([
      { itemId: 'p1', tell: 'hands', reliable: false, revealed: 2, rightPick: 1, tellMatch: 2 },
      { itemId: 'p2', tell: 'too_smooth', reliable: true, revealed: 2, rightPick: 1, tellMatch: 1 },
    ])
    expect(definition.report.summaryFields(TASK, [])).toEqual({})
  })
})
