import { describe, expect, it } from 'vitest'
import {
  bumpExampleOpenCount,
  exampleOpenCount,
  exampleOpenPath,
  exampleOpenReportFields,
  exampleOpenStudentIds,
  normalizeExampleOpens,
  summarizeExampleOpens,
} from '../exampleOpens.js'
import { buildSessionReport } from '../lessonReport.js'

const session = {
  taskStartTimes: { t2: 1000 },
  exampleOpenLog: {
    ali: {
      t2: {
        0: { openedAt: 4000, lastOpenedAt: 9000, opens: 3 },
        1: { openedAt: 6000, lastOpenedAt: 6000, opens: 1 },
      },
    },
    bea: { t2: { 0: { lastOpenedAt: 5000 } } },
  },
}

describe('exampleOpens helpers', () => {
  it('builds the entry path', () => {
    expect(exampleOpenPath('L1', 'ali', 't2', 0)).toBe('sessions/L1/exampleOpenLog/ali/t2/0')
  })

  it('bumps a count from nothing or a bad value', () => {
    expect(bumpExampleOpenCount(null)).toBe(1)
    expect(bumpExampleOpenCount(-4)).toBe(1)
    expect(bumpExampleOpenCount(2)).toBe(3)
  })

  it('normalises a task log, sorted, dropping entries with no first open', () => {
    expect(normalizeExampleOpens(session.exampleOpenLog.ali.t2)).toEqual([
      { example: 1, openedAt: 4000, lastOpenedAt: 9000, opens: 3 },
      { example: 2, openedAt: 6000, opens: 1 },
    ])
    expect(normalizeExampleOpens(session.exampleOpenLog.bea.t2)).toEqual([])
    expect(normalizeExampleOpens(null)).toEqual([])
    expect(normalizeExampleOpens({ x: { openedAt: 1 } })).toEqual([])
    expect(normalizeExampleOpens({ 0: { openedAt: 1 } })).toEqual([
      { example: 1, openedAt: 1, opens: 1 },
    ])
  })

  it('counts a student’s opened examples on a task for the tutor', () => {
    expect(exampleOpenCount(session, 'ali', 't2')).toBe(2)
    expect(exampleOpenCount(session, 'bea', 't2')).toBe(0)
    expect(exampleOpenCount(session, 'ali', 't3')).toBe(0)
    expect(exampleOpenCount(null, 'ali', 't2')).toBe(0)
    expect(exampleOpenCount(session, null, 't2')).toBe(0)
  })

  it('gives report fields with the time after the task started', () => {
    expect(exampleOpenReportFields(session, 'ali', 't2')).toEqual({
      exampleOpens: [
        { example: 1, openedAt: 4000, lastOpenedAt: 9000, opens: 3, afterMs: 3000 },
        { example: 2, openedAt: 6000, opens: 1, afterMs: 5000 },
      ],
    })
    expect(exampleOpenReportFields(session, 'bea', 't2')).toEqual({})
    expect(
      exampleOpenReportFields({ exampleOpenLog: session.exampleOpenLog }, 'ali', 't2')
        .exampleOpens[0]
    ).not.toHaveProperty('afterMs')
  })

  it('summarises how many students opened one', () => {
    expect(summarizeExampleOpens([{ exampleOpens: [{}] }, {}, { exampleOpens: [] }])).toEqual({
      exampleOpenStudentCount: 1,
    })
    expect(summarizeExampleOpens([{}])).toEqual({})
    expect(exampleOpenStudentIds(session)).toEqual(['ali', 'bea'])
  })
})

describe('session report', () => {
  const lesson = {
    id: 'ex',
    type: 'python',
    title: 'Examples',
    tasks: [
      {
        id: 't2',
        title: 'Any other sport?',
        explainer: '```example python\nx = 1\n```',
        starterCode: 'sport = "golf"',
        check: { type: 'code_contains', value: 'else' },
      },
    ],
  }

  it('records each student’s example opens per task, and a task summary count', () => {
    const report = buildSessionReport({
      session: {
        ...session,
        students: {
          ali: { anonymousId: 'ali', displayName: 'Ali' },
          cal: { anonymousId: 'cal', displayName: 'Cal' },
        },
      },
      lesson,
    })
    const all = report.students.flatMap((student) => student.tasks)
    const opened = all.filter((task) => task.exampleOpens)
    expect(opened).toHaveLength(1)
    expect(opened[0].exampleOpens[0]).toMatchObject({ example: 1, afterMs: 3000, opens: 3 })
    expect(report.taskSummary[0]).toMatchObject({ exampleOpenStudentCount: 1 })
  })

  it('includes a student who only appears in the example log', () => {
    const report = buildSessionReport({ session, lesson })
    expect(report.students.length).toBeGreaterThanOrEqual(2)
  })
})
