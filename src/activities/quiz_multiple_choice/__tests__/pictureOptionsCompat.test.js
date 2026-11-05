import { describe, expect, it } from 'vitest'
import { validateQuizTask } from '../../legacyValidation.js'
import definition from '../definition.js'
import pollDefinition from '../../quiz_poll/definition.js'
import { getQuizOptionText } from '../../../app/components/quiz/quizUtils.js'
import { switchQuizType } from '../../quiz/quizBuilder.js'
import {
  countGraphemes,
  countGraphemesFallback,
  isSingleEmoji,
} from '../../../shared/quizPictureOptions.js'

// Round 2 of the picture-options review: word-only quizzes read exactly as before pictures
// existed, the Builder's type switch can be undone, and the picture validation is exact.

const url = (name) => `https://firebasestorage.googleapis.com/v0/b/x/o/${name}.png`
const A = { id: 'a', image: url('a'), alt: 'Red circle on top' }
const B = { id: 'b', emoji: '🦊', alt: 'A fox' }

function validate(task) {
  const errors = []
  const warnings = []
  validateQuizTask(task, { n: 1, errors, warnings })
  return { errors, warnings }
}

// Old (word-only) options as they can be stored: numeric text from YAML, blank, whitespace.
const WORD_OPTIONS = [
  { id: 'a', text: 42 },
  { id: 'b', text: '' },
  { id: 'c', text: '   ' },
  { id: 'd' },
]
const wordTask = (quizType, extra = {}) => ({
  taskType: 'quiz',
  quizType,
  options: WORD_OPTIONS,
  ...extra,
})

describe('word-only options read exactly as before picture options (characterization)', () => {
  it('getQuizOptionText: String() of the text, "" for blank or missing, no trimming', () => {
    const task = wordTask('multiple_choice')
    expect(getQuizOptionText(task, 'a')).toBe('42')
    expect(getQuizOptionText(task, 'b')).toBe('')
    expect(getQuizOptionText(task, 'c')).toBe('   ')
    expect(getQuizOptionText(task, 'd')).toBe('')
    expect(getQuizOptionText(task, 'zz')).toBe('')
  })

  it('multiple-choice summarize keeps the old "Selected answer" fallback and untrimmed text', () => {
    const task = wordTask('multiple_choice')
    expect(definition.summarize(task, 'a').text).toBe('a 42')
    expect(definition.summarize(task, 'b').text).toBe('b Selected answer')
    expect(definition.summarize(task, 'c').text).toBe('c    ')
    expect(definition.summarize(task, 'd').text).toBe('d Selected answer')
    expect(definition.summarize(task, 'zz').text).toBe('zz Selected answer')
  })

  it('poll summarize, report and print read word options as before', () => {
    const task = wordTask('poll')
    expect(pollDefinition.summarize(task, 'a').text).toBe('a 42')
    expect(pollDefinition.summarize(task, 'b').text).toBe('b Selected option')
    expect(pollDefinition.summarize(task, 'c').text).toBe('c    ')
    const multi = wordTask('poll', { multiple: true })
    expect(pollDefinition.summarize(multi, '["a","b","d"]').text).toBe('a 42, b, d')
    const fields = pollDefinition.report.summaryFields(task, [])
    expect(fields.optionDistribution.map((o) => o.text)).toEqual([42, '', '   ', ''])
  })
})

