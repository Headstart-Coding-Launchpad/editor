import { describe, expect, it } from 'vitest'
import {
  LIVE_TICK_COMPLETION_CHECKS,
  LIVE_TICK_FEEDBACK_CHECK_TYPES,
  buildRunCheckContext,
  judgeRun,
  liveTickCompletionCheck,
  liveTickEligible,
} from '../runJudge'
import { checkRegistry } from '../../../modules/checks'
import { getModuleDefinition } from '../../../modules/definitions'

const python = getModuleDefinition('python')
const turtle = getModuleDefinition('turtle')
const task = { id: 't1', check: { type: 'output_contains', value: 'hi', hint: 'Print hi' } }

const judge = (overrides = {}) =>
  judgeRun({
    task,
    definition: python,
    code: 'print("hi")',
    status: 'success',
    outputRaw: 'hi\n',
    result: { status: 'success' },
    panelContext: {},
    alreadySolved: false,
    isFreePlay: false,
    source: undefined,
    ...overrides,
  })

describe('buildRunCheckContext', () => {
  it('Python: the Stage drawing and target, ran, and the panel extras', () => {
    const stage = { commands: [{ type: 'circle' }] }
    expect(
      buildRunCheckContext({
        definition: python,
        code: 'x = 1',
        status: 'success',
        result: { variables: { x: 1 }, stage, stageTarget: { commands: [] } },
        panelContext: { runCounts: { 1: 2 } },
      })
    ).toEqual({
      code: 'x = 1',
      status: 'success',
      variables: { x: 1 },
      turtle: null,
      stage: { commands: stage.commands, target: { commands: [] } },
      ran: true,
      runCounts: { 1: 2 },
    })
  })

  it('Turtle: no Stage, the drawing as turtle', () => {
    const drawing = { commands: [] }
    expect(
      buildRunCheckContext({
        definition: turtle,
        code: '',
        status: 'success',
        result: { turtle: drawing },
        panelContext: {},
      })
    ).toMatchObject({ turtle: drawing, stage: null, variables: {}, ran: true })
  })
})

describe('judgeRun', () => {
  it('a pass', () => {
    expect(judge()).toMatchObject({
      passed: true,
      suggestion: '',
      scrubPassed: null,
      isScrubRun: false,
      hasTests: false,
      runFailureBlocksCompletion: false,
      checkTask: task,
      isFreePlay: false,
    })
    expect(judge().evaluation).toMatchObject({ passed: true })
  })

  it('a miss carries the hint', () => {
    expect(judge({ outputRaw: 'nope\n' })).toMatchObject({
      passed: false,
      suggestion: 'Print hi',
    })
  })

  it('an error Run fails even when the output matches', () => {
    expect(judge({ status: 'error' })).toMatchObject({
      passed: false,
      runFailureBlocksCompletion: true,
    })
  })

  it('a solved task stays passed with no evaluation', () => {
    expect(judge({ alreadySolved: true, outputRaw: 'nope\n' })).toMatchObject({
      passed: true,
      evaluation: null,
      suggestion: '',
    })
  })

  it('free play is never checked', () => {
    expect(judge({ isFreePlay: true })).toMatchObject({
      passed: false,
      checkTask: null,
      evaluation: null,
    })
  })

  it('a task with tests never passes on Run', () => {
    const tested = { id: 't1', tests: [{ id: 'a', check: task.check }] }
    expect(judge({ task: tested })).toMatchObject({ passed: false, hasTests: true })
  })

  it('a scrub has its own verdict, even on a solved task', () => {
    expect(judge({ source: 'scrub', alreadySolved: true, outputRaw: 'nope\n' })).toMatchObject({
      passed: true,
      isScrubRun: true,
      scrubPassed: false,
    })
  })

  it('is pure: the same inputs give the same verdict', () => {
    expect(judge({ outputRaw: 'nope\n' })).toEqual(judge({ outputRaw: 'nope\n' }))
  })
})

