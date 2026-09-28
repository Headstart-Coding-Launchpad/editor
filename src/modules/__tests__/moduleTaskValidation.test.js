import { describe, expect, it } from 'vitest'
import { checkRegistry } from '../checks.js'
import { getModuleDefinitions } from '../definitions.js'
import { validateRegisteredChecks } from '../moduleTaskValidation.js'
import { validateLesson } from '../../builder/lessonUtils.js'
import { validateLessonForMcp } from '../../../cli/validate.mjs'

describe('module validateTask contract', () => {
  it('every module definition has a pure validateTask', () => {
    for (const definition of getModuleDefinitions()) {
      expect(typeof definition.validateTask, definition.type).toBe('function')
      const errors = []
      const warnings = []
      expect(() =>
        definition.validateTask({ id: 1, title: 'Empty' }, { n: 1, lesson: {}, errors, warnings })
      ).not.toThrow()
    }
  })
})

describe('check registry validate hook', () => {
  // A check type that declares its own authoring rule. Registered once for this file only
  // (each test file gets its own module instances).
  checkRegistry.registerCheckType({
    type: 'test_self_validating',
    owner: 'core',
    timing: 'on_run',
    evaluate: () => true,
    validate: (check, { n, kind }) =>
      check.target ? [] : [`Task ${n} has a self-validating ${kind} check but no target`],
  })

  it('pushes the messages a check definition returns, for completion and feedback checks', () => {
    const errors = []
    validateRegisteredChecks(
      {
        check: { type: 'test_self_validating' },
        feedbackChecks: [{ type: 'test_self_validating', hint: 'x' }],
      },
      2,
      errors
    )
    expect(errors).toEqual([
      'Task 2 has a self-validating completion check but no target',
      'Task 2 has a self-validating feedback check but no target',
    ])
  })

  it('runs in both validators', () => {
    const lesson = {
      id: 'hook',
      type: 'python',
      title: 'Hook',
      description: 'd',
      tasks: [
        {
          id: 1,
          title: 'T',
          starterCode: 'x',
          check: { type: 'test_self_validating', value: 'v' },
        },
      ],
    }
    const message = 'Task 1 has a self-validating completion check but no target'
    expect(validateLesson(lesson).errors).toContain(message)
    expect(validateLessonForMcp(lesson).errors).toContain(message)
  })
})
