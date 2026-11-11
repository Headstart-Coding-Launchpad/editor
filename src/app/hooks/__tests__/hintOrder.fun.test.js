import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { judgeRun } from '../runJudge'
import { useCheckFeedback } from '../useCheckFeedback'
import { getModuleDefinition } from '../../../modules/definitions'
import { explainPythonError } from '../../../shared/pythonErrors.js'

// Fun moment (deep review 2026-11-10, C5; Ryan OK'd 11 Nov): a child whose code will not run
// sees the error help ("A colon : is missing"), not a content nudge ("Try counting to 5").
// Then, with code that runs but is wrong, the failed check's hint comes before the nudge, and
// pressing Run again on the same mistake moves to the next hint instead of repeating it.

const python = getModuleDefinition('python')

const task = {
  id: 'loop',
  check: [
    { type: 'code_contains', value: 'for', hint: 'Use a for loop.' },
    { type: 'output_line_count', operator: 'equals', value: 5, hint: 'Print 5 lines.' },
  ],
  feedbackChecks: [
    {
      type: 'code',
      operator: 'not_contains',
      value: 'range(5)',
      mode: 'nudge',
      hint: 'Try counting to 5 with range(5).',
    },
  ],
}

const run = (code, status, outputRaw) =>
  judgeRun({
    task,
    definition: python,
    code,
    status,
    outputRaw,
    result: { status },
    panelContext: {},
    alreadySolved: false,
    isFreePlay: false,
    source: undefined,
  })

describe('C5 hint order (Fun moment)', () => {
  it('a syntax error shows the error help, not a content nudge', () => {
    const output = 'Line 1: SyntaxError: invalid syntax'
    const judged = run('for i in range 4\n    print(i)', 'error', output)
    expect(explainPythonError(output)).not.toBeNull()
    expect(judged.passed).toBe(false)
    expect(judged.suggestion).toBe('')
  })

  it('code that runs but is wrong: the failed check before the nudge', () => {
    const judged = run('print(1)', 'success', '1\n')
    expect(judged.suggestion).toBe('Use a for loop.')
  })

  it('the same mistake again moves down the ladder instead of repeating', () => {
    const { result } = renderHook(() => useCheckFeedback())
    const shown = []
    for (let i = 0; i < 4; i += 1) {
      const judged = run('print(1)', 'success', '1\n')
      act(() => {
        result.current.resetRunFeedback()
      })
      act(() => {
        result.current.applyCheckFeedback(judged.passed, judged.suggestion, {
          evaluation: judged.evaluation,
        })
      })
      shown.push(result.current.checkSuggestion)
    }
    expect(shown).toEqual([
      'Use a for loop.',
      'Print 5 lines.',
      'Try counting to 5 with range(5).',
      'Try counting to 5 with range(5).',
    ])
  })
})
