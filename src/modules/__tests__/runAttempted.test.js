// run_attempted: the completion check for demo tasks ("press Run and watch"). Covers the shared
// evaluator and its no-run behaviour, the error-gate helper, Scratch's own evaluator (green flag
// only), the Builder + CLI validators, `lessons test-checks` and `lessons capabilities`.
import { describe, expect, it } from 'vitest'
import {
  CHECK_TYPES,
  NO_RUN_RESULTS,
  canEvaluateCheckWithoutRun,
  checkAllowedForSubmit,
  checkRequiresRun,
  completionToleratesRunError,
  evaluateCheck,
  evaluateCheckWithCode,
  evaluateSingleCheck,
  evaluateTaskWithoutRun,
  getCheckDefinition,
  moduleHasRunButton,
  moduleReportsRunStatus,
} from '../checks.js'
import { getModuleDefinition } from '../definitions.js'
import { evaluateScratchCheck } from '../scratch/checks.js'
import {
  evaluateScratchCheckForSprites,
  isScratchRunAttemptedOnly,
  isScratchStaticCheck,
} from '../scratch/checkDispatch.js'
import {
  evaluateScratchStage,
  evaluateScratchWorkWithoutRun,
  explainScratchCheck,
} from '../scratch/checkVerification.js'
import { validateLesson } from '../../builder/lessonUtils'
import { validateLessonForMcp } from '../../../cli/validate.mjs'
import { testLessonChecks } from '../../../cli/check-tests.mjs'
import { buildCapabilities } from '../../../cli/capabilities.mjs'
import { readRepoFile } from './helpers/sourceLiterals'

const RUN_ATTEMPTED = { type: 'run_attempted' }
const REQUIRE_SUCCESS = { type: 'run_attempted', requireSuccess: true }

describe('run_attempted — shared evaluator', () => {
  it('is a registered core check that needs a run and is not allowed in submit mode', () => {
    expect(getCheckDefinition('run_attempted')).toMatchObject({
      owner: 'core',
      requiresRun: true,
      submitAllowed: false,
    })
    expect(CHECK_TYPES.RUN_REQUIRED).toContain('run_attempted')
    expect(checkRequiresRun(RUN_ATTEMPTED)).toBe(true)
    expect(checkAllowedForSubmit(RUN_ATTEMPTED)).toBe(false)
  })

  it('passes on any run, whatever its status', () => {
    for (const status of ['success', 'error', 'stopped', undefined]) {
      expect(evaluateSingleCheck(RUN_ATTEMPTED, '', { ran: true, status })).toBe(true)
    }
  })

  it('with requireSuccess, fails a run that errored or was stopped', () => {
    expect(evaluateSingleCheck(REQUIRE_SUCCESS, '', { ran: true, status: 'success' })).toBe(true)
    expect(evaluateSingleCheck(REQUIRE_SUCCESS, '', { ran: true, status: 'error' })).toBe(false)
    expect(evaluateSingleCheck(REQUIRE_SUCCESS, '', { ran: true, status: 'stopped' })).toBe(false)
    // No status at all (Arcade, HTML): requireSuccess has nothing to read and is ignored.
    expect(evaluateSingleCheck(REQUIRE_SUCCESS, '', { ran: true })).toBe(true)
  })

  it('never passes in a context without a run', () => {
    for (const context of [
      {},
      { code: 'print("hi")' },
      { code: 'x', status: 'success' },
      { ran: 'yes' },
      { ran: false, status: 'success' },
    ]) {
      expect(evaluateSingleCheck(RUN_ATTEMPTED, 'hi', context)).toBe(false)
      expect(evaluateCheck(RUN_ATTEMPTED, 'hi', context)).toBe(false)
    }
    // Submit-mode grading (code only) never passes it.
    expect(evaluateCheckWithCode(RUN_ATTEMPTED, 'print("hi")')).toBe(false)
  })

  it('composes with other checks in a check array', () => {
    const checks = [RUN_ATTEMPTED, { type: 'code', operator: 'contains', value: 'jump' }]
    expect(evaluateCheck(checks, '', { ran: true, code: 'player.jump()' })).toBe(true)
    expect(evaluateCheck(checks, '', { ran: true, code: 'player = 1' })).toBe(false)
    expect(evaluateCheck(checks, '', { code: 'player.jump()' })).toBe(false)
  })

  it('is graded not_run without a run (auto-check on leave), never passed', () => {
    expect(canEvaluateCheckWithoutRun(RUN_ATTEMPTED, { code: 'x', ran: true })).toBe(false)
    expect(evaluateTaskWithoutRun({ check: RUN_ATTEMPTED }, { code: 'x' })).toEqual({
      result: NO_RUN_RESULTS.NOT_RUN,
      suggestion: '',
    })
    // A static check that fails still decides the verdict.
    expect(
      evaluateTaskWithoutRun(
        { check: [RUN_ATTEMPTED, { type: 'code', operator: 'contains', value: 'jump' }] },
        { code: 'x' }
      ).result
    ).toBe(NO_RUN_RESULTS.FAILED)
  })
})