describe('switching quiz type in the Builder can be undone', () => {
  const task = {
    id: 'pic-switch-1',
    taskType: 'quiz',
    quizType: 'multiple_choice',
    options: [
      { ...A, feedback: 'Look again' },
      { ...B, text: 'Fox' },
    ],
    check: { type: 'answer_equals', value: 'a' },
  }

  it('multiple choice -> poll -> multiple choice keeps the pictures', () => {
    const poll = switchQuizType(task, 'poll')
    expect(poll.options.some((o) => o.image || o.emoji || o.alt)).toBe(false)
    expect(validate(poll).errors).toEqual([])
    const back = switchQuizType(poll, 'multiple_choice')
    expect(back.options).toEqual(task.options)
  })

  it('multiple choice -> confidence (no options) -> multiple choice keeps the pictures', () => {
    const back = switchQuizType(switchQuizType(task, 'confidence'), 'multiple_choice')
    expect(back.options).toEqual(task.options)
  })

  it('an option edited on the poll keeps its edit; its picture still comes back', () => {
    const poll = switchQuizType(task, 'poll')
    const edited = {
      ...poll,
      options: poll.options.map((o) => (o.id === 'b' ? { ...o, text: 'Fox cub' } : o)),
    }
    const back = switchQuizType(edited, 'multiple_choice')
    expect(back.options[1]).toEqual({ id: 'b', emoji: '🦊', alt: 'A fox', text: 'Fox cub' })
    // An option whose words were only the alt text gets its empty caption back.
    expect(back.options[0]).toEqual({ id: 'a', image: url('a'), alt: 'Red circle on top' })
  })
})

describe('picture validation is exact', () => {
  it('an empty image or emoji on another quiz type is no picture (a YAML placeholder)', () => {
    const poll = {
      taskType: 'quiz',
      quizType: 'poll',
      options: [
        { id: 'a', text: 'Yes', image: '' },
        { id: 'b', text: 'No', emoji: '' },
      ],
    }
    expect(validate(poll).errors).toEqual([])
    const match = {
      taskType: 'quiz',
      quizType: 'match',
      pairs: [
        { id: 'p1', prompt: 'a', answer: 'b' },
        { id: 'p2', prompt: 'c', answer: 'd' },
      ],
      options: [{ id: 'a', text: 'x', image: '', emoji: '' }],
    }
    expect(validate(match).errors.filter((e) => /picture/.test(e))).toEqual([])
    const withPicture = { ...match, options: [{ id: 'a', text: 'x', emoji: '🦊' }] }
    expect(validate(withPicture).errors.some((e) => /has a picture/.test(e))).toBe(true)
  })

  it('an emoji picture must be one emoji: a letter, digit, "?" or word is an error', () => {
    for (const emoji of ['a', '7', '?', 'abcdefgh', '🦊🐢', 'fox 🦊']) {
      const { errors } = validate({
        taskType: 'quiz',
        quizType: 'multiple_choice',
        options: [A, { id: 'b', emoji, alt: 'x' }],
        check: { type: 'answer_equals', value: 'a' },
      })
      expect(
        errors.some((e) => /option b has/.test(e) && /emoji/.test(e)),
        emoji
      ).toBe(true)
    }
    for (const emoji of ['🦊', '👨‍👩‍👧', '🇬🇧', '👍🏽', '❤️', '1️⃣']) {
      const { errors } = validate({
        taskType: 'quiz',
        quizType: 'multiple_choice',
        options: [A, { id: 'b', emoji, alt: 'x' }],
        check: { type: 'answer_equals', value: 'a' },
      })
      expect(errors, emoji).toEqual([])
    }
  })

  it('the no-Segmenter grapheme count keeps the one-emoji rule', () => {
    expect(countGraphemesFallback('abcdefgh')).toBe(8)
    expect(countGraphemesFallback('🦊')).toBe(1)
    expect(countGraphemesFallback('👨‍👩‍👧')).toBe(1)
    expect(countGraphemesFallback('🇬🇧')).toBe(1)
    expect(countGraphemesFallback('🇬🇧🇫🇷')).toBe(2)
    expect(countGraphemesFallback('👍🏽')).toBe(1)
    expect(countGraphemesFallback('1️⃣')).toBe(1)
    expect(countGraphemesFallback('🦊🐢')).toBe(2)
    expect(countGraphemes('👨‍👩‍👧')).toBe(1)
    expect(isSingleEmoji('abcdefgh')).toBe(false)
    expect(isSingleEmoji('🦊')).toBe(true)
  })
})
