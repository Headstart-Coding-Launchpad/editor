import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import yaml from 'js-yaml'
import { buildSessionReport, reportToYamlText } from '../lessonReport'
import TeacherReportModal from '../../app/components/TeacherReportModal'
import binary from '../../activities/binary/definition.js'

// Plan step 2.4: `taskType: 'activity'` tasks report `{ taskType: 'activity', activityType }`
// through their definition (they used to report as code), with the submitted state parsed back
// into an object and the share of items right.

const binaryTask = {
  ...binary.defaultTask({ id: 1, title: 'Make the numbers' }),
  bits: 4,
  items: [
    { id: 'a', target: 5 },
    { id: 'b', target: 3 },
  ],
}

const lesson = {
  id: 'activities',
  title: 'Activities',
  type: 'python',
  tasks: [
    binaryTask,
    { id: 2, title: 'Future', taskType: 'activity', activityType: 'morse' },
    { id: 3, title: 'Code', check: { type: 'output_contains', value: 'hi' } },
  ],
}

const half = { v: 1, items: { a: { bits: '0101', carries: '' }, b: { bits: '0000', carries: '' } } }
const full = binary.solutionState(binaryTask)

const session = {
  lessonId: 'activities',
  startedAt: 1000,
  taskStartTimes: { 1: 1000 },
  students: { alice: {}, bob: {} },
  attemptLog: {
    alice: {
      1: {
        k1: {
          submission: JSON.stringify(half),
          passed: false,
          suggestion: 'Check the 2 column.',
          attemptNumber: 1,
          retries: 0,
          loggedAt: 1100,
        },
        k2: {
          submission: JSON.stringify(full),
          passed: true,
          suggestion: null,
          attemptNumber: 2,
          retries: 0,
          loggedAt: 1200,
          passedAt: 1200,
        },
      },
    },
    bob: {
      1: {
        k3: {
          submission: JSON.stringify(half),
          passed: false,
          suggestion: 'Check the 2 column.',
          attemptNumber: 1,
          retries: 0,
          loggedAt: 1150,
        },
      },
    },
  },
}

describe('session reports for activity tasks', () => {
  const report = buildSessionReport({ session, lesson })
  const aliceTask = report.students[0].tasks.find((t) => t.taskId === 1)
  const bobTask = report.students[1].tasks.find((t) => t.taskId === 1)
  const summary = report.taskSummary.find((t) => t.taskId === 1)

  it('reports taskType activity + activityType (not code)', () => {
    expect(aliceTask).toMatchObject({ taskType: 'activity', activityType: 'binary' })
    expect(summary).toMatchObject({ taskType: 'activity', activityType: 'binary' })
    expect(report.taskSummary.find((t) => t.taskId === 3).taskType).toBe('code')
  })

  it('parses submissions back into state and records the latest item progress', () => {
    expect(aliceTask.distinctAttempts[0].submission).toEqual(half)
    expect(aliceTask).toMatchObject({
      completed: true,
      finalResult: 'passed',
      itemProgress: { correct: 2, total: 2 },
    })
    expect(bobTask).toMatchObject({
      completed: false,
      finalResult: 'failed',
      itemProgress: { correct: 1, total: 2 },
    })
    expect(summary).toMatchObject({ completedCount: 1, totalStudents: 2, avgItemProgress: 0.75 })
    expect(summary.commonFailures).toEqual([{ suggestion: 'Check the 2 column.', count: 2 }])
  })

  it('reports an unknown activityType by name, as not applicable', () => {
    const unknown = report.taskSummary.find((t) => t.taskId === 2)
    expect(unknown).toMatchObject({ taskType: 'activity', activityType: 'morse' })
    expect(unknown.respondedCount).toBe(0)
  })

  it('exports to YAML with the activity fields', () => {
    const exported = yaml.load(reportToYamlText(report))
    expect(exported.taskSummary[0]).toMatchObject({
      taskType: 'activity',
      activityType: 'binary',
      avgItemProgress: 0.75,
    })
    expect(exported.students[1].tasks[0].itemProgress).toEqual({ correct: 1, total: 2 })
  })

  it('renders item progress in the teacher report modal', () => {
    render(<TeacherReportModal report={report} onClose={() => {}} />)
    expect(screen.getByText('1/2 (50%), 75% of items right')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Student 2'))
    expect(screen.getByText('1/2 items right')).toBeInTheDocument()
  })
})