describe('completionToleratesRunError (the run paths’ error gate)', () => {
  it('is true only when every completion check is a run_attempted without requireSuccess', () => {
    expect(completionToleratesRunError(RUN_ATTEMPTED)).toBe(true)
    expect(completionToleratesRunError([RUN_ATTEMPTED])).toBe(true)
    expect(completionToleratesRunError([RUN_ATTEMPTED, RUN_ATTEMPTED])).toBe(true)
  })

  it('keeps the error gate for everything else', () => {
    expect(completionToleratesRunError(null)).toBe(false)
    expect(completionToleratesRunError([])).toBe(false)
    expect(completionToleratesRunError(REQUIRE_SUCCESS)).toBe(false)
    expect(completionToleratesRunError({ type: 'code_no_error' })).toBe(false)
    expect(completionToleratesRunError({ type: 'output_contains', value: 'hi' })).toBe(false)
    expect(
      completionToleratesRunError([RUN_ATTEMPTED, { type: 'code_contains', value: 'x' }])
    ).toBe(false)
  })
})

describe('run_attempted — which modules can run a task', () => {
  it.each(['python', 'turtle', 'electronics'])('%s runs report a status', (type) => {
    const def = getModuleDefinition(type)
    expect(moduleHasRunButton(def)).toBe(true)
    expect(moduleReportsRunStatus(def)).toBe(true)
  })

  it.each(['arcade', 'scratch', 'html'])('%s has a Run button but no error status', (type) => {
    const def = getModuleDefinition(type)
    expect(moduleHasRunButton(def)).toBe(true)
    expect(moduleReportsRunStatus(def)).toBe(false)
  })

  it.each(['filesystem', 'desktop'])('%s has no Run button', (type) => {
    expect(moduleHasRunButton(getModuleDefinition(type))).toBe(false)
  })
})

