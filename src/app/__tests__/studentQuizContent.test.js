// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { buildQuizSubmission, getQuizSuggestion } from '../studentQuizContent'
import {
  CONFIDENCE_TASK,
  FILL_BLANK_DRAG_TASK,
  FILL_BLANK_TYPE_TASK,
  MATCH_TASK,
  MULTIPLE_CHOICE_TASK,
  OPEN_SHORT_ANSWER_TASK,
  SHORT_ANSWER_TASK,
} from '../../test/fixtures/legacyActivityTasks'

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
      const task = {
        quizType: 'multiple_choice',
        options: [{ id: 'x' }],
        check: { hint: 'use check hint' },
      }
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
    expect(buildQuizSubmission({ quizType: 'short_answer' }, 'I think print shows text')).toBe(
      'I think print shows text'
    )
  })
})

// Phase 0 characterisation (docs/architecture/modular-activities-plan.md step 0.3):
// pins today's submission/suggestion shapes per quiz sub-type using the shared
// legacy fixtures, before quiz moves onto the Activity plugin contract.
describe('characterisation: legacy quiz fixtures', () => {
  it('multiple_choice submits the raw option id (string-coerced) and suggests option feedback', () => {
    expect(buildQuizSubmission(MULTIPLE_CHOICE_TASK, 'b')).toBe('b')
    expect(buildQuizSubmission(MULTIPLE_CHOICE_TASK, null)).toBe('')
    expect(buildQuizSubmission(MULTIPLE_CHOICE_TASK, { a: 1 })).toBe('[object Object]')
    expect(getQuizSuggestion(MULTIPLE_CHOICE_TASK, 'b')).toBe('input() asks the user a question.')
    // Option c has no feedback/hint and the task has no feedback: falls to check.hint.
    expect(getQuizSuggestion(MULTIPLE_CHOICE_TASK, 'c')).toBe('Think about showing text.')
    expect(getQuizSuggestion(MULTIPLE_CHOICE_TASK, 'zzz')).toBe('Think about showing text.')
  })

  it('match submits per-pair detail from an object or its JSON string, and suggests task feedback', () => {
    const answer = { p1: 'p1', p2: 'p3' }
    const expected = {
      p1: { prompt: 'print()', value: 'Shows text', expected: 'Shows text', correct: true },
      p2: { prompt: 'input()', value: 'Counts items', expected: 'Asks a question', correct: false },
      p3: { prompt: 'len()', value: '', expected: 'Counts items', correct: false },
    }
    expect(buildQuizSubmission(MATCH_TASK, answer)).toEqual(expected)
    expect(buildQuizSubmission(MATCH_TASK, JSON.stringify(answer))).toEqual(expected)
    // An unknown placed id is reported verbatim as the value.
    expect(buildQuizSubmission(MATCH_TASK, { p1: 'ghost' }).p1).toEqual({
      prompt: 'print()',
      value: 'ghost',
      expected: 'Shows text',
      correct: false,
    })
    expect(getQuizSuggestion(MATCH_TASK, answer)).toBe('Check each pair again.')
  })

  it('fill_blank drag maps tile ids to tile text; unfilled blanks are empty strings', () => {
    expect(buildQuizSubmission(FILL_BLANK_DRAG_TASK, '{"b1":"b1","b2":"d1"}')).toEqual({
      b1: { value: 'print', expected: 'print', correct: true },
      b2: { value: 'len', expected: 'input', correct: false },
    })
    expect(buildQuizSubmission(FILL_BLANK_DRAG_TASK, '')).toEqual({
      b1: { value: '', expected: 'print', correct: false },
      b2: { value: '', expected: 'input', correct: false },
    })
    // A dragged tile id that is not in the pool is kept verbatim (drag mode is
    // an exact text comparison, so a raw id that equals the answer passes).
    expect(buildQuizSubmission(FILL_BLANK_DRAG_TASK, { b1: 'print' }).b1).toEqual({
      value: 'print',
      expected: 'print',
      correct: true,
    })
    expect(getQuizSuggestion(FILL_BLANK_DRAG_TASK, {})).toBe('')
  })

  it('fill_blank type mode keeps raw text and compares trimmed + case-insensitively', () => {
    expect(buildQuizSubmission(FILL_BLANK_TYPE_TASK, { t1: '  loop ' })).toEqual({
      t1: { value: '  loop ', expected: 'Loop', correct: true },
    })
    expect(buildQuizSubmission(FILL_BLANK_TYPE_TASK, { t1: 'loops' })).toEqual({
      t1: { value: 'loops', expected: 'Loop', correct: false },
    })
  })

  it('short_answer submits text and suggests the first failing check hint', () => {
    expect(buildQuizSubmission(SHORT_ANSWER_TASK, 'It shows text')).toBe('It shows text')
    expect(buildQuizSubmission(SHORT_ANSWER_TASK, 42)).toBe('42')
    expect(buildQuizSubmission(SHORT_ANSWER_TASK, undefined)).toBe('')
    expect(getQuizSuggestion(SHORT_ANSWER_TASK, 'It prints')).toBe('Mention what print shows.')
    expect(getQuizSuggestion(SHORT_ANSWER_TASK, 'It shows text')).toBe('')
    expect(getQuizSuggestion(OPEN_SHORT_ANSWER_TASK, 'anything')).toBe('')
  })

  it('confidence submits an integer 1-10, otherwise the raw answer unchanged', () => {
    expect(buildQuizSubmission(CONFIDENCE_TASK, '3')).toBe(3)
    expect(buildQuizSubmission(CONFIDENCE_TASK, 5)).toBe(5)
    expect(buildQuizSubmission(CONFIDENCE_TASK, '10')).toBe(10)
    expect(buildQuizSubmission(CONFIDENCE_TASK, '11')).toBe('11')
    expect(buildQuizSubmission(CONFIDENCE_TASK, '2.5')).toBe('2.5')
    expect(buildQuizSubmission(CONFIDENCE_TASK, '')).toBe('')
    expect(getQuizSuggestion(CONFIDENCE_TASK, '3')).toBe('')
  })

  it('an unknown quizType falls through to string coercion and task feedback', () => {
    const task = { quizType: 'mystery', feedback: ' Try again ' }
    expect(buildQuizSubmission(task, { x: 1 })).toBe('[object Object]')
    expect(getQuizSuggestion(task, 'x')).toBe('Try again')
  })
})
