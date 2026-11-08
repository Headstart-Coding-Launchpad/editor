import { describe, expect, it } from 'vitest'
import { needsYouState, nextErrorRuns } from '../needsYou.js'

const hint = (failStreak, taskId = 't1') => ({ text: 'x', failStreak, taskId, at: 1 })

describe('needsYouState', () => {
  const opts = { taskId: 't1', hasCheck: true }

  it('puts a help request first, whatever else is true', () => {
    expect(needsYouState({ needsHelp: true, checkPassed: true }, opts)).toEqual({
      kind: 'help',
      reason: 'Asked for help',
    })
  })

  it('flags an error loop after three crashed runs with the same error', () => {
    const student = { lastRunStatus: 'error', lastRunError: 'NameError: x' }
    expect(needsYouState(student, { ...opts, errorRuns: { count: 2, error: 'x' } })).toBeNull()
    expect(
      needsYouState(student, { ...opts, errorRuns: { count: 3, error: 'NameError: x' } })
    ).toEqual({ kind: 'error', reason: 'Same error 3 runs in a row: NameError: x' })
  })

  it('flags stuck after three failed checks on this task only', () => {
    expect(needsYouState({ studentHint: hint(3) }, opts)?.kind).toBe('stuck')
    expect(needsYouState({ studentHint: hint(2) }, opts)).toBeNull()
    expect(needsYouState({ studentHint: hint(5, 't0') }, opts)).toBeNull()
    expect(needsYouState({ studentHint: hint(5) }, { ...opts, hasCheck: false })).toBeNull()
  })

  it('is null on a pass or when nothing needs the tutor', () => {
    expect(needsYouState({ checkPassed: true }, opts)).toBeNull()
    expect(needsYouState({}, opts)).toBeNull()
  })
})

describe('nextErrorRuns', () => {
  const run = (at, error) => ({
    lastRunAt: at,
    lastRunStatus: error ? 'error' : 'success',
    lastRunError: error,
  })

  it('counts the same error on new runs, resets on a different one or a clean run', () => {
    let v = nextErrorRuns(undefined, run(1, 'Traceback\nNameError: x'))
    expect(v).toEqual({ at: 1, error: 'NameError: x', count: 1 })
    v = nextErrorRuns(v, run(2, 'NameError: x'))
    v = nextErrorRuns(v, run(3, 'NameError: x'))
    expect(v.count).toBe(3)
    expect(nextErrorRuns(v, run(4, 'SyntaxError: y')).count).toBe(1)
    expect(nextErrorRuns(v, run(4, null)).count).toBe(0)
  })

  it('does not count the same run twice', () => {
    const v = nextErrorRuns(undefined, run(1, 'E'))
    expect(nextErrorRuns(v, run(1, 'E'))).toBe(v)
  })
})
