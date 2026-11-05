import { describe, expect, it } from 'vitest'
import { buildRunCheckContext, judgeRun } from '../runJudge'
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
