import { describe, expect, it } from 'vitest'
import { testLessonChecks } from './check-tests.mjs'
import { parseJsonOrYaml } from './structured-input.mjs'

const lesson = {
  id: 'check-cases-demo',
  type: 'python',
  title: 'Check cases demo',
  description: 'A lesson used to test code checks.',
  tasks: [
    {
      id: 4,
      title: 'Build a greeting',
      check: [
        { type: 'code', operator: 'matches_regex', value: 'for[a-z]+inrange\\(3\\):' },
        { type: 'code', operator: 'contains', value: 'print("Hello world")' },
      ],
      feedbackChecks: [
        { type: 'code', operator: 'contains', value: 'while', hint: 'Use a for loop instead.' },
        {
          type: 'code',
          operator: 'contains',
          value: 'pass',
          hint: 'Replace pass with your solution.',
        },
      ],
    },
  ],
}

describe('lesson check cases', () => {
  it('uses runtime code normalisation for whitespace, string literals, and alternate valid solutions', () => {
    const result = testLessonChecks(lesson, {
      tasks: [
        {
          id: 4,
          cases: [
            {
              name: 'alternate variable name and whitespace',
              code: 'for\tnumber  in\nrange(3):\n  print( "Hello world" )',
              completion: 'pass',
            },
            {
              name: 'different whitespace inside string literal',
              code: 'for item in range(3):\n  print("Helloworld")',
              completion: 'fail',
            },
            {
              name: 'incomplete solution',
              code: 'for item in range(3):\n  pass',
              completion: 'fail',
            },
          ],
        },
      ],
    })

    expect(result.success).toBe(true)
    expect(result.summary).toEqual({ total: 3, passed: 3, failed: 0 })
    expect(result.cases[0].actual.completion).toBe('pass')
    expect(result.cases[1].actual.completion).toBe('fail')
    expect(result.cases[2].actual.completion).toBe('fail')
    expect(result.cases[2].matchedFeedback).toEqual([
      expect.objectContaining({
        index: 2,
        hint: 'Replace pass with your solution.',
        result: 'pass',
      }),
    ])
  })

  it('accepts the documented YAML cases-file shape', () => {
    const casesFile = parseJsonOrYaml(
      'check-cases.yaml',
      `
tasks:
  - id: 4
    cases:
      - name: YAML case
        code: |
          for other in range(3):
            print("Hello world")
        completion: pass
`
    )

    expect(testLessonChecks(lesson, casesFile).success).toBe(true)
  })

  it('reports feedback and legacy incorrect checks that match a code case', () => {
    const feedbackLesson = {
      ...lesson,
      tasks: [
        {
          ...lesson.tasks[0],
          feedbackChecks: undefined,
          incorrectChecks: [
            { type: 'code', operator: 'contains', value: 'while', hint: 'Use a for loop instead.' },
          ],
        },
      ],
    }
    const result = testLessonChecks(feedbackLesson, {
      tasks: [
        {
          id: 4,
          cases: [
            {
              name: 'wrong loop',
              code: 'while True:\n  print("Hello world")',
              completion: 'fail',
            },
          ],
        },
      ],
    })

    expect(result.success).toBe(true)
    expect(result.cases[0].matchedFeedback).toEqual([
      expect.objectContaining({
        index: 1,
        hint: 'Use a for loop instead.',
        result: 'pass',
      }),
    ])
  })

  it('marks a case unsuccessful when its expected completion differs', () => {
    const result = testLessonChecks(lesson, {
      tasks: [
        {
          id: 4,
          cases: [
            {
              name: 'wrong expectation',
              code: 'pass',
              completion: 'pass',
            },
          ],
        },
      ],
    })

    expect(result.success).toBe(false)
    expect(result.summary).toEqual({ total: 1, passed: 0, failed: 1 })
    expect(result.cases[0].mismatches).toEqual(['completion: expected pass, got fail'])
  })
})
