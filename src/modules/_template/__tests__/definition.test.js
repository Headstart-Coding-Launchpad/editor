// @vitest-environment node
import { describe, expect, it } from 'vitest'
import definition from '../definition.js'
import { evaluateSingleCheck } from '../../checks.js'
import { CHECKS } from '../checks.js'

// The Template Module definition's own behaviour. The shared contract tests
// (src/modules/__tests__/: moduleInterface, moduleDefinitions, moduleWorkSlot, moduleTypeParity…)
// check it against every other module once it is registered.
// TODO(new-module): replace these with tests of the module's real work, checks and validation.

const TASK = {
  id: 1,
  title: 'Write hello',
  starterCode: 'say ',
  completeCode: 'say hello',
  check: { type: 'code_contains', value: 'hello' },
}

function validate(task) {
  const errors = []
  const warnings = []
  definition.validateTask(task, { n: 1, lesson: { type: definition.type }, errors, warnings })
  return { errors, warnings }
}

describe('Template Module definition', () => {
  it('passes defineModule and names its type', () => {
    expect(definition.type).toBe('template_module')
    expect(Object.isFrozen(definition)).toBe(true)
  })

  it('accepts a complete task and flags a check it cannot evaluate', () => {
    expect(validate(TASK)).toEqual({ errors: [], warnings: [] })
    expect(validate({ ...TASK, check: { type: 'code_contains', value: '' } }).errors).toEqual([
      'Task 1 has a check enabled but no check value',
    ])
    expect(
      validate({ ...TASK, check: { type: 'output_contains', value: 'hi' } }).warnings
    ).toContain(
      'Task 1 has a Template Module check that is not a code check — only code checks are evaluated'
    )
  })

  it('reads its work from the task, stages and lesson', () => {
    const { workSlot, lifecycle } = definition
    expect(workSlot.starter(TASK)).toBe('say ')
    expect(workSlot.complete(TASK)).toBe('say hello')
    expect(workSlot.stage({ codeStages: [{ code: 'stage one' }] }, 0)).toBe('stage one')
    expect(workSlot.sandbox({ sandboxStarter: 'free' })).toBe('free')
    expect(lifecycle.resetTarget(TASK, 'complete')).toEqual({ code: 'say hello' })
    expect(workSlot.fromResetTarget(lifecycle.resetTarget(TASK, 'starter'))).toBe('say ')
    expect(lifecycle.hasComplete(TASK)).toBe(true)
    expect(lifecycle.hasPersonalSandbox({ sandboxStarter: '' })).toBe(true)
    expect(lifecycle.hasPersonalSandbox({})).toBe(false)
  })

  it('stores and sends the work unchanged', () => {
    const { storage, wire } = definition
    const record = storage.toTaskRecord('say hi', { output: '', runStatus: 'success' })
    expect(record).toEqual({ code: 'say hi', output: '', runStatus: 'success' })
    expect(storage.fromTaskRecord(record)).toEqual({
      work: 'say hi',
      meta: { output: '', runStatus: 'success' },
    })
    expect(wire.fromCode(wire.toCode('say hi'))).toBe('say hi')
    expect(wire.liveExtras({})).toEqual({ arcadeDesign: null, turtleResult: null })
  })

  it('checks the work with the core code checks', () => {
    const context = definition.checking.buildContext('say hello', { status: 'success' })
    expect(evaluateSingleCheck(TASK.check, '', context)).toBe(true)
    expect(evaluateSingleCheck(TASK.check, '', definition.checking.buildContext('say'))).toBe(false)
    expect(CHECKS).toEqual([])
  })
})
