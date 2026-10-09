import { describe, expect, it } from 'vitest'
import { validateLesson } from '../../builder/lessonUtils.js'
import { validateLessonForMcp } from '../../../cli/validate.mjs'
import { checkMissingOperator, evaluateSingleCheck } from '../../modules/checks.js'
import { compareText } from '../checkHelpers.js'

// A text check written without an `operator` (authoring request 2026-10-09): the runtime compares
// with `contains`, validation rejects it, and the Builder writes the default in.

describe('checkMissingOperator', () => {
  it.each([
    [{ type: 'output', value: 'Hi' }],
    [{ type: 'code', value: 'print' }],
    [{ type: 'answer', value: 'loop' }],
  ])('flags %o', (check) => {
    expect(checkMissingOperator(check)).toBe(true)
  })

  it.each([
    ['an operator', { type: 'output', operator: 'equals', value: 'Hi' }],
    ['an alias that implies one', { type: 'output_contains', value: 'Hi' }],
    ['no value', { type: 'output' }],
    ['a check without text operators', { type: 'output_line_count', value: 3 }],
    ['a check with no operators', { type: 'code_no_error' }],
    ['an unknown type', { type: 'nope', value: 'x' }],
  ])('ignores a check with %s', (_label, check) => {
    expect(checkMissingOperator(check)).toBe(false)
  })
})

describe('runtime default for a missing operator', () => {
  it('compareText treats a missing operator as contains', () => {
    expect(compareText('Hello there', undefined, 'hello')).toBe(true)
    expect(compareText('Hello there', undefined, 'bye')).toBe(false)
  })

  it('an output check with no operator passes on matching output', () => {
    const check = { type: 'output', value: 'Too low\nHeating up!\nRound over' }
    expect(evaluateSingleCheck(check, 'Too low\nHeating up!\nRound over\n')).toBe(true)
    expect(evaluateSingleCheck(check, 'Too high')).toBe(false)
  })

  it('a code check with no operator compares with contains', () => {
    const check = { type: 'code', value: 'print(' }
    expect(evaluateSingleCheck(check, '', { code: 'print("Hi")' })).toBe(true)
    expect(evaluateSingleCheck(check, '', { code: 'x = 1' })).toBe(false)
  })
})

const lessonWith = (task) => ({
  id: 'missing-operator',
  type: 'python',
  title: 'Missing operator',
  description: 'Repro',
  tasks: [{ id: 1, title: 'Repro', starterCode: '', ...task }],
})

describe.each([
  ['Builder', validateLesson],
  ['CLI', validateLessonForMcp],
])('%s validation', (_name, validate) => {
  it('rejects a completion check with no operator', () => {
    const { errors } = validate(lessonWith({ check: { type: 'output', value: 'Hi' } }))
    expect(errors).toContain(
      'Task 1 has a check of type output with no operator (choose contains, equals, ...)'
    )
  })

  it('rejects a feedback check with no operator', () => {
    const { errors } = validate(
      lessonWith({
        check: { type: 'output', operator: 'equals', value: 'Hi' },
        feedbackChecks: [{ type: 'code', value: 'input', hint: 'No input needed' }],
      })
    )
    expect(errors).toContain(
      'Task 1 has a feedback check of type code with no operator (choose contains, equals, ...)'
    )
  })

  it('accepts checks with an operator or an operator-bearing alias', () => {
    const { errors } = validate(
      lessonWith({
        check: [
          { type: 'output', operator: 'equals', value: 'Hi' },
          { type: 'code_contains', value: 'print' },
        ],
      })
    )
    expect(errors.filter((e) => e.includes('with no operator'))).toEqual([])
  })
})
