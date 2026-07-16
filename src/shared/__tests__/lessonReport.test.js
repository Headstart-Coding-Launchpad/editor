import { describe, expect, it } from 'vitest'
import yaml from 'js-yaml'
import { anonymizeSessionReport, buildSessionReport, reportToYamlText } from '../lessonReport'

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
  taskStartTimes: { 1: 1000 },
  students: {
    alice: { displayName: 'Alice' },
    bob: { displayName: 'Bob' },
  },
  attemptLog: {
    alice: {
      1: {
        k1: { submission: 'print("hi")', passed: false, suggestion: 'missing hello', attemptNumber: 1, retries: 1, loggedAt: 1100 },
        k2: { submission: 'print("hello")', passed: true, suggestion: null, attemptNumber: 2, retries: 0, loggedAt: 1300, passedAt: 1300 },
      },
    },
    bob: {
      1: {
        k3: { submission: 'print("hi")', passed: false, suggestion: 'missing hello', attemptNumber: 1, retries: 0, loggedAt: 1200 },
      },
    },
  },
}

function studentByLabel(report, label) {
  return report.students.find(s => s.studentLabel === label)
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
    const alice = studentByLabel(report, 'Student 1')
    const bob = studentByLabel(report, 'Student 2')

    expect(alice.tasks[0]).toMatchObject({ completed: true, attempts: 3, finalResult: 'passed' })
    expect(bob.tasks[0]).toMatchObject({ completed: false, attempts: 1, finalResult: 'failed' })
  })

  it('preserves distinct attempts with submission and retry counts', () => {
    const report = buildSessionReport({ session, lesson })
    const alice = studentByLabel(report, 'Student 1')
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

  it('computes time on task from taskStartTimes to the passing attempt (or latest attempt if not completed)', () => {
    const report = buildSessionReport({ session, lesson })
    const alice = studentByLabel(report, 'Student 1')
    const bob = studentByLabel(report, 'Student 2')
    // Alice's task started at 1000, passed at 1300 -> 300ms on task
    expect(alice.tasks[0].timeOnTaskMs).toBe(300)
    // Bob hasn't passed; his latest (only) attempt was logged at 1200 -> 200ms so far
    expect(bob.tasks[0].timeOnTaskMs).toBe(200)
  })

  it('averages time on task across students who have a value', () => {
    const report = buildSessionReport({ session, lesson })
    expect(report.taskSummary[0].avgTimeOnTaskMs).toBe(250)
  })

  it('leaves time on task null when the task never started or no attempt was logged', () => {
    const withoutStart = { ...session, taskStartTimes: {} }
    const report = buildSessionReport({ session: withoutStart, lesson })
    expect(studentByLabel(report, 'Student 1').tasks[0].timeOnTaskMs).toBeNull()

    const withExtraStudent = {
      ...session,
      students: { ...session.students, cara: { displayName: 'Cara' } },
    }
    const withCara = buildSessionReport({ session: withExtraStudent, lesson })
    expect(studentByLabel(withCara, 'Student 3').tasks[0].timeOnTaskMs).toBeNull()
  })

  it('treats a student with no attemptLog entry as not attempted', () => {
    const withExtraStudent = {
      ...session,
      students: { ...session.students, cara: { displayName: 'Cara' } },
    }
    const report = buildSessionReport({ session: withExtraStudent, lesson })
    const cara = studentByLabel(report, 'Student 3')
    expect(cara.tasks[0]).toMatchObject({ completed: false, attempts: 0, finalResult: 'not attempted' })
  })

  it('does not include student names or anonymous IDs', () => {
    const report = buildSessionReport({ session, lesson })
    expect(report.students).toEqual([
      expect.objectContaining({ studentLabel: 'Student 1' }),
      expect.objectContaining({ studentLabel: 'Student 2' }),
    ])
    for (const student of report.students) {
      expect(student).not.toHaveProperty('displayName')
      expect(student).not.toHaveProperty('anonymousId')
    }
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

  it('strips student identity fields from older saved reports before export', () => {
    const report = buildSessionReport({ session, lesson })
    const oldReport = {
      ...report,
      students: [
        { anonymousId: 'alice', displayName: 'Alice', tasks: report.students[0].tasks },
      ],
    }
    const parsed = yaml.load(reportToYamlText(oldReport))
    expect(parsed.students).toEqual([
      { studentLabel: 'Student 1', tasks: report.students[0].tasks },
    ])
  })
})

describe('anonymizeSessionReport', () => {
  it('masks student identity fields from older saved reports', () => {
    const report = anonymizeSessionReport({
      students: [
        { anonymousId: 'alice', displayName: 'Alice', tasks: [] },
        { anonymousId: 'bob', displayName: 'Bob', studentLabel: 'Learner A', tasks: [] },
      ],
    })

    expect(report.students).toEqual([
      { studentLabel: 'Student 1', tasks: [] },
      { studentLabel: 'Student 2', tasks: [] },
    ])
  })
})
