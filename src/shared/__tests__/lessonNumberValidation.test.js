// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { validateLesson } from '../../builder/lessonUtils.js'
import { validateLessonForMcp } from '../../../cli/validate.mjs'
import { parseYamlLesson } from '../../../cli/yaml-converter.mjs'

// lessonNumber is an optional lesson-envelope field (src/shared/lessonValidation.js
// validateLessonEnvelope), shared by the Builder and `lessons validate`.
const MESSAGE = 'lessonNumber must be a positive whole number (1, 2, 3 …) when provided'

const baseLesson = {
  id: 'lesson-number-demo',
  type: 'python',
  title: 'Boolean Flags',
  description: 'Flags',
  tasks: [{ id: 1, taskType: 'information', title: 'Intro', explainer: 'Hello' }],
}

const validators = [
  ['Builder', validateLesson],
  ['CLI', validateLessonForMcp],
]

describe.each(validators)('%s lessonNumber validation', (_name, validate) => {
  it.each([1, 6, 9, 42])('accepts lessonNumber %s', (lessonNumber) => {
    const { errors } = validate({ ...baseLesson, lessonNumber })
    expect(errors).not.toContain(MESSAGE)
  })

  it('accepts a lesson with no lessonNumber, or an explicit null', () => {
    expect(validate(baseLesson).errors).not.toContain(MESSAGE)
    expect(validate({ ...baseLesson, lessonNumber: null }).errors).not.toContain(MESSAGE)
  })

  it.each([
    ['zero', 0],
    ['negative', -3],
    ['decimal', 2.5],
    ['string', '9'],
    ['empty string', ''],
    ['boolean', true],
    ['NaN', Number.NaN],
  ])('rejects a %s lessonNumber', (_label, lessonNumber) => {
    const { valid, errors } = validate({ ...baseLesson, lessonNumber })
    expect(errors).toContain(MESSAGE)
    if (valid !== undefined) expect(valid).toBe(false)
  })
})

describe('lessonNumber in YAML', () => {
  it('passes through the YAML converter as a number', () => {
    const lesson = parseYamlLesson(`
id: k3f9x2qp7a
type: python
title: Boolean Flags
description: Flags
levelId: python-level-1
lessonNumber: 9
tasks:
  - type: information
    title: Intro
    explainer: Hello
`)
    expect(lesson.lessonNumber).toBe(9)
    expect(validateLessonForMcp(lesson).errors).not.toContain(MESSAGE)
  })

  it('rejects a quoted YAML number', () => {
    const lesson = parseYamlLesson(`
id: k3f9x2qp7a
type: python
title: Boolean Flags
description: Flags
lessonNumber: "9"
tasks:
  - type: information
    title: Intro
    explainer: Hello
`)
    expect(validateLessonForMcp(lesson).errors).toContain(MESSAGE)
  })
})
