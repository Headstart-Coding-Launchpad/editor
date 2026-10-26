// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  gradeItem,
  gradeTask,
  realOrAiBadgeResult,
  revealInfo,
  rightCount,
  solutionFor,
  summaryText,
  tellLabel,
  tellNote,
  validateRealOrAiTask,
} from '../real_or_ai.js'
import definition from '../definition.js'

const TASK = {
  id: 1,
  taskType: 'activity',
  activityType: 'real_or_ai',
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
    },
    { id: 'p3', kind: 'text', a: 'x', b: 'y', answer: 'b' },
  ],
}

const tapped = (pick) => ({ pick, done: true })

describe('validateRealOrAiTask', () => {
  it('accepts a valid task and the default task', () => {
    expect(validateRealOrAiTask(TASK, 1)).toEqual([])
    expect(definition.validateTask(definition.defaultTask({ id: 1 }), { n: 1 }).errors).toEqual([])
  })

  it('still accepts old lessons that carry a tells list and tell options', () => {
    const old = { ...TASK, tells: ['hands', 'too_smooth'] }
    expect(validateRealOrAiTask(old, 1)).toEqual([])
    expect(validateRealOrAiTask({ tells: ['x'], items: TASK.items }, 1)).toEqual([])
  })

  it('reports task-level mistakes', () => {
    expect(validateRealOrAiTask({ items: [] }, 2)).toEqual([
      'Task 2: real_or_ai task needs at least one item.',
    ])
    expect(validateRealOrAiTask({ ...TASK, coreItems: 9 }, 2)).toEqual([
      'Task 2: coreItems must be a whole number from 1 to 3 (the number of items).',
    ])
    expect(validateRealOrAiTask({ ...TASK, coreItems: 2 }, 2)).toEqual([])
  })

  it('reports each item mistake', () => {
    expect(
      validateRealOrAiTask(
        {
          items: [
            { id: 'a', a: 'p', b: 'q', answer: 'a' },
            {
              id: 'a',
              kind: 'video',
              a: '',
              answer: 'c',
              tell: 5,
              reliable: 'yes',
              reveal: 7,
              altA: 5,
            },
            { a: 'p', b: 'q', answer: 'b' },
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
      'Task 3 item 2: tell must be text.',
      'Task 3 item 2: reliable must be true or false.',
      'Task 3 item 2: reveal must be text.',
      'Task 3 item 2: altA must be text.',
      'Task 3 item 3: needs an id.',
    ])
  })
})

describe('grading', () => {
  const [photo, text] = TASK.items

  it('marks a pair the moment it is tapped', () => {
    expect(gradeItem(TASK, photo, {})).toEqual({
      done: false,
      correct: false,
      hint: 'Tap the one you think the AI made.',
    })
    expect(gradeItem(TASK, photo, tapped('b'))).toEqual({ done: true, correct: true, hint: null })
    expect(gradeItem(TASK, photo, tapped('a'))).toMatchObject({ done: true, correct: false })
    // Old saved state with a tell is read the same way.
    expect(gradeItem(TASK, photo, { pick: 'b', tell: 'hands', done: true }).correct).toBe(true)
    expect(gradeItem(TASK, photo, { pick: '', done: true }).done).toBe(false)
  })

  it('writes the tell note as a short sentence', () => {
    expect(tellNote(photo)).toBe("The tell: Hands. Don't rely on it by itself.")
    expect(tellNote(text)).toBe('The tell: Too smooth. It is a fair clue to look for.')
    expect(tellNote({ tell: 'Odd lighting' })).toBe('The tell: Odd lighting.')
    expect(tellNote(TASK.items[2])).toBe('')
  })

  it('writes the reveal: tick or cross plus a word, the AI side, the note', () => {
    const right = revealInfo(TASK, photo, tapped('b'))
    expect(right).toMatchObject({
      correct: true,
      mark: '✓',
      verdict: 'Right!',
      aiLine: 'B is the AI one.',
      reveal: 'Newer models get hands right.',
    })
    const wrong = revealInfo(TASK, text, tapped('b'))
    expect(wrong).toMatchObject({ correct: false, mark: '✗', verdict: 'Not this time' })
    expect(revealInfo(TASK, photo, { pick: 'b', done: false })).toBeNull()
  })

  it('grades the whole task against the core', () => {
    const half = { v: 1, items: { p1: tapped('b'), p2: { pick: '', done: false } } }
    expect(gradeTask(TASK, half)).toEqual({
      total: 3,
      core: 3,
      done: 1,
      correct: 1,
      finished: false,
      passed: false,
    })
    const core2 = { ...TASK, coreItems: 2 }
    const two = { v: 1, items: { p1: tapped('a'), p2: tapped('b') } }
    expect(gradeTask(core2, two)).toMatchObject({ core: 2, done: 2, correct: 0, passed: true })
    expect(gradeTask(core2, two).finished).toBe(false)
  })

  it('keeps a right count that never goes down', () => {
    expect(rightCount(TASK, { v: 1, right: 4, items: {} })).toBe(4)
    expect(rightCount(TASK, { v: 1, items: { p1: tapped('b') } })).toBe(1)
    expect(rightCount(TASK, { v: 1, right: 0, items: { p1: tapped('b'), p2: tapped('a') } })).toBe(
      2
    )
    expect(rightCount(TASK, null)).toBe(0)
  })

  it('implements the definition', () => {
    const half = { v: 1, items: { p1: tapped('b') } }
    expect(definition.grade(TASK, half)).toMatchObject({
      passed: false,
      suggestion: 'Tap the one you think the AI made.',
      itemResults: { p1: true, p2: false, p3: false },
    })
    expect(definition.getProgress(TASK, half)).toEqual({
      kind: 'items',
      filled: 1,
      total: 3,
      correct: 1,
      bonus: 0,
    })
    // A wrong pick still counts: the score is reported separately.
    const wrong = { v: 1, items: { p1: tapped('a'), p2: tapped('b'), p3: tapped('a') } }
    expect(definition.grade(TASK, wrong).passed).toBe(true)
    expect(definition.getProgress(TASK, wrong).correct).toBe(0)
    expect(definition.grade(TASK, definition.solutionState(TASK)).passed).toBe(true)
    expect(solutionFor(TASK, text)).toEqual({ pick: 'a', done: true })
  })

  it('reports bonus pairs after the core', () => {
    const task = { ...TASK, coreItems: 1 }
    const state = { v: 1, items: { p1: tapped('b'), p2: tapped('a') } }
    expect(definition.getProgress(task, state)).toEqual({
      kind: 'items',
      filled: 1,
      total: 1,
      correct: 1,
      bonus: 1,
    })
    expect(definition.grade(task, { v: 1, items: { p1: tapped('a') } }).passed).toBe(true)
  })

  it('starts with a zero right count and no picks', () => {
    expect(definition.initialState(TASK)).toEqual({
      v: 1,
      right: 0,
      items: {
        p1: { pick: '', done: false },
        p2: { pick: '', done: false },
        p3: { pick: '', done: false },
      },
    })
    expect(definition.solutionState(TASK).right).toBe(3)
  })

  it('summarises for the teacher card as done and right', () => {
    expect(summaryText(TASK, definition.initialState(TASK))).toBe('0/3 done · 0 right')
    const live = { v: 1, items: { p1: tapped('b'), p2: tapped('b') } }
    expect(summaryText(TASK, live)).toBe('2/3 done · 1 right')
    expect(summaryText({ ...TASK, coreItems: 1 }, live)).toBe('1/1 done · +1 bonus · 1 right')
    expect(definition.summarize(TASK, definition.solutionState(TASK))).toEqual({
      text: '3/3 done · 3 right',
      tone: 'success',
    })
  })

  it('labels tells', () => {
    expect(tellLabel('text_in_image')).toBe('Text in image')
    expect(tellLabel('Odd lighting')).toBe('Odd lighting')
  })

  it('treats every change as discrete and completes itself', () => {
    expect(definition.classifyChange({}, {}, TASK)).toBe('discrete')
    expect(definition.completion).toBe('auto')
  })

  it('reports per-item results from the latest attempts', () => {
    const attempt = (state) => ({ distinctAttempts: [{ submission: JSON.stringify(state) }] })
    const task = { ...TASK, items: TASK.items.slice(0, 2) }
    const fields = definition.report.summaryFields(task, [
      attempt({ v: 1, items: { p1: tapped('b'), p2: tapped('b') } }),
      attempt({ v: 1, items: { p1: tapped('a'), p2: tapped('a') } }),
    ])
    expect(fields.itemResults).toEqual([
      { itemId: 'p1', tell: 'hands', reliable: false, revealed: 2, rightPick: 1 },
      { itemId: 'p2', tell: 'too_smooth', reliable: true, revealed: 2, rightPick: 1 },
    ])
    expect(definition.report.summaryFields(TASK, [])).toEqual({})
  })
})

describe('realOrAiBadgeResult', () => {
  const state = (picks) => ({
    v: 1,
    items: Object.fromEntries(picks.map(([id, pick]) => [id, tapped(pick)])),
  })

  it('counts the core pairs done and right', () => {
    const all = state([
      ['p1', 'b'],
      ['p2', 'a'],
      ['p3', 'b'],
    ])
    expect(realOrAiBadgeResult(TASK, all)).toEqual({ core: 3, tries: 3, right: 3 })
    const oneWrong = state([
      ['p1', 'a'],
      ['p2', 'a'],
      ['p3', 'b'],
    ])
    expect(definition.badgeResult(TASK, oneWrong)).toEqual({ core: 3, tries: 3, right: 2 })
  })

  it('leaves the bonus pairs out, and reads an empty state', () => {
    const core2 = { ...TASK, coreItems: 2 }
    const bonusWrong = state([
      ['p1', 'b'],
      ['p2', 'a'],
      ['p3', 'a'],
    ])
    expect(realOrAiBadgeResult(core2, bonusWrong)).toEqual({ core: 2, tries: 2, right: 2 })
    expect(realOrAiBadgeResult(TASK, undefined)).toEqual({ core: 3, tries: 0, right: 0 })
  })
})
