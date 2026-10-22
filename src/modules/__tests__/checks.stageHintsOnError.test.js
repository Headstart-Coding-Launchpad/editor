import { describe, expect, it } from 'vitest'
import { evaluateCheckWithFeedback } from '../checks.js'

// A Run that ends in an error holds back Python Stage hints (src/modules/checks.js isPictureCheck).
const completion = [
  { type: 'stage_shape_count', kind: 'circle', min: 1, hint: 'Draw a circle.' },
  { type: 'code_contains', value: 'stage.circle', hint: 'Use stage.circle.' },
]
const context = { code: 'print(hello)', stage: { commands: [], target: null } }

describe('Stage hints on an errored Run', () => {
  it('shows the first failing check hint as before when the code ran', () => {
    const result = evaluateCheckWithFeedback({ check: completion }, '', context, {
      completionPassed: false,
    })
    expect(result.suggestion).toBe('Draw a circle.')
  })

  it('skips Stage completion hints when the Run errored', () => {
    const result = evaluateCheckWithFeedback({ check: completion }, '', context, {
      completionPassed: false,
      runErrored: true,
    })
    expect(result.suggestion).toBe('Use stage.circle.')
  })

  it('drops Stage feedback checks but keeps other feedback checks on an error', () => {
    const task = {
      check: completion,
      feedbackChecks: [
        { type: 'stage_shape_count', kind: 'circle', max: 0, hint: 'No circle yet.' },
        { type: 'code_contains', value: 'hello', hint: 'Put hello in quotes.' },
      ],
    }
    const ran = evaluateCheckWithFeedback(task, '', context, { completionPassed: false })
    expect(ran.suggestion).toBe('No circle yet.')
    const errored = evaluateCheckWithFeedback(task, '', context, {
      completionPassed: false,
      runErrored: true,
    })
    expect(errored.suggestion).toBe('Put hello in quotes.')
    expect(errored.matchedFeedback.hint).toBe('Put hello in quotes.')
  })
})
