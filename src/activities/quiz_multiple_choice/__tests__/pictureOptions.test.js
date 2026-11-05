import { describe, expect, it } from 'vitest'
import { validateQuizTask } from '../../legacyValidation.js'
import definition from '../definition.js'
import { getQuizOptionText } from '../../../app/components/quiz/quizUtils.js'
import { quizOptionLabel } from '../../../shared/quizPictureOptions.js'

const url = (name) => `https://firebasestorage.googleapis.com/v0/b/x/o/${name}.png`

function picTask(options, extra = {}) {
  return {
    taskType: 'quiz',
    quizType: 'multiple_choice',
    options,
    check: { type: 'answer_equals', value: 'a' },
    ...extra,
  }
}

function validate(task) {
  const errors = []
  const warnings = []
  validateQuizTask(task, { n: 1, errors, warnings })
  return { errors, warnings }
}

const A = { id: 'a', image: url('a'), alt: 'Red circle on top' }
const B = { id: 'b', emoji: '🦊', alt: 'A fox' }
const C = { id: 'c', image: url('c'), alt: 'A blue square' }
const D = { id: 'd', image: url('d'), alt: 'A green line' }

describe('picture options: validation (one wording for the Builder and the CLI)', () => {
  it('accepts 2 to 4 picture options with alt text and no caption', () => {
    expect(validate(picTask([A, B]))).toEqual({ errors: [], warnings: [] })
    expect(validate(picTask([A, B, C, D]))).toEqual({ errors: [], warnings: [] })
  })

  it('an image or emoji with no alt text is an error', () => {
    const { errors } = validate(
      picTask([
        { ...A, alt: '' },
        { id: 'b', emoji: '🦊' },
      ])
    )
    expect(errors).toEqual([
      'Task 1 is a quiz but option a has a picture with no alt text (say what the picture shows in alt)',
      'Task 1 is a quiz but option b has a picture with no alt text (say what the picture shows in alt)',
    ])
  })

  it('an image that is not an https URL is an error', () => {
    const { errors } = validate(picTask([{ ...A, image: 'http://x.test/a.png' }, B]))
    expect(errors).toEqual([
      'Task 1 is a quiz but option a has an image that is not an https URL (upload it with lessons assets upload and use the URL it gives)',
    ])
  })

  it('more than 4 options with pictures is an error', () => {
    const E = { id: 'e', image: url('e'), alt: 'A star' }
    expect(validate(picTask([A, B, C, D, E])).errors).toEqual([
      'Task 1 is a quiz with picture options but has more than 4 options (picture quizzes take 2 to 4)',
    ])
  })

  it('mixing picture and plain-text options is a warning', () => {
    const { errors, warnings } = validate(picTask([A, { id: 'b', text: 'Nothing' }]))
    expect(errors).toEqual([])
    expect(warnings).toEqual([
      'Task 1 is a quiz with picture options but option b has no picture (all options should have a picture)',
    ])
  })

  it('a plain option with no text is still an error', () => {
    expect(
      validate(
        picTask([
          { id: 'a', text: '' },
          { id: 'b', text: 'x' },
        ])
      ).errors
    ).toEqual(['Task 1 is a quiz but has an empty option text'])
  })

  it('a picture on a poll is an error (no picture polls yet)', () => {
    const { errors } = validate({
      taskType: 'quiz',
      quizType: 'poll',
      options: [A, { id: 'b', text: 'Cats' }],
    })
    expect(errors).toContain(
      'Task 1 is a poll but option a has a picture (picture options work in multiple-choice quizzes only)'
    )
  })

  it('the activity definition reports the same rules', () => {
    const result = definition.validateTask(picTask([{ ...A, alt: '' }, B]), { n: 1 })
    const errors = Array.isArray(result) ? result : result.errors
    expect(errors).toContain(
      'Task 1 is a quiz but option a has a picture with no alt text (say what the picture shows in alt)'
    )
  })
})

describe('picture options: the label used by cards, reports and print', () => {
  it('resolves to the caption, else the alt text, else the id', () => {
    expect(quizOptionLabel({ id: 'a', text: 'Fox', alt: 'A fox', emoji: '🦊' })).toBe('Fox')
    expect(quizOptionLabel({ id: 'a', alt: 'A fox', emoji: '🦊' })).toBe('A fox')
    expect(quizOptionLabel({ id: 'a', text: '  ', image: url('a') })).toBe('a')
    expect(quizOptionLabel({ id: 'a', text: 'while' })).toBe('while')
  })

  it('getQuizOptionText uses the same label', () => {
    const task = picTask([A, { ...B, text: 'Fox' }])
    expect(getQuizOptionText(task, 'a')).toBe('Red circle on top')
    expect(getQuizOptionText(task, 'b')).toBe('Fox')
    expect(getQuizOptionText(task, 'z')).toBe('')
  })

  it('the summary names the chosen picture', () => {
    expect(definition.summarize(picTask([A, B]), 'a').text).toBe('a Red circle on top')
  })

  it('print shows each picture with its alt text', () => {
    const esc = (value) =>
      String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
    const html = definition.printHtml(picTask([A, { ...B, text: 'Fox' }]), { esc })
    expect(html).toContain(`<img src="${A.image}" alt="Red circle on top"`)
    expect(html).toContain('🦊')
    expect(html).toContain('<td>Fox</td>')
    expect(html).toContain('<td>Red circle on top</td>')
  })

  it('print of a word-only quiz is unchanged', () => {
    const esc = (value) => String(value ?? '')
    const html = definition.printHtml(
      picTask([
        { id: 'a', text: 'for' },
        { id: 'b', text: 'while', feedback: 'No' },
      ]),
      { esc }
    )
    expect(html).toBe(
      '<div class="field"><div class="field-label">Options</div><table class="data-table"><tr><th>ID</th><th>Text</th><th>Feedback</th></tr><tr><td>a</td><td>for</td><td></td></tr><tr><td>b</td><td>while</td><td>No</td></tr></table></div>'
    )
  })
})
