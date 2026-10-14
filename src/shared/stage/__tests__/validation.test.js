import { describe, expect, it } from 'vitest'
import { validateStageTarget } from '../validation.js'
import { getModuleDefinition } from '../../../modules/definitions.js'

function run(task) {
  const errors = []
  const warnings = []
  validateStageTarget(task, 2, errors, warnings)
  return { errors, warnings }
}

describe('validateStageTarget', () => {
  it('accepts a target with code, and no target at all', () => {
    expect(run({ stageTarget: { code: 'from stage import *\ncircle(1, 1, 1, "red")' } })).toEqual({
      errors: [],
      warnings: [],
    })
    expect(run({})).toEqual({ errors: [], warnings: [] })
  })

  it('names each mistake', () => {
    expect(run({ stageTarget: 'circle()' }).errors).toEqual([
      "Task 2 has a stageTarget that is not an object — write the target's Python under code",
    ])
    expect(run({ stageTarget: { code: '  ' } }).errors).toEqual([
      'Task 2 has a stageTarget with no code — add the Python that draws the target',
    ])
    expect(run({ stageTarget: { code: 'print(1)', ghost: 'yes', size: 3 } })).toEqual({
      errors: ['Task 2 has a stageTarget ghost that is not true or false'],
      warnings: [
        'Task 2 has stageTarget code that never imports stage — it will draw nothing (start it with from stage import *)',
        'Task 2 has stageTarget fields it does not use (size) — they are ignored',
      ],
    })
  })

  it('runs as part of the python module validation', () => {
    const errors = []
    const warnings = []
    getModuleDefinition('python').validateTask(
      { id: 1, stageTarget: { code: '' } },
      { n: 1, errors, warnings }
    )
    expect(errors).toContain(
      'Task 1 has a stageTarget with no code — add the Python that draws the target'
    )
  })
})
