import { describe, expect, it } from 'vitest'
import {
  changedRosterWorkCandidates,
  collectRosterWorkCandidates,
  markRosterWorkSeen,
} from '../rosterWorkChanges.js'

const lesson = {
  id: 'py-1-maple',
  type: 'python',
  fork: {
    sourceLessonId: 'py-1',
    classId: 'maple',
    taskLinks: [
      { taskId: 1, sourceTaskId: 1 },
      { taskId: 2, sourceTaskId: 2 },
    ],
  },
  tasks: [
    { id: 1, title: 'Print', check: [] },
    { id: 2, title: 'Loop', check: [] },
    { id: 3, title: 'Read me', taskType: 'information' },
  ],
}

function session(overrides = {}) {
  return {
    state: 'active',
    currentTaskId: 2,
    students: {
      a: {
        currentCode: 'for i in range(3):\n    print(i)',
        lastRunStatus: 'success',
        lastRunAt: 500,
      },
    },
    attemptLog: {
      a: {
        1: { p1: { submission: 'print(1)', passed: true, loggedAt: 100, retries: 0 } },
      },
    },
    ...overrides,
  }
}

const collect = (sess, matches = { a: 'r1' }) =>
  collectRosterWorkCandidates({ session: sess, lesson, lessonId: 'py-1-maple', matches })

describe('collectRosterWorkCandidates', () => {
  it("offers each matched student's latest attempt per task and their last run on the current task", () => {
    const candidates = collect(session())
    expect(candidates.map((c) => [c.key, c.origin, c.workId])).toEqual([
      ['a:1', 'submission', 'py-1__1'],
      ['a:2', 'run', 'py-1__2'],
    ])
    expect(candidates[0].extract()).toEqual({ kind: 'code', code: 'print(1)' })
    expect(candidates[1].extract()).toEqual({
      kind: 'code',
      code: 'for i in range(3):\n    print(i)',
    })
  })

  it('ignores unmatched students', () => {
    expect(collect(session(), {})).toEqual([])
  })

  it('prefers the newer of the run and an attempt on the same task', () => {
    const sess = session({
      attemptLog: {
        a: { 2: { p9: { submission: 'print("later")', loggedAt: 900, retries: 0 } } },
      },
    })
    const [candidate] = collect(sess)
    expect(candidate.origin).toBe('submission')
    expect(candidate.extract().code).toBe('print("later")')
  })

  it('labels auto-check-on-leave attempts as leave', () => {
    const sess = session({
      students: {},
      attemptLog: {
        a: { 2: { p1: { submission: 'x = 1', auto: 'leave', loggedAt: 50, retries: 0 } } },
      },
    })
    expect(collect(sess)[0].origin).toBe('leave')
  })

  it('skips runs in a session sandbox or personal sandbox, and information tasks', () => {
    expect(collect(session({ state: 'sandbox', attemptLog: {} }))).toEqual([])
    const personal = session({ attemptLog: {} })
    personal.students.a.inPersonalSandbox = true
    expect(collect(personal)).toEqual([])
    expect(collect(session({ currentTaskId: 3, attemptLog: {} }))).toEqual([])
  })

  it('skips a run setTaskId has cleared', () => {
    const sess = session({ attemptLog: {} })
    sess.students.a.lastRunStatus = null
    expect(collect(sess)).toEqual([])
  })
})

describe('changedRosterWorkCandidates', () => {
  it('reports new triggers only once marked seen', () => {
    const seen = new Map()
    const first = collect(session())
    expect(changedRosterWorkCandidates(first, seen)).toHaveLength(2)
    first.forEach((c) => markRosterWorkSeen(seen, c))
    expect(changedRosterWorkCandidates(collect(session()), seen)).toEqual([])

    const rerun = session()
    rerun.students.a.lastRunAt = 700
    expect(changedRosterWorkCandidates(collect(rerun), seen).map((c) => c.key)).toEqual(['a:2'])
  })

  it('never lets an older attempt replace a later run once the run is cleared', () => {
    const seen = new Map()
    const sess = session({
      attemptLog: { a: { 2: { p1: { submission: 'old', loggedAt: 100, retries: 0 } } } },
    })
    collect(sess).forEach((c) => markRosterWorkSeen(seen, c)) // the run at 500 wins
    const afterTaskChange = { ...sess, currentTaskId: 1, students: { a: { lastRunAt: 500 } } }
    expect(changedRosterWorkCandidates(collect(afterTaskChange), seen)).toEqual([])
  })

  it('treats a rematch to another roster entry as new', () => {
    const seen = new Map()
    collect(session()).forEach((c) => markRosterWorkSeen(seen, c))
    expect(changedRosterWorkCandidates(collect(session(), { a: 'r2' }), seen)).toHaveLength(2)
  })
})