describe('run_attempted — Scratch (green flag only)', () => {
  it('passes only on a run signal stamped by the green flag', () => {
    expect(evaluateScratchCheck(RUN_ATTEMPTED, null, null, { greenFlagPressed: true })).toBe(true)
    // A clicked script or a key press before any green flag: the signal is not stamped.
    expect(evaluateScratchCheck(RUN_ATTEMPTED, null, null, { greenFlagPressed: false })).toBe(false)
    expect(evaluateScratchCheck(RUN_ATTEMPTED, null, null, {})).toBe(false)
    expect(evaluateScratchCheck(RUN_ATTEMPTED, null, null, null)).toBe(false)
  })

  it('dispatches without needing a sprite, and ignores requireSuccess', () => {
    expect(evaluateScratchCheckForSprites(RUN_ATTEMPTED, [], { greenFlagPressed: true })).toBe(true)
    expect(evaluateScratchCheckForSprites(REQUIRE_SUCCESS, [], { greenFlagPressed: true })).toBe(
      true
    )
    expect(evaluateScratchCheckForSprites(RUN_ATTEMPTED, [], null)).toBe(false)
  })

  it('is judged at the green flag when it is the only after-run check', () => {
    expect(isScratchRunAttemptedOnly([RUN_ATTEMPTED])).toBe(true)
    expect(
      isScratchRunAttemptedOnly([
        RUN_ATTEMPTED,
        { type: 'block_used', opcode: 'motion_movesteps', evaluation: 'after_block_placed' },
      ])
    ).toBe(true)
    expect(
      isScratchRunAttemptedOnly([RUN_ATTEMPTED, { type: 'block_run', opcode: 'looks_say' }])
    ).toBe(false)
    expect(isScratchRunAttemptedOnly([])).toBe(false)
  })

  it('only the green flag sets the flag in ScratchWorkspace (a clicked script never does)', () => {
    const source = readRepoFile('src/modules/scratch/ScratchWorkspace.jsx')
    const assignments = [...source.matchAll(/greenFlagPressedRef\.current = true/g)]
    expect(assignments).toHaveLength(1)
    const handleRunStart = source.indexOf('async function handleRun()')
    const runClickedStart = source.indexOf('async function runClickedBlock(')
    expect(handleRunStart).toBeGreaterThan(-1)
    expect(assignments[0].index).toBeGreaterThan(handleRunStart)
    expect(assignments[0].index).toBeLessThan(runClickedStart)
  })

  it('is a run-time check for the CLI and the auto-check: skipped / not_run, never a pass', () => {
    const task = { id: 1, title: 'Watch', check: [RUN_ATTEMPTED] }
    expect(isScratchStaticCheck(RUN_ATTEMPTED)).toBe(false)
    expect(explainScratchCheck(RUN_ATTEMPTED, [])).toMatchObject({ result: 'skipped' })
    expect(evaluateScratchStage(task, null).completion.result).toBe('incomplete')
    expect(evaluateScratchWorkWithoutRun(task, {})?.result).toBe(NO_RUN_RESULTS.NOT_RUN)
  })
})

describe('run_attempted — lessons test-checks', () => {
  it('fails (never passes) a source-only case: the CLI never runs code', () => {
    const lesson = {
      id: 'demo',
      type: 'python',
      tasks: [{ id: 1, title: 'Watch', starterCode: 'print("hi")', check: RUN_ATTEMPTED }],
    }
    const result = testLessonChecks(lesson, {
      tasks: [{ id: 1, cases: [{ name: 'starter', code: 'print("hi")', completion: 'fail' }] }],
    })
    expect(result.cases[0].actual.completion).toBe('fail')
  })
})

describe('run_attempted — lessons capabilities', () => {
  const capabilities = buildCapabilities({ requests: [] })

  it('lists it as a core run check', () => {
    expect(capabilities.checkTypes.find((c) => c.type === 'run_attempted')).toMatchObject({
      owner: 'core',
      requiresRun: true,
      submitAllowed: false,
      fields: ['requireSuccess'],
    })
  })

  it('lists it on the modules with a Run button only', () => {
    const typesOf = (type) => capabilities.modules.find((m) => m.type === type).checkTypes
    for (const type of ['python', 'turtle', 'arcade', 'electronics', 'html', 'scratch']) {
      expect(typesOf(type)).toContain('run_attempted')
    }
    for (const type of ['filesystem', 'desktop']) {
      expect(typesOf(type)).not.toContain('run_attempted')
    }
  })
})

// ── Validation (Builder validateLesson and CLI validateLessonForMcp share the rules) ──

function lessonOf(type, task) {
  return {
    id: `${type}-demo`,
    type,
    title: 'Demo',
    description: 'Watch it run',
    tasks: [{ id: 1, title: 'Watch It Move', ...task }],
  }
}

