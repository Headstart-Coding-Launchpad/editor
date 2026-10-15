import { describe, it, expect } from 'vitest'
import { courseLogEntry, courseReportFields, summarizeCourseUse } from '../courseUse.js'

describe('courseLogEntry', () => {
  it("sums a run's maps: goal on every map, maps crashed, pickups collected", () => {
    expect(
      courseLogEntry({
        maps: [
          { goalReached: true, crashed: false, pickups: 2 },
          { goalReached: false, crashed: true, pickups: 1 },
        ],
      })
    ).toEqual({ goal: false, crashes: 1, pickups: 3 })
    expect(courseLogEntry({ maps: [{ goalReached: true, pickups: 0 }] })).toEqual({
      goal: true,
      crashes: 0,
      pickups: 0,
    })
  })

  it('is null without course maps', () => {
    expect(courseLogEntry(null)).toBeNull()
    expect(courseLogEntry({ maps: [] })).toBeNull()
  })
})

describe('courseReportFields', () => {
  it('is empty when the student never ran the course', () => {
    expect(courseReportFields(undefined)).toEqual({})
    expect(courseReportFields({ runs: 0 })).toEqual({})
  })

  it('reports runs, goal reached, crashes and the last pickups', () => {
    expect(
      courseReportFields({
        runs: 4,
        goalRuns: 1,
        crashes: 3,
        pickups: 2,
        lastGoalReached: true,
        lastAt: 1,
      })
    ).toEqual({
      course: {
        runs: 4,
        goalReached: true,
        goalRuns: 1,
        crashes: 3,
        pickups: 2,
        lastGoalReached: true,
      },
    })
    expect(courseReportFields({ runs: 2, crashes: 'x' }).course).toEqual({
      runs: 2,
      goalReached: false,
      goalRuns: 0,
      crashes: 0,
      pickups: 0,
      lastGoalReached: false,
    })
  })
})

describe('summarizeCourseUse', () => {
  it('counts students who reached the goal and who crashed', () => {
    expect(
      summarizeCourseUse([
        { course: { goalReached: true, crashes: 0 } },
        { course: { goalReached: false, crashes: 2 } },
        { course: { goalReached: true, crashes: 1 } },
        {},
      ])
    ).toEqual({ courseGoalReachedCount: 2, courseCrashedCount: 2 })
    expect(summarizeCourseUse([{}])).toEqual({})
  })
})
