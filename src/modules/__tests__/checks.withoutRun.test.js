import { describe, it, expect } from 'vitest'
import {
  NO_RUN_RESULTS,
  canEvaluateCheckWithoutRun,
  evaluateCheckWithoutRun,
  evaluateTaskWithoutRun,
} from '../checks.js'
import { evaluateScratchWorkWithoutRun } from '../scratch/checkVerification.js'
import scratchDefinition from '../scratch/definition.js'

const codeHas = (value, hint) => ({ type: 'code', operator: 'contains', value, hint })

describe('canEvaluateCheckWithoutRun', () => {
  it('judges static code checks (canonical and legacy aliases)', () => {
    expect(canEvaluateCheckWithoutRun(codeHas('print'), { code: '' })).toBe(true)
    expect(canEvaluateCheckWithoutRun({ type: 'code_contains', value: 'x' }, { code: '' })).toBe(
      true
    )
  })

  it('never judges run-required checks', () => {
    for (const check of [
      { type: 'output', operator: 'contains', value: 'hi' },
      { type: 'output_contains', value: 'hi' },
      { type: 'output_line_count', operator: 'equals', value: 2 },
      { type: 'output_not_empty' },
      { type: 'output_empty' },
      { type: 'code_no_error' },
    ]) {
      expect(canEvaluateCheckWithoutRun(check, { code: 'x' })).toBe(false)
    }
  })

  it('never judges checks that read a run result, even without requiresRun (turtle)', () => {
    expect(canEvaluateCheckWithoutRun({ type: 'turtle_position', x: 0, y: 0 }, { code: 'x' })).toBe(
      false
    )
    expect(
      canEvaluateCheckWithoutRun({ type: 'turtle_position', x: 0, y: 0 }, { turtle: {} })
    ).toBe(false)
  })

  it('does not judge a check whose context key is missing, or an unknown type', () => {
    expect(canEvaluateCheckWithoutRun({ type: 'answer', value: 'a' }, { code: '' })).toBe(false)
    expect(canEvaluateCheckWithoutRun({ type: 'block_used', opcode: 'x' }, {})).toBe(false)
    expect(canEvaluateCheckWithoutRun(null, {})).toBe(false)
  })
})

describe('evaluateCheckWithoutRun', () => {
  it('returns null for no check', () => {
    expect(evaluateCheckWithoutRun(null, { code: '' })).toBeNull()
    expect(evaluateCheckWithoutRun([], { code: '' })).toBeNull()
  })

  it("is 'passed' when every check is static and passes", () => {
    expect(
      evaluateCheckWithoutRun([codeHas('for'), codeHas('print')], { code: 'for x: print(x)' })
    ).toBe(NO_RUN_RESULTS.PASSED)
  })

  it("is 'failed' when a static check fails", () => {
    expect(evaluateCheckWithoutRun(codeHas('while'), { code: 'print(1)' })).toBe(
      NO_RUN_RESULTS.FAILED
    )
  })

  it("is 'not_run' when static checks pass but a check needs a run", () => {
    const check = [codeHas('print'), { type: 'output', operator: 'contains', value: 'hi' }]
    expect(evaluateCheckWithoutRun(check, { code: 'print("hi")' })).toBe(NO_RUN_RESULTS.NOT_RUN)
  })

  it("mixed checks: a failing static check wins over a run-required one ('failed')", () => {
    const check = [{ type: 'output', operator: 'contains', value: 'hi' }, codeHas('while')]
    expect(evaluateCheckWithoutRun(check, { code: 'print("hi")' })).toBe(NO_RUN_RESULTS.FAILED)
  })

  it('uses a custom judge when given (null = needs a run)', () => {
    const judge = (c) => (c.type === 'a' ? true : null)
    expect(evaluateCheckWithoutRun([{ type: 'a' }], {}, judge)).toBe(NO_RUN_RESULTS.PASSED)
    expect(evaluateCheckWithoutRun([{ type: 'a' }, { type: 'b' }], {}, judge)).toBe(
      NO_RUN_RESULTS.NOT_RUN
    )
  })
})

