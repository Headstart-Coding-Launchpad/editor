import { describe, it, expect } from 'vitest'
import {
  classHolderCounts,
  rankStudentSuggestions,
  topStudentSuggestion,
} from '../suggestionRanking'

const s = (badgeId, extra = {}) => ({
  badgeId,
  studentId: 'a',
  taskId: 1,
  reason: `why ${badgeId}`,
  at: 100,
  ...extra,
})

describe('classHolderCounts', () => {
  it('counts only awarded decisions per badge', () => {
    expect(
      classHolderCounts({
        a: { bug_hunter: { status: 'awarded' }, persistence: { status: 'revoked' } },
        b: { bug_hunter: { status: 'awarded' } },
      })
    ).toEqual({ bug_hunter: 2 })
  })
})

describe('rankStudentSuggestions', () => {
  it('keeps only this student and drops badges already decided', () => {
    const rows = rankStudentSuggestions({
      suggestions: [s('bug_hunter'), s('persistence', { studentId: 'b' }), s('brave_coder')],
      studentId: 'a',
      decisions: { a: { brave_coder: { status: 'dismissed' } } },
    })
    expect(rows.map((r) => r.badgeId)).toEqual(['bug_hunter'])
  })

  it('puts a match on the current task first, then the most recent', () => {
    const rows = rankStudentSuggestions({
      suggestions: [
        s('persistence', { taskId: 1, at: 900 }),
        s('bug_hunter', { taskId: 2, at: 100 }),
        s('brave_coder', { taskId: 2, at: 500 }),
      ],
      studentId: 'a',
      currentTaskId: 2,
    })
    expect(rows.map((r) => r.badgeId)).toEqual(['brave_coder', 'bug_hunter', 'persistence'])
  })

  it('breaks ties by fewer holders in the class, then badge id', () => {
    const rows = rankStudentSuggestions({
      suggestions: [s('persistence'), s('bug_hunter'), s('brave_coder')],
      studentId: 'a',
      decisions: {
        b: { bug_hunter: { status: 'awarded' } },
        c: { bug_hunter: { status: 'awarded' } },
      },
    })
    expect(rows.map((r) => r.badgeId)).toEqual(['brave_coder', 'persistence', 'bug_hunter'])
  })

  it('ranks an unknown time last and handles a missing reason', () => {
    const rows = rankStudentSuggestions({
      suggestions: [s('bug_hunter', { at: null, reason: '' }), s('persistence', { at: 5 })],
      studentId: 'a',
    })
    expect(rows.map((r) => r.badgeId)).toEqual(['persistence', 'bug_hunter'])
    expect(rows[1].reason).toBeNull()
  })

  it('carries the badge description from the registry', () => {
    const top = topStudentSuggestion({ suggestions: [s('bug_hunter')], studentId: 'a' })
    expect(top.description).toBe('Found and fixed a bug.')
    expect(top.reason).toBe('why bug_hunter')
  })

  it('returns null when nothing is suggested', () => {
    expect(topStudentSuggestion({ suggestions: [], studentId: 'a' })).toBeNull()
  })
})
