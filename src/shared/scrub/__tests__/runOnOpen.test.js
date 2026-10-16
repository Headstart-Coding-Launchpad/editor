// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { codeCallsInput, getTaskRunOnOpen, validateRunOnOpen } from '../runOnOpen.js'
import { getModuleDefinition } from '../../../modules/definitions.js'

describe('getTaskRunOnOpen', () => {
  it('defaults on with scrub and off without it', () => {
    expect(getTaskRunOnOpen({ scrub: { enabled: true } })).toBe(true)
    expect(getTaskRunOnOpen({ scrub: true })).toBe(true)
    expect(getTaskRunOnOpen({})).toBe(false)
    expect(getTaskRunOnOpen(null)).toBe(false)
  })

  it('follows the task when it says', () => {
    expect(getTaskRunOnOpen({ runOnOpen: true })).toBe(true)
    expect(getTaskRunOnOpen({ scrub: true, runOnOpen: false })).toBe(false)
  })
})

describe('codeCallsInput', () => {
  it('spots input() calls only', () => {
    expect(codeCallsInput('name = input("Who? ")')).toBe(true)
    expect(codeCallsInput('box.input(1)\nmy_input = 2')).toBe(false)
  })
})

describe('validateRunOnOpen', () => {
  const run = (task) => {
    const errors = []
    const warnings = []
    validateRunOnOpen(task, 5, errors, warnings, { starterCode: task.starterCode })
    return { errors, warnings }
  }

  it('accepts true or false', () => {
    expect(run({ runOnOpen: true, starterCode: 'print(1)' })).toEqual({ errors: [], warnings: [] })
    expect(run({ runOnOpen: 'yes' }).errors).toEqual([
      'Task 5 has runOnOpen that is not true or false',
    ])
  })

  it('warns that an input() program never runs on open', () => {
    expect(run({ runOnOpen: true, starterCode: 'x = input("?")' }).warnings).toEqual([
      "Task 5 has runOnOpen but its starter code calls input() — it can't run on open, so runOnOpen is ignored",
    ])
  })

  it('is a python and turtle task field', () => {
    for (const type of ['python', 'turtle']) {
      const names = getModuleDefinition(type).taskFields.map((field) => field.name)
      expect(names).toContain('runOnOpen')
    }
  })
})
