import { describe, expect, it } from 'vitest'
import { evaluateCheckWithFeedback } from '../checks.js'

// Hint order (review item C5): crash help (ErrorHelp, outside checks.js), then a blocking
// feedback hint or a failed completion check's hint, then a nudge. A nudge never hides the fault.
const check = { type: 'code_contains', value: 'for', hint: 'Use a for loop.' }
const nudge = { type: 'code_contains', value: 'print', mode: 'nudge', hint: 'Nice printing!' }
const context = { code: 'print(1' }

describe('hint order', () => {
  it('a Run with a syntax error shows the failed check hint, not the matched nudge', () => {
    const result = evaluateCheckWithFeedback({ check, feedbackChecks: [nudge] }, '', context, {
      completionPassed: false,
      runErrored: true,
    })
    expect(result.suggestion).toBe('Use a for loop.')
  })

  it('a failed check with no hint lets the matched nudge show', () => {
    const task = { check: { ...check, hint: '' }, feedbackChecks: [nudge] }
    expect(evaluateCheckWithFeedback(task, '', context).suggestion).toBe('Nice printing!')
  })

  it('an explained crash shows only the error help, never a nudge', () => {
    const result = evaluateCheckWithFeedback({ check, feedbackChecks: [nudge] }, '', context, {
      completionPassed: false,
      runErrored: true,
      errorExplained: true,
    })
    expect(result.suggestion).toBe('')
  })

  it('a blocking hint beats a higher-priority nudge', () => {
    const task = {
      check,
      feedbackChecks: [
        { ...nudge, priority: 1 },
        { type: 'code_contains', value: 'print(1', hint: 'Close the bracket.', priority: 2 },
      ],
    }
    expect(evaluateCheckWithFeedback(task, '', context).suggestion).toBe('Close the bracket.')
  })

  it('picks the nudge by priority on a pass and on a fail alike', () => {
    const nudges = [
      { ...nudge, hint: 'Second', priority: 2 },
      { ...nudge, hint: 'First', priority: 1 },
    ]
    const passTask = { check: { type: 'code_contains', value: 'print' }, feedbackChecks: nudges }
    expect(evaluateCheckWithFeedback(passTask, '', context).suggestion).toBe('First')
    const failTask = { check: { ...check, hint: '' }, feedbackChecks: nudges }
    expect(evaluateCheckWithFeedback(failTask, '', context).suggestion).toBe('First')
  })

  it('on idle, before any run, a matched nudge shows, not an unrun check hint', () => {
    const task = { check, feedbackChecks: [{ ...nudge, show: 'on_idle' }] }
    const result = evaluateCheckWithFeedback(task, '', context, {
      completionPassed: false,
      feedbackTiming: 'on_idle',
    })
    expect(result.suggestion).toBe('Nice printing!')
  })

  it('shows the top blocking match, or Not quite. when it has no hint', () => {
    const task = {
      check,
      feedbackChecks: [
        { type: 'code_contains', value: 'print', hint: '', priority: 1 },
        { type: 'code_contains', value: 'print(1', hint: 'Close the bracket.', priority: 2 },
      ],
    }
    expect(evaluateCheckWithFeedback(task, '', context).suggestion).toBe('Not quite.')
  })

  it('an unknown feedback mode does not block', () => {
    const task = {
      check: { type: 'code_contains', value: 'print' },
      feedbackChecks: [{ ...nudge, mode: 'warn', hint: 'Not like that.' }],
    }
    expect(evaluateCheckWithFeedback(task, '', context).passed).toBe(true)
  })
})