const VALIDATORS = [
  ['Builder', validateLesson],
  ['CLI', validateLessonForMcp],
]

const has = (list, text) => list.some((message) => message.includes(text))

describe.each(VALIDATORS)('run_attempted validation (%s)', (_name, validate) => {
  it.each([
    ['python', { starterCode: 'print("hi")' }],
    ['turtle', { starterCode: 'import turtle\nturtle.forward(50)' }],
    ['arcade', { starterCode: 'game.run()' }],
  ])('accepts a run_attempted-only %s demo task', (type, fields) => {
    const { errors, warnings } = validate(lessonOf(type, { ...fields, check: RUN_ATTEMPTED }))
    expect(errors.filter((e) => e.includes('run_attempted') || e.includes('check'))).toEqual([])
    expect(has(warnings, 'not a code check')).toBe(false)
    expect(has(warnings, 'open the Complete tab and run')).toBe(false)
  })

  it('accepts run_attempted next to a code check', () => {
    const { errors } = validate(
      lessonOf('python', {
        starterCode: 'print("hi")',
        check: [RUN_ATTEMPTED, { type: 'code_contains', value: 'print' }],
      })
    )
    expect(errors.filter((e) => e.includes('check'))).toEqual([])
  })

  it.each(['filesystem', 'desktop'])('rejects it on %s (no Run button)', (type) => {
    const { errors } = validate(lessonOf(type, { check: RUN_ATTEMPTED }))
    expect(has(errors, 'run_attempted needs a module with a Run button')).toBe(true)
  })

  it('rejects it as a feedback check', () => {
    const { errors } = validate(
      lessonOf('python', {
        starterCode: 'print("hi")',
        check: { type: 'code_contains', value: 'print' },
        feedbackChecks: [{ type: 'run_attempted', hint: 'Press Run' }],
      })
    )
    expect(has(errors, 'run_attempted can only be a completion check')).toBe(true)
  })

  it('rejects it in submit mode (it needs a run)', () => {
    const { errors } = validate(
      lessonOf('python', {
        starterCode: 'print("hi")',
        interactionMode: 'submit',
        check: RUN_ATTEMPTED,
      })
    )
    expect(has(errors, 'uses submit mode but has a check that requires running the code')).toBe(
      true
    )
  })

  it('warns that requireSuccess is ignored on Arcade, but not on Python', () => {
    const arcade = validate(
      lessonOf('arcade', { starterCode: 'game.run()', check: REQUIRE_SUCCESS })
    )
    expect(has(arcade.warnings, 'requireSuccess is ignored there')).toBe(true)
    const python = validate(
      lessonOf('python', { starterCode: 'print("hi")', check: REQUIRE_SUCCESS })
    )
    expect(has(python.warnings, 'requireSuccess is ignored there')).toBe(false)
  })

  it('rejects a requireSuccess that is not a boolean', () => {
    const { errors } = validate(
      lessonOf('python', {
        starterCode: 'print("hi")',
        check: { type: 'run_attempted', requireSuccess: 'yes' },
      })
    )
    expect(has(errors, 'whose requireSuccess is not true or false')).toBe(true)
  })

  it('rejects a Scratch run_attempted judged after_block_placed', () => {
    const { errors } = validate(
      lessonOf('scratch', {
        starterBlocks: null,
        check: { type: 'run_attempted', evaluation: 'after_block_placed' },
      })
    )
    expect(has(errors, 'with evaluation after_block_placed')).toBe(true)
  })

  it('warns when a task with tests also has a run_attempted check', () => {
    const { warnings } = validate(
      lessonOf('python', {
        starterCode: 'print(input())',
        check: RUN_ATTEMPTED,
        tests: [
          {
            id: 'a',
            inputs: [{ name: 'x', value: '1' }],
            check: { type: 'output_contains', value: '1' },
          },
        ],
      })
    )
    expect(has(warnings, 'the run_attempted check is never used')).toBe(true)
  })
})
