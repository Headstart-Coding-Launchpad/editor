import { describe, expect, it } from 'vitest'
import { checkRegistry } from '../checks.js'
import { getModuleDefinitions } from '../definitions.js'
import { validateRegisteredChecks, validateScratchChecks } from '../moduleTaskValidation.js'
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

describe('Scratch opcode alternatives', () => {
  const TURN = ['motion_turnright', 'motion_turnleft']

  function run(checks, kind = 'completion') {
    const errors = []
    const warnings = []
    validateScratchChecks(checks, 1, errors, kind, warnings)
    return { errors, warnings }
  }

  it('accepts a string, a short-form list and a long-form list for every block check', () => {
    for (const type of ['block_used', 'block_run', 'block_count']) {
      const extra = type === 'block_count' ? { operator: 'equals', value: 1 } : {}
      expect(run({ type, opcode: 'motion_turnright', ...extra })).toEqual({
        errors: [],
        warnings: [],
      })
      expect(run({ type, opcode: TURN, ...extra })).toEqual({ errors: [], warnings: [] })
      expect(
        run({
          type,
          opcode: ['motion_turnright', { opcode: 'motion_turnleft' }],
          ...extra,
        }).errors
      ).toEqual([])
    }
  })

  it('accepts alternatives in blocks_in_order items ({ opcode: [...] })', () => {
    expect(
      run({
        type: 'blocks_in_order',
        sequence: [
          'event_whenflagclicked',
          { opcode: TURN },
          { opcode: TURN, fieldValues: { DEGREES: 90 } },
          {
            opcode: [
              { opcode: 'motion_turnright', fieldValues: { DEGREES: 90 } },
              { opcode: 'motion_turnleft', fieldValues: { DEGREES: 90 } },
            ],
          },
        ],
      })
    ).toEqual({ errors: [], warnings: [] })
  })

  it('rejects an empty list of opcodes', () => {
    expect(run({ type: 'block_used', opcode: [] }).errors).toEqual([
      'Task 1 has a Scratch check with an empty list of block opcodes',
    ])
    expect(
      run({ type: 'blocks_in_order', sequence: ['event_whenflagclicked', { opcode: [] }] }).errors
    ).toEqual(['Task 1 has a Scratch block-order check with an empty list of block opcodes'])
  })

  it('rejects invalid alternatives', () => {
    const message =
      'Task 1 has a Scratch check with an invalid block opcode — use an opcode name or a list of opcode names or { opcode, fieldValues } entries'
    for (const opcode of [
      ['motion_turnright', ''],
      ['motion_turnright', 42],
      ['motion_turnright', { fieldValues: { DEGREES: 90 } }],
      ['motion_turnright', { opcode: 'motion_turnleft', fieldValues: 'DEGREES' }],
      { opcode: 'motion_turnright' },
    ]) {
      expect(run({ type: 'block_run', opcode }).errors).toEqual([message])
    }
    expect(
      run({ type: 'blocks_in_order', sequence: [{ opcode: ['motion_turnright', null] }] }).errors
    ).toEqual([
      'Task 1 has a Scratch block-order check with an invalid block opcode — use an opcode name or a list of opcode names or { opcode, fieldValues } entries',
    ])
  })

  it('rejects a bare list as a sequence item (Firestore cannot store a list inside a list)', () => {
    expect(
      run({ type: 'blocks_in_order', sequence: ['event_whenflagclicked', TURN] }).errors
    ).toEqual([
      'Task 1 has a Scratch block-order check with a list as a sequence item — write alternatives as opcode: [...] inside the item',
    ])
  })

  it('still reports a missing opcode as before', () => {
    expect(run({ type: 'block_used' }).errors).toEqual([
      'Task 1 has a Scratch check but no block opcode',
    ])
    expect(
      run({ type: 'blocks_in_order', sequence: ['event_whenflagclicked', ''] }).errors
    ).toEqual(['Task 1 has a Scratch block-order check with an empty block opcode'])
  })

  it('warns when a shared fieldValues key is not an input of every alternative', () => {
    const message =
      'Task 1 has a Scratch check whose shared fieldValues key DEGREES is not an input of every alternative opcode — give each alternative its own fieldValues'
    expect(
      run({
        type: 'block_used',
        opcode: ['motion_turnright', 'motion_movesteps'],
        fieldValues: { DEGREES: 90 },
      })
    ).toEqual({ errors: [], warnings: [message] })
    expect(
      run({
        type: 'blocks_in_order',
        sequence: [
          { opcode: ['motion_turnright', 'motion_movesteps'], fieldValues: { DEGREES: 90 } },
        ],
      }).warnings
    ).toEqual([
      'Task 1 has a Scratch block-order check whose shared fieldValues key DEGREES is not an input of every alternative opcode — give each alternative its own fieldValues',
    ])
    // Shared by both turns: fine.
    expect(
      run({ type: 'block_used', opcode: TURN, fieldValues: { DEGREES: 90 } }).warnings
    ).toEqual([])
    // An alternative with no known value inputs (motion_goto's TO is a dropdown) is skipped.
    expect(
      run({
        type: 'block_used',
        opcode: ['motion_turnright', 'motion_goto'],
        fieldValues: { DEGREES: 90 },
      }).warnings
    ).toEqual([])
  })

  it('warns that block_count ignores per-alternative fieldValues', () => {
    expect(
      run({
        type: 'block_count',
        opcode: [{ opcode: 'motion_turnright', fieldValues: { DEGREES: 90 } }, 'motion_turnleft'],
        operator: 'equals',
        value: 1,
      }).warnings
    ).toEqual([
      'Task 1 has a Scratch block-count check with fieldValues on an alternative — block_count counts by opcode only and ignores them',
    ])
  })

  it('reaches both the Builder and the CLI validators', () => {
    const lesson = {
      id: 'alts',
      type: 'scratch',
      title: 'Alternatives',
      description: 'd',
      tasks: [
        {
          id: 1,
          title: 'Turn',
          check: {
            type: 'block_used',
            opcode: ['motion_turnright', 'motion_movesteps'],
            fieldValues: { DEGREES: 90 },
          },
        },
      ],
    }
    const message =
      'Task 1 has a Scratch check whose shared fieldValues key DEGREES is not an input of every alternative opcode — give each alternative its own fieldValues'
    expect(validateLesson(lesson).warnings).toContain(message)
    expect(validateLessonForMcp(lesson).warnings).toContain(message)
  })
})
