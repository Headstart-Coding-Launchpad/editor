// useBadgeSuggestions (memoised live suggestions) and useBadgeAutoAward (the tutor's auto-award
// toggle). The engine itself is characterised in src/badges/__tests__/liveTimeline.test.js.
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  groupBadgeSuggestions,
  pickAutoAwards,
  useBadgeAutoAward,
  useBadgeSuggestions,
} from '../useBadgeSuggestions'

const LESSON = {
  id: 'loops-101',
  type: 'python',
  title: 'Loops',
  tasks: [
    { id: 1, title: 'Type it out', taskActivity: 'Code Task, Copy the Code' },
    { id: 2, title: 'Fix the loop', taskActivity: 'Code Task, Debug Code Task' },
    { id: 3, title: 'Count up', taskActivity: 'Code Task' },
  ],
}

const attempt = (submission, loggedAt, passed = false, extra = {}) => ({
  submission,
  passed,
  attemptNumber: 1,
  retries: 0,
  loggedAt,
  ...(passed ? { passedAt: loggedAt } : {}),
  ...extra,
})

function makeSession() {
  return {
    state: 'active',
    currentTaskId: 2,
    students: {
      alex: { displayName: 'Alex', currentCode: '' },
      sam: { displayName: 'Sam', currentCode: '' },
    },
    attemptLog: {
      alex: { 2: { '-a1': attempt('fixed', 100, true) } },
      sam: {
        3: {
          '-s1': attempt('prnt(x)', 50, false, { error: 'NameError' }),
          '-s2': attempt('print(x)', 60, true),
        },
      },
    },
    studentSignals: { sam: { firstEdits: { 3: { elapsedMs: 4000, at: 40 } } } },
    badges: { alex: { helpful_coder: { status: 'awarded', source: 'manual', decidedAt: 1 } } },
  }
}

const ids = (suggestions) => suggestions.map((s) => `${s.studentId}:${s.badgeId}`).sort()

describe('useBadgeSuggestions', () => {
  it('returns suggestions grouped and counted per student, plus the decisions', () => {
    const session = makeSession()
    const { result } = renderHook(() => useBadgeSuggestions({ session, lesson: LESSON }))
    expect(ids(result.current.suggestions)).toEqual([
      'alex:bug_hunter',
      'sam:code_fixer',
      'sam:ready_to_code',
    ])
    expect(result.current.pendingCountByStudent).toEqual({ alex: 1, sam: 2 })
    expect(result.current.suggestionsByStudent.sam.map((s) => s.badgeId).sort()).toEqual([
      'code_fixer',
      'ready_to_code',
    ])
    expect(result.current.awardedCountByStudent).toEqual({ alex: 1 })
    expect(result.current.decisions).toEqual(session.badges)
  })

  it('returns the same result for fresh objects with the same inputs (snap.val() on every write)', () => {
    const { result, rerender } = renderHook(
      ({ session, lesson }) => useBadgeSuggestions({ session, lesson }),
      { initialProps: { session: makeSession(), lesson: LESSON } }
    )
    const first = result.current

    // An unrelated write (a keystroke from the watched student) and a rebuilt lesson object.
    const typed = makeSession()
    typed.students.alex.currentCode = 'print('
    rerender({ session: typed, lesson: structuredClone(LESSON) })
    expect(result.current).toBe(first)

    // A badge input changes: recomputed.
    const decided = makeSession()
    decided.badges.alex.bug_hunter = { status: 'dismissed', source: 'rule', decidedAt: 200 }
    rerender({ session: decided, lesson: LESSON })
    expect(result.current).not.toBe(first)
    expect(ids(result.current.suggestions)).toEqual(['sam:code_fixer', 'sam:ready_to_code'])
  })

  it('returns an empty result when disabled or without a session', () => {
    const { result } = renderHook(() =>
      useBadgeSuggestions({ session: makeSession(), lesson: LESSON, enabled: false })
    )
    expect(result.current.suggestions).toEqual([])
    const none = renderHook(() => useBadgeSuggestions({ session: null, lesson: LESSON }))
    expect(none.result.current.pendingCountByStudent).toEqual({})
  })

  it('passes the current task so Quiz Master can close a group the class moved past', () => {
    const lesson = {
      ...LESSON,
      badgeOptions: { quizMasterMinQuizzes: 2, quizMasterThreshold: 0.5 },
      tasks: [
        {
          id: 'g',
          type: 'group',
          title: 'Quiz',
          subtasks: [
            {
              id: 5,
              taskType: 'quiz',
              quizType: 'multiple_choice',
              check: { type: 'answer_equals', value: 'a' },
            },
            {
              id: 6,
              taskType: 'quiz',
              quizType: 'multiple_choice',
              check: { type: 'answer_equals', value: 'b' },
            },
          ],
        },
        { id: 7, title: 'Next', taskType: 'information' },
      ],
    }
    const session = {
      state: 'active',
      currentTaskId: 6,
      students: { alex: {} },
      attemptLog: { alex: { 5: { '-q1': attempt('"a"', 10, true) } } },
    }
    const { result, rerender } = renderHook(
      ({ s }) => useBadgeSuggestions({ session: s, lesson }),
      {
        initialProps: { s: session },
      }
    )
    expect(result.current.suggestions).toEqual([])
    rerender({ s: { ...session, currentTaskId: 7 } })
    expect(ids(result.current.suggestions)).toEqual(['alex:quiz_master'])
  })
})

