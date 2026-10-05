import { describe, expect, it } from 'vitest'
import { combineCompletion, testLessonChecks } from './check-tests.mjs'
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
    expect(result.summary).toEqual({
      total: 3,
      passed: 3,
      failed: 0,
      skipped: 0,
      skippedRuntimeChecks: 0,
    })
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
    expect(result.summary).toEqual({
      total: 1,
      passed: 0,
      failed: 1,
      skipped: 0,
      skippedRuntimeChecks: 0,
    })
    expect(result.cases[0].mismatches).toEqual(['completion: expected pass, got fail'])
  })
})

describe('lesson check cases: checks that need a run', () => {
  const mixedLesson = {
    id: 'mixed-checks',
    type: 'python',
    title: 'Mixed checks',
    tasks: [
      {
        id: 1,
        title: 'Source and run checks',
        check: [
          { type: 'code', operator: 'contains', value: 'print(' },
          { type: 'output', operator: 'contains', value: 'Hello' },
          { type: 'code_no_error' },
          { type: 'variable_equals', name: 'x', value: '3' },
        ],
        feedbackChecks: [
          { type: 'output', operator: 'contains', value: 'hello', hint: 'Use a capital H.' },
          { type: 'code', operator: 'contains', value: 'while', hint: 'Use a for loop.' },
        ],
      },
      {
        id: 2,
        title: 'Run checks only',
        check: [
          { type: 'output_not_empty' },
          { type: 'output_line_count', operator: 'equals', value: 2 },
          { type: 'output_contains', value: 'Hi' },
        ],
      },
      {
        id: 3,
        title: 'Python tests',
        check: { type: 'code', operator: 'contains', value: 'def' },
        feedbackChecks: [{ type: 'code', operator: 'contains', value: 'pass', hint: 'Finish it.' }],
        tests: [{ input: '', expected: 'x' }],
      },
    ],
  }

  it('skips run-only completion checks and judges completion on the source checks', () => {
    const result = testLessonChecks(mixedLesson, {
      tasks: [
        {
          id: 1,
          cases: [
            { name: 'correct', code: 'x = 3\nprint("Hello")', completion: 'pass' },
            { name: 'wrong loop', code: 'while True: pass', completion: 'fail' },
          ],
        },
      ],
    })

    expect(result.success).toBe(true)
    const [correct, wrong] = result.cases
    expect(correct.actual.completion).toBe('pass')
    expect(correct.actual.checks.map((c) => c.result)).toEqual([
      'pass',
      'skipped',
      'skipped',
      'skipped',
    ])
    expect(correct.actual.checks[1].reason).toMatch(/needs a run/)
    expect(correct.skippedFeedback).toEqual([
      expect.objectContaining({ index: 1, type: 'output', result: 'skipped' }),
    ])
    expect(correct.skippedRuntimeChecks).toBe(4)
    expect(wrong.actual.completion).toBe('fail')
    expect(wrong.matchedFeedback).toEqual([
      expect.objectContaining({ index: 2, hint: 'Use a for loop.', result: 'pass' }),
    ])
    expect(result.summary).toEqual({
      total: 2,
      passed: 2,
      failed: 0,
      skipped: 0,
      skippedRuntimeChecks: 8,
    })
  })

  it('reports completion as skipped (not a mismatch) when every check needs a run', () => {
    const result = testLessonChecks(mixedLesson, {
      tasks: [{ id: 2, cases: [{ name: 'prints', code: 'print("Hi")', completion: 'pass' }] }],
    })

    expect(result.success).toBe(true)
    expect(result.cases[0].actual.completion).toBe('skipped')
    expect(result.cases[0].mismatches).toEqual([])
    // Legacy aliases (output_contains) resolve through the registry too.
    expect(result.cases[0].actual.checks.every((c) => c.result === 'skipped')).toBe(true)
    expect(result.summary).toEqual({
      total: 1,
      passed: 0,
      failed: 0,
      skipped: 1,
      skippedRuntimeChecks: 3,
    })
  })

  it('skips every check of a task with Python tests, as the runtime does', () => {
    const result = testLessonChecks(mixedLesson, {
      tasks: [{ id: 3, cases: [{ name: 'stub', code: 'def f():\n  pass', completion: 'fail' }] }],
    })

    expect(result.success).toBe(true)
    const [stub] = result.cases
    expect(stub.actual.completion).toBe('skipped')
    expect(stub.actual.checks[0]).toEqual(
      expect.objectContaining({ result: 'skipped', reason: expect.stringMatching(/tests/) })
    )
    expect(stub.matchedFeedback).toEqual([])
    expect(stub.skippedFeedback).toHaveLength(1)
  })

  it('skips checks that read state a cases file cannot supply', () => {
    const fsLesson = {
      id: 'fs-checks',
      type: 'filesystem',
      title: 'FS',
      tasks: [
        {
          id: 1,
          title: 'Make a folder',
          check: { type: 'fs_path', operator: 'exists', path: '/docs' },
        },
      ],
    }
    const result = testLessonChecks(fsLesson, {
      tasks: [{ id: 1, cases: [{ name: 'any', code: '', completion: 'pass' }] }],
    })
    expect(result.cases[0].actual.completion).toBe('skipped')
    expect(result.cases[0].actual.checks[0].reason).toMatch(/reads fs state/)
  })
})

describe('combineCompletion', () => {
  const r = (result) => ({ result })
  it('fails when any judged check fails, even alongside skipped ones', () => {
    expect(combineCompletion([r('skipped'), r('fail'), r('pass')])).toBe('fail')
  })
  it('passes on the judged checks when the rest are skipped', () => {
    expect(combineCompletion([r('pass'), r('skipped')])).toBe('pass')
  })
  it('is skipped when every check is skipped', () => {
    expect(combineCompletion([r('skipped'), r('skipped')])).toBe('skipped')
  })
  it('fails a task with no completion check, as at runtime', () => {
    expect(combineCompletion([])).toBe('fail')
  })
})
