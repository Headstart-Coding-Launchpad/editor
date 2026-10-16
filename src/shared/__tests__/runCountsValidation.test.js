// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  validateLineRunCountCheck,
  validateRunCounts,
  validateRunsPredictedCheck,
} from '../runCountsValidation.js'
import { getModuleDefinition } from '../../modules/definitions.js'

function run(task) {
  const errors = []
  const warnings = []
  validateRunCounts(task, 1, errors, warnings)
  return { errors, warnings }
}

const STARTER = 'for i in range(3):\n    #@count\n    print("Hip")\n#@count\nprint("Hooray")\n'
const task = (extra = {}) => ({
  id: 1,
  runCounts: 'predict',
  codeStages: [{ role: 'starter', code: STARTER }],
  ...extra,
})

describe('validateRunCounts (P6-26)', () => {
  it('accepts the documented example', () => {
    expect(
      run(
        task({
          check: [
            { type: 'runs_predicted' },
            { type: 'runs_predicted', lines: [2, 3] },
            { type: 'line_run_count', operator: 'equals', value: 3 },
            { type: 'line_run_count', line: 3, value: 1 },
          ],
        })
      )
    ).toEqual({ errors: [], warnings: [] })
    expect(run(task({ runCounts: 'show' }))).toEqual({ errors: [], warnings: [] })
  })

  it('rejects an unknown mode', () => {
    expect(run(task({ runCounts: 'guess' })).errors).toEqual([
      'Task 1 has runCounts "guess" — use one of: predict, show',
    ])
  })

  it('warns over 3 marks, about a mark with no line after it, and runCounts without marks', () => {
    const four = '#@count\na = 1\n#@count\nb = 2\n#@count\nc = 3\n#@count\nd = 4\n#@count\n'
    expect(run({ id: 1, runCounts: 'show', starterCode: four }).warnings).toEqual([
      'Task 1 has 4 #@count lines — only the first 3 are counted',
      'Task 1 has a #@count marker with no line of code after it; it counts nothing',
    ])
    expect(run({ id: 1, runCounts: 'show', starterCode: 'x = 1' }).warnings).toEqual([
      'Task 1 has runCounts but no #@count line in its code — put #@count on the line above the line to count',
    ])
    expect(run({ id: 1, starterCode: STARTER }).warnings).toEqual([
      'Task 1 has #@count lines but no runCounts — add runCounts: predict or show to show the counts',
    ])
    // A line_run_count check is a reason to mark lines without showing them.
    expect(
      run({ id: 1, starterCode: STARTER, check: [{ type: 'line_run_count', value: 3 }] }).warnings
    ).toEqual([])
  })

  it('ties runs_predicted to predict mode and its lines to the marked lines', () => {
    expect(run(task({ runCounts: 'show', check: [{ type: 'runs_predicted' }] })).errors).toEqual([
      'Task 1 has a runs_predicted check but runCounts is not predict',
    ])
    expect(run(task({ check: [{ type: 'runs_predicted', lines: [1] }] })).errors).toEqual([
      'Task 1 has a runs_predicted check naming line 1, which is not a #@count line of the starter — the marked lines are 2, 3',
    ])
  })

  it('checks a line_run_count line against the starter as the student sees it', () => {
    expect(
      run(task({ check: [{ type: 'line_run_count', line: 9, value: 1 }] })).errors[0]
    ).toContain('line 9, which is not a line of code in the starter')
    expect(
      run({ id: 1, starterCode: 'x = 1', check: [{ type: 'line_run_count', value: 1 }] }).errors
    ).toEqual(['Task 1 has a line_run_count check with no line and no #@count line in its starter'])
  })
})

describe('run-count check shapes', () => {
  const python = getModuleDefinition('python')
  const turtle = getModuleDefinition('turtle')
  const html = getModuleDefinition('html')

  it('only work in modules with runCounts', () => {
    const check = { type: 'runs_predicted' }
    expect(validateRunsPredictedCheck(check, { n: 2, moduleDefinition: python })).toEqual([])
    expect(validateRunsPredictedCheck(check, { n: 2, moduleDefinition: turtle })).toEqual([])
    expect(validateRunsPredictedCheck(check, { n: 2, moduleDefinition: html })).toEqual([
      'Task 2 has a runs_predicted check, but it only works in Python and Turtle tasks',
    ])
    expect(
      validateLineRunCountCheck({ value: 1 }, { n: 2, kind: 'feedback', moduleDefinition: html })
    ).toEqual([
      'Task 2 has a line_run_count feedback check, but it only works in Python and Turtle tasks',
    ])
  })

  it('need line numbers, a known operator and a whole-number value', () => {
    expect(validateRunsPredictedCheck({ lines: [] }, { n: 2 })).toEqual([
      'Task 2 has a runs_predicted check whose lines is not a list of line numbers',
    ])
    expect(validateLineRunCountCheck({ line: 3, operator: 'min', value: '2' }, { n: 2 })).toEqual(
      []
    )
    expect(validateLineRunCountCheck({ line: 0, value: 1 }, { n: 2 })).toEqual([
      'Task 2 has a line_run_count check whose line is not a line number',
    ])
    expect(validateLineRunCountCheck({ operator: 'about', value: 1 }, { n: 2 })).toEqual([
      'Task 2 has a line_run_count check with operator "about" — use one of: equals, min, max',
    ])
    expect(validateLineRunCountCheck({ value: 2.5 }, { n: 2 })).toEqual([
      'Task 2 has a line_run_count check without a whole-number value',
    ])
  })
})
