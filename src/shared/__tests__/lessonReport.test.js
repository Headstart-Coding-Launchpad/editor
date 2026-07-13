import { describe, expect, it } from 'vitest'
import yaml from 'js-yaml'
import { buildSessionReport, reportToYamlText } from '../lessonReport'

const lesson = {
  id: 'demo-lesson',
  title: 'Demo Lesson',
  tasks: [
    { id: 1, title: 'Task One', check: { type: 'output_contains', value: 'hello' } },
    { id: 2, title: 'Just Info', taskType: 'information' },
  ],
}

const session = {
  lessonId: 'demo-lesson',
  startedAt: 1000,
  endedAt: 2000,
  students: {
    alice: { displayName: 'Alice' },
    bob: { displayName: 'Bob' },
  },
  attemptLog: {
    alice: {
      1: {
        k1: { submission: 'print("hi")', passed: false, suggestion: 'missing hello', attemptNumber: 1, retries: 1 },
        k2: { submission: 'print("hello")', passed: true, suggestion: null, attemptNumber: 2, retries: 0 },
      },
    },
    bob: {
      1: {
        k3: { submission: 'print("hi")', passed: false, suggestion: 'missing hello', attemptNumber: 1, retries: 0 },
      },
    },
  },
}

describe('buildSessionReport', () => {
  it('excludes information tasks (no check to grade)', () => {
    const report = buildSessionReport({ session, lesson })
    expect(report.taskSummary.map(t => t.taskId)).toEqual([1])
    for (const student of report.students) {
      expect(student.tasks.map(t => t.taskId)).toEqual([1])
    }
  })

  it('computes per-student completion, attempts, and final result', () => {
    const report = buildSessionReport({ session, lesson })
    const alice = report.students.find(s => s.anonymousId === 'alice')
    const bob = report.students.find(s => s.anonymousId === 'bob')

    expect(alice.tasks[0]).toMatchObject({ completed: true, attempts: 3, finalResult: 'passed' })
    expect(bob.tasks[0]).toMatchObject({ completed: false, attempts: 1, finalResult: 'failed' })
  })

  it('preserves distinct attempts with submission and retry counts', () => {
    const report = buildSessionReport({ session, lesson })
    const alice = report.students.find(s => s.anonymousId === 'alice')
    expect(alice.tasks[0].distinctAttempts).toEqual([
      { attemptNumber: 1, passed: false, retries: 1, suggestion: 'missing hello', submission: 'print("hi")' },
      { attemptNumber: 2, passed: true, retries: 0, suggestion: null, submission: 'print("hello")' },
    ])
  })

  it('aggregates a task summary across the class', () => {
    const report = buildSessionReport({ session, lesson })
    const summary = report.taskSummary[0]
    expect(summary.totalStudents).toBe(2)
    expect(summary.completedCount).toBe(1)
    expect(summary.completionRate).toBe(0.5)
    expect(summary.avgAttempts).toBe(2)
    expect(summary.commonFailures).toEqual([{ suggestion: 'missing hello', count: 2 }])
  })

  it('treats a student with no attemptLog entry as not attempted', () => {
    const withExtraStudent = {
      ...session,
      students: { ...session.students, cara: { displayName: 'Cara' } },
    }
    const report = buildSessionReport({ session: withExtraStudent, lesson })
    const cara = report.students.find(s => s.anonymousId === 'cara')
    expect(cara.tasks[0]).toMatchObject({ completed: false, attempts: 0, finalResult: 'not attempted' })
  })

  it('carries session and lesson identifiers', () => {
    const report = buildSessionReport({ session, lesson })
    expect(report.lessonId).toBe('demo-lesson')
    expect(report.lessonTitle).toBe('Demo Lesson')
    expect(report.sessionId).toBe('1000')
    expect(report.startedAt).toBe(1000)
    expect(report.endedAt).toBe(2000)
  })
})

describe('reportToYamlText', () => {
  it('produces YAML that round-trips back to an equivalent object', () => {
    const report = buildSessionReport({ session, lesson })
    const yamlText = reportToYamlText(report)
    expect(typeof yamlText).toBe('string')
    expect(yaml.load(yamlText)).toEqual(report)
  })
})
