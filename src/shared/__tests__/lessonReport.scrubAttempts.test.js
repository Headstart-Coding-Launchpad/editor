// @vitest-environment node
// Handoff #92: a live-scrub release that did not pass is not an attempt or a failure in the
// session report (it stays in distinctAttempts and is counted as scrubChecks).
import { describe, expect, it } from 'vitest'
import { buildSessionReport } from '../lessonReport'
import { countedAttemptEntries, isFailedScrubAttempt } from '../autoCheck'

const lesson = {
  id: 'scrub-lesson',
  title: 'Scrub',
  tasks: [{ id: 1, title: 'Slide', check: { type: 'code', operator: 'contains', value: 'hi' } }],
}

const miss = (n, extra = {}) => ({
  attemptNumber: n,
  submission: 'print(' + n + ')',
  passed: false,
  suggestion: 'Print hi',
  retries: 0,
  source: 'scrub',
  loggedAt: 1000 + n * 100,
  ...extra,
})

const session = {
  startedAt: 1000,
  endedAt: 9000,
  taskStartTimes: { 1: 1000 },
  students: { alice: { displayName: 'Alice' }, bob: { displayName: 'Bob' } },
  attemptLog: {
    alice: {
      1: {
        a1: { ...miss(1), source: undefined, suggestion: 'Real miss' },
        a2: miss(2, { retries: 2 }),
        a3: miss(3),
      },
    },
    // A scrub miss, then a scrub release that passes.
    bob: {
      1: {
        b1: miss(1),
        b2: { ...miss(2), passed: true, passedAt: 1300, suggestion: null },
      },
    },
  },
}

const taskOf = (report, i) => report.students[i].tasks[0]

describe('failed scrub releases are not attempts', () => {
  it('identifies them, and keeps passing scrub releases', () => {
    expect(isFailedScrubAttempt({ source: 'scrub', passed: false })).toBe(true)
    expect(isFailedScrubAttempt({ source: 'scrub', passed: true })).toBe(false)
    expect(isFailedScrubAttempt({ passed: false })).toBe(false)
    const kept = countedAttemptEntries([
      { source: 'scrub', passed: false },
      { source: 'scrub', passed: true },
      { passed: false },
      { auto: 'leave', passed: false },
    ])
    expect(kept).toHaveLength(2)
  })

  it('leaves them out of attempts but keeps them in distinctAttempts', () => {
    const alice = taskOf(buildSessionReport({ session, lesson }), 0)
    expect(alice.attempts).toBe(1)
    expect(alice.finalResult).toBe('failed')
    expect(alice.scrubChecks).toBe(4)
    expect(alice.distinctAttempts).toHaveLength(3)
    expect(alice.distinctAttempts.filter((a) => a.source === 'scrub')).toHaveLength(2)
  })

  it('counts a passing scrub release as the pass', () => {
    const bob = taskOf(buildSessionReport({ session, lesson }), 1)
    expect(bob.attempts).toBe(1)
    expect(bob.completed).toBe(true)
    expect(bob.scrubChecks).toBe(1)
  })

  it('leaves them out of common failures and averages, and totals scrubChecks', () => {
    const summary = buildSessionReport({ session, lesson }).taskSummary[0]
    expect(summary.commonFailures).toEqual([{ suggestion: 'Real miss', count: 1 }])
    expect(summary.avgAttempts).toBe(1)
    expect(summary.scrubChecks).toBe(5)
  })

  it('counts a pass a typed redraw ticked (source live, request 131) as a normal pass', () => {
    const live = buildSessionReport({
      session: {
        ...session,
        attemptLog: {
          alice: {
            1: {
              a1: { ...miss(1), source: 'live', passed: true, passedAt: 1200, suggestion: null },
            },
          },
        },
      },
      lesson,
    })
    const alice = taskOf(live, 0)
    expect(alice.completed).toBe(true)
    expect(alice.attempts).toBe(1)
    expect(alice).not.toHaveProperty('scrubChecks')
    expect(isFailedScrubAttempt({ source: 'live', passed: true })).toBe(false)
    // The attempt list says it ticked while typing, so the modal can tell it from a Run.
    expect(alice.distinctAttempts).toEqual([
      expect.objectContaining({ passed: true, source: 'live' }),
    ])
  })

  it('a live pass the student then ran (source cleared to null by logAttempt) is a Run again', () => {
    const ran = buildSessionReport({
      session: {
        ...session,
        attemptLog: {
          alice: {
            1: {
              a1: { ...miss(1), source: null, passed: true, passedAt: 1200, retries: 1 },
            },
          },
        },
      },
      lesson,
    })
    const [attempt] = taskOf(ran, 0).distinctAttempts
    expect(attempt.passed).toBe(true)
    expect(attempt).not.toHaveProperty('source')
  })

  it('omits scrubChecks when nobody had a failed release', () => {
    const quiet = buildSessionReport({
      session: {
        ...session,
        attemptLog: { alice: { 1: { a1: { ...miss(1), source: undefined } } } },
      },
      lesson,
    })
    expect(taskOf(quiet, 0)).not.toHaveProperty('scrubChecks')
    expect(quiet.taskSummary[0]).not.toHaveProperty('scrubChecks')
  })
})
