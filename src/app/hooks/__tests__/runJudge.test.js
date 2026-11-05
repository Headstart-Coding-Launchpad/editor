import { describe, expect, it } from 'vitest'
import {
  LIVE_TICK_CHECK_TYPES,
  buildRunCheckContext,
  judgeRun,
  liveTickEligible,
} from '../runJudge'
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

  it('every Stage check, code and output check, and the variable checks are allow-listed', () => {
    for (const type of [
      'output',
      'output_contains',
      'code_contains',
      'code_no_error',
      'code_structure',
      'max_lines',
      'stage_matches_target',
      'stage_shape_count',
      'stage_colour_used',
      'stage_pixel',
      'stage_text_shown',
      'variable_equals',
    ]) {
      expect(eligible({ task: { ...stageTask, check: { type, value: 'x' } } }), type).toBe(true)
    }
    expect(LIVE_TICK_CHECK_TYPES).not.toContain('run_attempted')
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
    ['a wrapped check off the list', { check: { ...task.check, checks: [{ type: 'answer' }] } }],
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