describe('liveTickEligible (request 131: a typed redraw may tick the task)', () => {
  const stageTask = { id: 't1', scrub: { enabled: true }, check: task.check }
  const eligible = (overrides = {}) =>
    liveTickEligible({
      task: stageTask,
      definition: python,
      code: 'print("hi")',
      phase: 'lesson',
      teacherPresentation: false,
      previewMode: false,
      inPersonalSandbox: false,
      predictRunLocked: false,
      ...overrides,
    })

  it('a Python Stage task with allow-listed checks, live or solo', () => {
    expect(eligible()).toBe(true)
    expect(eligible({ phase: 'solo' })).toBe(true)
  })

  it('ticks for allow-listed completion checks (positive evidence) and readable feedback', () => {
    for (const check of [
      { type: 'output_contains', value: 'hi' },
      { type: 'code_contains', value: 'circle' },
      { type: 'stage_colour_used', colour: 'red' },
      { type: 'variable_equals', name: 'x', value: '3' },
    ]) {
      expect(eligible({ task: { ...stageTask, check } }), check.type).toBe(true)
    }
    // A feedback check only holds a pass back, so a negative one the redraw can read is fine.
    const feedbackChecks = [{ type: 'code_not_contains', value: 'while', hint: 'No while' }]
    expect(eligible({ task: { ...stageTask, feedbackChecks } })).toBe(true)
    expect(LIVE_TICK_FEEDBACK_CHECK_TYPES).not.toContain('run_attempted')
  })

  it('a completion list ticks only when every entry needs positive evidence', () => {
    const negative = { type: 'code_not_contains', value: 'while' }
    expect(eligible({ task: { ...stageTask, check: [task.check, negative] } })).toBe(false)
    expect(eligible({ task: { ...stageTask, check: [] } })).toBe(false)
  })

  it('never on code that is the starter code (trailing spaces and blank lines aside)', () => {
    const starterTask = { ...stageTask, starterCode: 'print("hi")\n' }
    expect(eligible({ task: starterTask, code: 'print("hi")  \n\n' })).toBe(false)
    expect(eligible({ code: 'print("hi")', starterCode: 'print("hi")' })).toBe(false)
    expect(eligible({ task: starterTask, code: 'print("hi")\nprint("hi")' })).toBe(true)
  })

  it.each([
    ['no check', { check: undefined }],
    ['submit mode', { interactionMode: 'submit' }],
    ['code_arrange tiles', { taskType: 'code_arrange' }],
    ['an activity', { taskType: 'activity', activityType: 'quiz_multiple_choice' }],
    ['Python tests', { tests: [{ id: 'a', check: task.check }] }],
    ['input() in setupCode', { setupCode: 'x = input()' }],
    ['name tags', { showVariables: { mode: 'view' } }],
    ['run counts', { runCounts: 'show' }],
    ['run_attempted', { check: { type: 'run_attempted' } }],
    ['run_attempted in a list', { check: [task.check, { type: 'run_attempted' }] }],
    ['variables_predicted', { check: { type: 'variables_predicted', names: ['x'] } }],
    ['runs_predicted feedback', { feedbackChecks: [{ type: 'runs_predicted' }] }],
    ['an unknown type', { check: { type: 'made_up' } }],
    ['nesting keys (checks), read by no evaluator', { check: { ...task.check, checks: [] } }],
    ['nesting keys (check)', { check: [{ ...task.check, check: { ...task.check } }] }],
    ['a typeless entry in a check list', { check: [task.check, { value: 'x' }] }],
    ['a copyCode task', { copyCode: 'print("hi")' }],
    ['an on-idle feedback check', { feedbackChecks: [{ ...task.check, show: 'on_idle' }] }],
    ['Run defaults to slow-mo', { slowMo: { enabled: true } }],
  ])('not for %s', (_name, patch) => {
    expect(eligible({ task: { ...stageTask, ...patch } })).toBe(false)
  })

  it('slow-mo on its own button leaves Run normal, so it may tick', () => {
    expect(
      eligible({ task: { ...stageTask, slowMo: { enabled: true, separateButton: true } } })
    ).toBe(true)
  })

  it('not for input() in the code, or a lost task', () => {
    expect(eligible({ code: 'x = input("?")' })).toBe(false)
    expect(eligible({ task: null })).toBe(false)
  })

  it.each([
    ['the presentation window', { teacherPresentation: true }],
    ['the Builder preview', { previewMode: true }],
    ['the personal sandbox', { inPersonalSandbox: true }],
    ['the session sandbox', { phase: 'sandbox' }],
    ["predict mode's Run lock", { predictRunLocked: true }],
    ['Turtle', { definition: turtle }],
    ['a module without a definition', { definition: null }],
  ])('not in %s', (_name, overrides) => {
    expect(eligible(overrides)).toBe(false)
  })
})