describe('evaluateTaskWithoutRun', () => {
  it('returns null for a task with no check and no tests', () => {
    expect(evaluateTaskWithoutRun({ id: 1 }, { code: 'x' })).toBeNull()
  })

  it('passes a task whose static checks pass', () => {
    expect(evaluateTaskWithoutRun({ check: codeHas('print') }, { code: 'print(1)' })).toEqual({
      result: 'passed',
      suggestion: '',
    })
  })

  it("fails with the failed check's hint", () => {
    expect(
      evaluateTaskWithoutRun({ check: codeHas('for', 'Use a for loop') }, { code: 'print(1)' })
    ).toEqual({ result: 'failed', suggestion: 'Use a for loop' })
  })

  it('never takes the hint from a run-required check', () => {
    const task = {
      check: [
        { type: 'output', operator: 'contains', value: 'hi', hint: 'Print hi' },
        codeHas('for', 'Use a for loop'),
      ],
    }
    expect(evaluateTaskWithoutRun(task, { code: 'print(1)' })).toEqual({
      result: 'failed',
      suggestion: 'Use a for loop',
    })
  })

  it("is 'not_run' for a task that needs a run", () => {
    const task = { check: { type: 'output', operator: 'contains', value: 'hi' } }
    expect(evaluateTaskWithoutRun(task, { code: 'print("hi")' })).toEqual({
      result: 'not_run',
      suggestion: '',
    })
  })

  it("Python tests tasks are 'not_run' unless a static check fails", () => {
    const tests = [{ inputs: [], check: { type: 'output', operator: 'contains', value: '1' } }]
    expect(evaluateTaskWithoutRun({ tests }, { code: 'print(1)' }).result).toBe('not_run')
    expect(
      evaluateTaskWithoutRun({ tests, check: codeHas('print') }, { code: 'print(1)' }).result
    ).toBe('not_run')
    expect(
      evaluateTaskWithoutRun({ tests, check: codeHas('input') }, { code: 'print(1)' }).result
    ).toBe('failed')
  })

  it('a matching static blocking feedback check fails the task', () => {
    const task = {
      check: codeHas('print'),
      feedbackChecks: [{ ...codeHas('prnt'), hint: 'Check your spelling of print' }],
    }
    expect(evaluateTaskWithoutRun(task, { code: 'print(1)\nprnt(2)' })).toEqual({
      result: 'failed',
      suggestion: 'Check your spelling of print',
    })
  })

  it('a run-required feedback check never matches (output is not judged as empty)', () => {
    const task = {
      check: codeHas('print'),
      feedbackChecks: [{ type: 'output_empty', hint: 'Nothing printed' }],
    }
    expect(evaluateTaskWithoutRun(task, { code: 'print(1)' }).result).toBe('passed')
  })

  it('a nudge feedback check does not fail a passing task', () => {
    const task = {
      check: codeHas('print'),
      feedbackChecks: [{ ...codeHas('print'), mode: 'nudge', hint: 'Nice' }],
    }
    expect(evaluateTaskWithoutRun(task, { code: 'print(1)' }).result).toBe('passed')
  })
})

describe('Scratch: evaluateScratchWorkWithoutRun', () => {
  const sayBlock = {
    type: 'looks_sayforsecs',
    inputs: {
      MESSAGE: { shadow: { type: 'text', fields: { TEXT: 'Hi' } } },
      SECS: { shadow: { type: 'math_number', fields: { NUM: '2' } } },
    },
  }
  const work = {
    blocks: {
      blocks: [{ type: 'event_whenflagclicked', x: 0, y: 0, next: { block: sayBlock } }],
    },
  }

  it('is the Scratch module definition evaluator', () => {
    expect(scratchDefinition.checking.evaluateWithoutRun).toBe(evaluateScratchWorkWithoutRun)
  })

  it('returns null without work', () => {
    expect(evaluateScratchWorkWithoutRun({ check: { type: 'block_used' } }, null)).toBeNull()
  })

  it('judges block checks against the saved blocks', () => {
    const pass = { check: { type: 'block_used', opcode: 'looks_sayforsecs' } }
    const fail = { check: { type: 'block_used', opcode: 'motion_movesteps', hint: 'Add a move' } }
    expect(evaluateScratchWorkWithoutRun(pass, work)).toEqual({ result: 'passed', suggestion: '' })
    expect(evaluateScratchWorkWithoutRun(fail, work)).toEqual({
      result: 'failed',
      suggestion: 'Add a move',
    })
  })

  it("sprite-state and block_run checks are 'not_run'", () => {
    const task = {
      check: [
        { type: 'block_used', opcode: 'looks_sayforsecs' },
        { type: 'block_run', opcode: 'looks_sayforsecs' },
      ],
    }
    expect(evaluateScratchWorkWithoutRun(task, work).result).toBe('not_run')
  })
})
