import { describe, expect, it } from 'vitest'
import { buildQuizSubmission, getQuizSuggestion } from '../studentQuizContent'

const mcTask = {
  quizType: 'multiple_choice',
  options: [
    { id: 'a', text: 'Correct', feedback: 'Well done!' },
    { id: 'b', text: 'Wrong', hint: 'Try again.' },
    { id: 'c', text: 'Also wrong' },
  ],
  feedback: 'Task-level feedback',
  check: { hint: 'Check hint' },
}

const shortAnswerTask = {
  quizType: 'short_answer',
  check: { type: 'output_contains', value: 'hello', hint: 'Check for hello' },
}

const matchTask = {
  quizType: 'match',
  feedback: 'Match feedback',
}

describe('getQuizSuggestion', () => {
  it('returns empty string for null task', () => {
    expect(getQuizSuggestion(null, 'a')).toBe('')
  })

  it('returns empty string for undefined task', () => {
    expect(getQuizSuggestion(undefined, 'a')).toBe('')
  })

  describe('multiple_choice (default)', () => {
    it('returns option feedback when present', () => {
      expect(getQuizSuggestion(mcTask, 'a')).toBe('Well done!')
    })

    it('falls back to option hint when no feedback', () => {
      expect(getQuizSuggestion(mcTask, 'b')).toBe('Try again.')
    })

    it('falls back to task-level feedback when option has neither', () => {
      expect(getQuizSuggestion(mcTask, 'c')).toBe('Task-level feedback')
    })

    it('falls back to check hint when task has no feedback', () => {
      const task = { quizType: 'multiple_choice', options: [{ id: 'x' }], check: { hint: 'use check hint' } }
      expect(getQuizSuggestion(task, 'x')).toBe('use check hint')
    })

    it('returns empty string when no feedback exists at any level', () => {
      const task = { quizType: 'multiple_choice', options: [{ id: 'x' }] }
      expect(getQuizSuggestion(task, 'x')).toBe('')
    })

    it('handles undefined quizType (defaults to multiple_choice)', () => {
      const task = { options: [{ id: 'a', feedback: 'mc fallback' }] }
      expect(getQuizSuggestion(task, 'a')).toBe('mc fallback')
    })
  })

  describe('short_answer', () => {
    it('returns the check hint when the answer does not satisfy the check', () => {
      expect(getQuizSuggestion(shortAnswerTask, 'wrong answer')).toBe('Check for hello')
    })

    it('returns empty string when short_answer task has no check', () => {
      const task = { quizType: 'short_answer', feedback: 'ok' }
      expect(getQuizSuggestion(task, 'anything')).toBe('ok')
    })
  })

  describe('other quiz types (match, fill_blank)', () => {
    it('returns task feedback for match type', () => {
      expect(getQuizSuggestion(matchTask, {})).toBe('Match feedback')
    })

    it('returns check hint when no task feedback', () => {
      const task = { quizType: 'fill_blank', check: { hint: 'fill hint' } }
      expect(getQuizSuggestion(task, [])).toBe('fill hint')
    })
  })
})

describe('buildQuizSubmission', () => {
  it('keeps multiple choice submissions as the selected option id', () => {
    expect(buildQuizSubmission(mcTask, 'b')).toBe('b')
  })

  it('records typed fill-blank detail keyed by blank id', () => {
    const task = {
      quizType: 'fill_blank',
      mode: 'type',
      blanks: [
        { id: 'name', answer: 'Ada' },
        { id: 'age', answer: '12' },
      ],
    }

    expect(buildQuizSubmission(task, { name: 'ada', age: '13' })).toEqual({
      name: { value: 'ada', expected: 'Ada', correct: true },
      age: { value: '13', expected: '12', correct: false },
    })
  })

  it('records drag fill-blank tile text instead of tile ids', () => {
    const task = {
      quizType: 'fill_blank',
      mode: 'drag',
      blanks: [{ id: 'blank-1', answer: 'print' }],
      distractors: [{ id: 'd1', text: 'input' }],
    }

    expect(buildQuizSubmission(task, { 'blank-1': 'd1' })).toEqual({
      'blank-1': { value: 'input', expected: 'print', correct: false },
    })
  })

  it('records match detail keyed by pair id', () => {
    const task = {
      quizType: 'match',
      pairs: [
        { id: 'p1', prompt: 'Shows text', answer: 'print()' },
        { id: 'p2', prompt: 'Gets input', answer: 'input()' },
      ],
    }

    expect(buildQuizSubmission(task, { p1: 'p2', p2: 'p2' })).toEqual({
      p1: { prompt: 'Shows text', value: 'input()', expected: 'print()', correct: false },
      p2: { prompt: 'Gets input', value: 'input()', expected: 'input()', correct: true },
    })
  })

  it('records confidence as a numeric rating', () => {
    expect(buildQuizSubmission({ quizType: 'confidence' }, '4')).toBe(4)
  })

  it('records short answers as text', () => {
    expect(buildQuizSubmission({ quizType: 'short_answer' }, 'I think print shows text')).toBe('I think print shows text')
  })
})