// Request 131: every check type in the registry and whether, as a COMPLETION check, it may tick a
// typed redraw. A redraw runs half-typed code, so only checks needing positive evidence of the
// right answer tick; the rest (and any type added later, until classified here and in
// LIVE_TICK_COMPLETION_CHECKS) tick on Run only. `[check fields, decision]` cases for the
// types that depend on their operator or bounds.
const LIVE_TICK_DECISIONS = {
  output: [
    [{ operator: 'contains', value: 'a' }, true],
    [{ operator: 'equals', value: 'a' }, true],
    [{ operator: 'matches_regex', value: 'a' }, true],
    [{ operator: 'not_contains', value: 'a' }, false],
    [{ operator: 'not_equals', value: 'a' }, false],
    [{ operator: 'not_matches_regex', value: 'a' }, false],
  ],
  output_line_count: false,
  output_not_empty: false,
  output_empty: false,
  code_no_error: false,
  run_attempted: false,
  code: [
    [{ operator: 'contains', value: 'a' }, true],
    [{ operator: 'equals', value: 'a' }, true],
    [{ operator: 'matches_regex', value: 'a' }, true],
    [{ operator: 'not_contains', value: 'a' }, false],
    [{ operator: 'not_equals', value: 'a' }, false],
    [{ operator: 'not_matches_regex', value: 'a' }, false],
  ],
  answer: false,
  code_structure: [
    [{ operator: 'nested_in', inner: 'a', outer: 'for' }, true],
    [{ operator: 'directly_nested_in', inner: 'a', outer: 'for' }, true],
    [{ operator: 'not_nested_in', inner: 'a', outer: 'for' }, false],
  ],
  max_lines: false,
  stage_matches_target: true,
  stage_colour_used: true,
  stage_pixel: true,
  stage_text_shown: [
    [{ text: 'hi' }, true],
    [{ text: 'hi', operator: 'equals' }, true],
    [{ text: 'hi', operator: 'matches_regex' }, true],
    [{ text: 'hi', operator: 'not_contains' }, false],
  ],
  stage_shape_count: [
    [{}, true],
    [{ min: 2 }, true],
    [{ min: 3, max: 3 }, true],
    [{ max: 3 }, false],
    [{ min: 0 }, false],
    [{ min: 1, max: 4 }, false],
    [{ min: 0, max: 0 }, false],
  ],
  variable_exists: false,
  variable_type: false,
  variable_equals: true,
  variable_not_equals: false,
  variable_dict_contains: true,
  variable_dict_equals: true,
  variable_dict_key_value: true,
  variable_array_contains: true,
  variable_array_equals: true,
  variable_array_nth_item: true,
}

describe('live tick completion checks: each registry type and its decision (request 131)', () => {
  const types = checkRegistry.list().map((def) => def.type)

  it('every registry type off the table never ticks', () => {
    for (const type of types.filter((t) => !(t in LIVE_TICK_DECISIONS))) {
      expect(liveTickCompletionCheck({ type, value: 'x' }), type).toBe(false)
      expect(Object.keys(LIVE_TICK_COMPLETION_CHECKS), type).not.toContain(type)
    }
  })

  it.each(Object.entries(LIVE_TICK_DECISIONS))('%s', (type, decision) => {
    expect(types, `${type} is a registry type`).toContain(type)
    const cases = Array.isArray(decision) ? decision : [[{ value: 'x' }, decision]]
    for (const [fields, expected] of cases) {
      expect(liveTickCompletionCheck({ type, ...fields }), JSON.stringify(fields)).toBe(expected)
    }
  })

  it('aliases are judged as their canonical type', () => {
    expect(liveTickCompletionCheck({ type: 'output_contains', value: 'a' })).toBe(true)
    expect(liveTickCompletionCheck({ type: 'code_does_not_contain', value: 'a' })).toBe(false)
    expect(liveTickCompletionCheck({ type: 'output_line_count_at_least', value: 1 })).toBe(false)
  })
})
