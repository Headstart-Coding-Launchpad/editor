import { describe, expect, it } from 'vitest'
import { formatTaskItemProgress, getTaskItemProgress } from '../taskItemProgress'

const matchTask = {
  taskType: 'quiz',
  quizType: 'match',
  pairs: [
    { id: 'p1', prompt: 'print', answer: 'shows text' },
    { id: 'p2', prompt: 'input', answer: 'asks a question' },
    { id: 'p3', prompt: 'len', answer: 'counts' },
  ],
}

const dragBlankTask = {
  taskType: 'quiz',
  quizType: 'fill_blank',
  mode: 'drag',
  blanks: [
    { id: 'b1', answer: 'print' },
    { id: 'b2', answer: 'input' },
  ],
  distractors: [{ id: 'd1', text: 'len' }],
}

const typedBlankTask = {
  taskType: 'quiz',
  quizType: 'fill_blank',
  mode: 'type',
  blanks: [
    { id: 'b1', answer: 'Print' },
    { id: 'b2', answer: 'input' },
    { id: 'b3', answer: 'for' },
  ],
}

describe('getTaskItemProgress', () => {
  it('counts filled and correct match pairs, including half-finished answers', () => {
    const progress = getTaskItemProgress(matchTask, {
      currentAnswer: JSON.stringify({ p1: 'p1', p2: 'p3' }),
    })
    expect(progress).toEqual({ kind: 'match', filled: 2, total: 3, correct: 1 })
    expect(formatTaskItemProgress(progress)).toBe('2/3 filled · 1 correct')
  })

  it('counts dragged fill-in-the-gaps tiles, including distractors as wrong', () => {
    expect(getTaskItemProgress(dragBlankTask, { currentAnswer: { b1: 'b1', b2: 'd1' } })).toEqual({
      kind: 'fill_blank',
      filled: 2,
      total: 2,
      correct: 1,
    })
  })

  it('ignores blank typed answers and matches typed text case-insensitively', () => {
    expect(
      getTaskItemProgress(typedBlankTask, {
        currentAnswer: JSON.stringify({ b1: ' print ', b2: '   ', b3: 'while' }),
      })
    ).toEqual({ kind: 'fill_blank', filled: 2, total: 3, correct: 1 })
  })

  it('reports zero progress before the student has answered anything', () => {
    expect(getTaskItemProgress(matchTask, { currentAnswer: null })).toEqual({
      kind: 'match',
      filled: 0,
      total: 3,
      correct: 0,
    })
  })

  it('reports only a filled count for code arrange tasks', () => {
    const task = {
      taskType: 'code_arrange',
      lines: [
        {
          parts: [
            { type: 'slot', id: 's1', code: 'print' },
            { type: 'text', text: '(' },
          ],
        },
        { parts: [{ type: 'slot', id: 's2', code: 'x' }] },
      ],
    }
    const progress = getTaskItemProgress(task, { currentCodeArrangeSlots: { s1: 's2' } })
    expect(progress).toEqual({ kind: 'code_arrange', filled: 1, total: 2, correct: null })
    expect(formatTaskItemProgress(progress)).toBe('1/2 slots filled')
  })

  it('returns null for task types without countable items', () => {
    expect(getTaskItemProgress({ taskType: 'quiz', quizType: 'multiple_choice' }, {})).toBeNull()
    expect(getTaskItemProgress({ starterCode: 'print(1)' }, {})).toBeNull()
    expect(getTaskItemProgress(null, {})).toBeNull()
  })
})