describe('groupBadgeSuggestions', () => {
  it('does not count revoked or dismissed badges as awarded', () => {
    const { awardedCountByStudent } = groupBadgeSuggestions([], {
      alex: { a: { status: 'revoked' }, b: { status: 'dismissed' }, c: { status: 'awarded' } },
      sam: { a: { status: 'revoked' } },
    })
    expect(awardedCountByStudent).toEqual({ alex: 1 })
  })
})

const suggestion = (studentId, badgeId, extra = {}) => ({
  badgeId,
  studentId,
  taskId: 2,
  reason: `${badgeId} reason`,
  context: 'task',
  at: 1,
  ...extra,
})

describe('useBadgeAutoAward', () => {
  it('picks only autoAwardable badges', () => {
    const picked = pickAutoAwards([
      suggestion('alex', 'bug_hunter'),
      suggestion('alex', 'code_fixer'),
      suggestion('sam', 'quiz_master'),
    ])
    expect(ids(picked)).toEqual(['alex:bug_hunter', 'sam:quiz_master'])
  })

  it('awards autoAwardable suggestions with source auto, once per tab', () => {
    const decideBadge = vi.fn(() => Promise.resolve({ committed: true }))
    const suggestions = [suggestion('alex', 'bug_hunter'), suggestion('alex', 'persistence')]
    const { rerender } = renderHook(
      ({ list }) =>
        useBadgeAutoAward({ suggestions: list, settings: { autoAward: true }, decideBadge }),
      { initialProps: { list: suggestions } }
    )
    expect(decideBadge).toHaveBeenCalledTimes(1)
    expect(decideBadge).toHaveBeenCalledWith('alex', 'bug_hunter', {
      status: 'awarded',
      source: 'auto',
      reason: 'bug_hunter reason',
      taskId: 2,
      announce: true,
      bulkId: null,
    })
    // The decision hasn't reached the snapshot yet: the next write must not re-fire it.
    rerender({ list: [...suggestions] })
    expect(decideBadge).toHaveBeenCalledTimes(1)
  })

  it('does nothing while the toggle is off', () => {
    const decideBadge = vi.fn()
    renderHook(() =>
      useBadgeAutoAward({
        suggestions: [suggestion('alex', 'bug_hunter')],
        settings: { autoAward: false },
        decideBadge,
      })
    )
    renderHook(() =>
      useBadgeAutoAward({
        suggestions: [suggestion('alex', 'bug_hunter')],
        settings: null,
        decideBadge,
      })
    )
    expect(decideBadge).not.toHaveBeenCalled()
  })

  it('gives students awarded the same badge together one bulkId', () => {
    const decideBadge = vi.fn(() => Promise.resolve({ committed: true }))
    renderHook(() =>
      useBadgeAutoAward({
        suggestions: [suggestion('alex', 'quiz_master'), suggestion('sam', 'quiz_master')],
        settings: { autoAward: true },
        decideBadge,
      })
    )
    const bulkIds = decideBadge.mock.calls.map(([, , decision]) => decision.bulkId)
    expect(bulkIds[0]).toMatch(/^auto-quiz_master-/)
    expect(bulkIds[1]).toBe(bulkIds[0])
  })
})
