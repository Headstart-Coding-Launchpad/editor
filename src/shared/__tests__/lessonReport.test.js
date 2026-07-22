import { describe, expect, it } from 'vitest'
import yaml from 'js-yaml'
import { anonymizeSessionReport, buildSessionReport, reportToYamlText } from '../lessonReport'

const lesson = {
  id: 'demo-lesson',
  title: 'Demo Lesson',
  tasks: [
    { id: 1, title: 'Code Task', check: { type: 'output_contains', value: 'hello' } },
    { id: 2, title: 'Just Info', taskType: 'information' },
    {
      id: 3,
      title: 'Multiple Choice',
      taskType: 'quiz',
      quizType: 'multiple_choice',
      options: [{ id: 'a', text: 'Yes' }, { id: 'b', text: 'No' }],
      check: { type: 'answer_equals', value: 'a' },
    },
    {
      id: 4,
      title: 'Fill Blank',
      taskType: 'quiz',
      quizType: 'fill_blank',
      mode: 'type',
      blanks: [
        { id: 'name', answer: 'Ada' },
        { id: 'language', answer: 'Python' },
      ],
    },
    {
      id: 5,
      title: 'Match',
      taskType: 'quiz',
      quizType: 'match',
      pairs: [
        { id: 'print', prompt: 'Shows text', answer: 'print()' },
        { id: 'input', prompt: 'Gets text', answer: 'input()' },
      ],
    },
    { id: 6, title: 'Confidence', taskType: 'quiz', quizType: 'confidence' },
    { id: 7, title: 'Open Answer', taskType: 'quiz', quizType: 'short_answer' },
  ],
}

const session = {
  lessonId: 'demo-lesson',
  startedAt: 1000,
  endedAt: 2000,
  taskStartTimes: { 1: 1000, 3: 1000, 4: 1000, 5: 1000, 6: 1000, 7: 1000 },
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
      3: {
        k3: { submission: 'a', passed: true, suggestion: null, attemptNumber: 1, retries: 0, loggedAt: 1150, passedAt: 1150 },
      },
      4: {
        k4: {
          submission: {
            name: { value: 'Ada', expected: 'Ada', correct: true },
            language: { value: 'JavaScript', expected: 'Python', correct: false },
          },
          passed: false,
          suggestion: 'Not quite right',
          attemptNumber: 1,
          retries: 0,
          loggedAt: 1160,
        },
        k5: {
          submission: {
            name: { value: 'Ada', expected: 'Ada', correct: true },
            language: { value: 'Python', expected: 'Python', correct: true },
          },
          passed: true,
          suggestion: null,
          attemptNumber: 2,
          retries: 0,
          loggedAt: 1180,
          passedAt: 1180,
        },
      },
      5: {
        k6: {
          submission: {
            print: { prompt: 'Shows text', value: 'input()', expected: 'print()', correct: false },
            input: { prompt: 'Gets text', value: 'input()', expected: 'input()', correct: true },
          },
          passed: false,
          suggestion: 'Not quite right',
          attemptNumber: 1,
          retries: 0,
          loggedAt: 1190,
        },
      },
      6: {
        k7: { submission: 3, passed: true, suggestion: null, attemptNumber: 1, retries: 0, loggedAt: 1210, passedAt: 1210 },
        k8: { submission: 4, passed: true, suggestion: null, attemptNumber: 2, retries: 0, loggedAt: 1220, passedAt: 1220 },
      },
      7: {
        k9: { submission: 'It prints text.', passed: true, suggestion: null, attemptNumber: 1, retries: 0, loggedAt: 1230, passedAt: 1230 },
      },
    },
    bob: {
      1: {
        k10: { submission: 'print("hi")', passed: false, suggestion: 'missing hello', attemptNumber: 1, retries: 0, loggedAt: 1200 },
      },
      4: {
        k11: {
          submission: JSON.stringify({ name: 'Ada', language: 'JavaScript' }),
          passed: false,
          suggestion: 'Not quite right',
          attemptNumber: 1,
          retries: 0,
          loggedAt: 1260,
        },
      },
      6: {
        k12: { submission: '5', passed: true, suggestion: null, attemptNumber: 1, retries: 0, loggedAt: 1270, passedAt: 1270 },
      },
    },
  },
}

function studentByLabel(report, label) {
  return report.students.find(s => s.studentLabel === label)
}

function taskById(items, taskId) {
  return items.find(t => t.taskId === taskId)
}

describe('buildSessionReport', () => {
  it('excludes information tasks and includes check-less quiz tasks', () => {
    const report = buildSessionReport({ session, lesson })
    expect(report.taskSummary.map(t => t.taskId)).toEqual([1, 3, 4, 5, 6, 7])
    for (const student of report.students) {
      expect(student.tasks.map(t => t.taskId)).toEqual([1, 3, 4, 5, 6, 7])
    }
  })

  it('adds explicit taskType and quizType fields', () => {
    const report = buildSessionReport({ session, lesson })
    expect(taskById(report.students[0].tasks, 1)).toMatchObject({ taskType: 'code' })
    expect(taskById(report.students[0].tasks, 3)).toMatchObject({ taskType: 'quiz', quizType: 'multiple_choice' })
    expect(taskById(report.taskSummary, 6)).toMatchObject({ taskType: 'quiz', quizType: 'confidence' })
  })

  it('computes checked-task completion, attempts, final result, and failures', () => {
    const report = buildSessionReport({ session, lesson })
    const alice = studentByLabel(report, 'Student 1')
    const bob = studentByLabel(report, 'Student 2')

    expect(taskById(alice.tasks, 1)).toMatchObject({ completed: true, attempts: 3, finalResult: 'passed' })
    expect(taskById(bob.tasks, 1)).toMatchObject({ completed: false, attempts: 1, finalResult: 'failed' })
    expect(taskById(bob.tasks, 3)).toMatchObject({ completed: false, attempts: 0, finalResult: 'not_attempted' })
    expect(taskById(report.taskSummary, 1).commonFailures).toEqual([{ suggestion: 'missing hello', count: 2 }])
  })

  it('preserves distinct attempts with submission and retry counts', () => {
    const report = buildSessionReport({ session, lesson })
    const aliceCode = taskById(studentByLabel(report, 'Student 1').tasks, 1)
    expect(aliceCode.distinctAttempts).toEqual([
      { attemptNumber: 1, passed: false, retries: 1, suggestion: 'missing hello', submission: 'print("hi")' },
      { attemptNumber: 2, passed: true, retries: 0, suggestion: null, submission: 'print("hello")' },
    ])
  })

  it('records fill-blank submissions and summarizes missed blanks', () => {
    const report = buildSessionReport({ session, lesson })
    const aliceFill = taskById(studentByLabel(report, 'Student 1').tasks, 4)
    expect(aliceFill.distinctAttempts[0].submission).toEqual({
      name: { value: 'Ada', expected: 'Ada', correct: true },
      language: { value: 'JavaScript', expected: 'Python', correct: false },
    })

    expect(taskById(report.taskSummary, 4).blankFailures).toEqual([
      {
        blankId: 'language',
        expected: 'Python',
        count: 2,
        values: [{ value: 'JavaScript', count: 2 }],
      },
    ])
  })

  it('records match submissions and summarizes missed pairs', () => {
    const report = buildSessionReport({ session, lesson })
    const aliceMatch = taskById(studentByLabel(report, 'Student 1').tasks, 5)
    expect(aliceMatch.distinctAttempts[0].submission).toEqual({
      print: { prompt: 'Shows text', value: 'input()', expected: 'print()', correct: false },
      input: { prompt: 'Gets text', value: 'input()', expected: 'input()', correct: true },
    })

    expect(taskById(report.taskSummary, 5).pairFailures).toEqual([
      {
        pairId: 'print',
        prompt: 'Shows text',
        expected: 'print()',
        count: 1,
        values: [{ value: 'input()', count: 1 }],
      },
    ])
  })

  it('reports confidence as not applicable with a rating distribution', () => {
    const report = buildSessionReport({ session, lesson })
    const aliceConfidence = taskById(studentByLabel(report, 'Student 1').tasks, 6)
    expect(aliceConfidence).toMatchObject({ completed: true, finalResult: 'not_applicable' })
    expect(aliceConfidence.distinctAttempts).toEqual([
      { attemptNumber: 1, passed: null, retries: 0, suggestion: null, submission: 3 },
      { attemptNumber: 2, passed: null, retries: 0, suggestion: null, submission: 4 },
    ])
    expect(taskById(report.taskSummary, 6)).toMatchObject({
      totalStudents: 2,
      respondedCount: 2,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 },
    })
  })

  it('reports open short-answer as not applicable once answered', () => {
    const report = buildSessionReport({ session, lesson })
    const aliceShort = taskById(studentByLabel(report, 'Student 1').tasks, 7)
    const bobShort = taskById(studentByLabel(report, 'Student 2').tasks, 7)
    expect(aliceShort).toMatchObject({ completed: true, finalResult: 'not_applicable' })
    expect(aliceShort.distinctAttempts[0]).toMatchObject({ passed: null, submission: 'It prints text.' })
    expect(bobShort).toMatchObject({ completed: false, finalResult: 'not_attempted' })
    expect(taskById(report.taskSummary, 7)).toMatchObject({ respondedCount: 1, totalStudents: 2 })
  })

  it('computes task summary across the class for checked tasks', () => {
    const report = buildSessionReport({ session, lesson })
    const summary = taskById(report.taskSummary, 1)
    expect(summary.totalStudents).toBe(2)
    expect(summary.completedCount).toBe(1)
    expect(summary.completionRate).toBe(0.5)
    expect(summary.avgAttempts).toBe(2)
    expect(summary.avgTimeOnTaskMs).toBe(250)
  })

  it('computes time on task from taskStartTimes to pass or latest attempt', () => {
    const report = buildSessionReport({ session, lesson })
    const alice = studentByLabel(report, 'Student 1')
    const bob = studentByLabel(report, 'Student 2')
    expect(taskById(alice.tasks, 1).timeOnTaskMs).toBe(300)
    expect(taskById(bob.tasks, 1).timeOnTaskMs).toBe(200)
  })

  it('leaves time on task null when the task never started or no attempt was logged', () => {
    const withoutStart = { ...session, taskStartTimes: {} }
    const report = buildSessionReport({ session: withoutStart, lesson })
    expect(taskById(studentByLabel(report, 'Student 1').tasks, 1).timeOnTaskMs).toBeNull()

    const withExtraStudent = {
      ...session,
      students: { ...session.students, cara: { displayName: 'Cara' } },
    }
    const withCara = buildSessionReport({ session: withExtraStudent, lesson })
    expect(taskById(studentByLabel(withCara, 'Student 3').tasks, 1).timeOnTaskMs).toBeNull()
  })

  it('reports teacher overrides after failed attempts without marking attempts passed', () => {
    const withOverride = {
      ...session,
      overrideLog: {
        bob: {
          1: { taskId: 1, overriddenAt: 1500, attemptNumber: 1, previousCheckState: 'failed' },
        },
      },
    }
    const report = buildSessionReport({ session: withOverride, lesson })
    const bobCode = taskById(studentByLabel(report, 'Student 2').tasks, 1)

    expect(bobCode).toMatchObject({
      completed: true,
      attempts: 1,
      finalResult: 'overridden_failed',
      timeOnTaskMs: 500,
      override: { taskId: 1, overriddenAt: 1500, attemptNumber: 1, previousCheckState: 'failed' },
    })
    expect(bobCode.distinctAttempts).toEqual([
      { attemptNumber: 1, passed: false, retries: 0, suggestion: 'missing hello', submission: 'print("hi")' },
    ])
    expect(taskById(report.taskSummary, 1)).toMatchObject({
      completedCount: 2,
      completionRate: 1,
      overrideCount: 1,
      overriddenFailedCount: 1,
      overriddenUnattemptedCount: 0,
    })
  })

  it('reports teacher overrides before any attempt separately from failed overrides', () => {
    const withUnattemptedOverride = {
      ...session,
      students: { ...session.students, cara: { displayName: 'Cara' } },
      overrideLog: {
        cara: {
          3: { taskId: 3, overriddenAt: 1400, attemptNumber: 0, previousCheckState: 'unattempted' },
        },
      },
    }
    const report = buildSessionReport({ session: withUnattemptedOverride, lesson })
    const caraChoice = taskById(studentByLabel(report, 'Student 3').tasks, 3)

    expect(caraChoice).toMatchObject({
      completed: true,
      attempts: 0,
      finalResult: 'overridden_unattempted',
      timeOnTaskMs: 400,
      override: { taskId: 3, overriddenAt: 1400, attemptNumber: 0, previousCheckState: 'unattempted' },
      distinctAttempts: [],
    })
    expect(taskById(report.taskSummary, 3)).toMatchObject({
      completedCount: 2,
      completionRate: 0.67,
      overrideCount: 1,
      overriddenFailedCount: 0,
      overriddenUnattemptedCount: 1,
    })
  })

  it('includes carry walk-back metadata in student rows and task summaries', () => {
    const carryLesson = {
      id: 'carry-demo',
      title: 'Carry Demo',
      tasks: [
        { id: 1, title: 'Build One', check: { type: 'output_contains', value: 'one' } },
        { id: 2, title: 'Skipped Bridge', carryCodeFrom: 1, check: { type: 'output_contains', value: 'two' } },
        { id: 3, title: 'Continue', carryCodeFrom: 2, check: { type: 'output_contains', value: 'three' } },
      ],
    }
    const carrySession = {
      lessonId: 'carry-demo',
      startedAt: 1000,
      endedAt: 2000,
      students: { alice: { displayName: 'Alice' } },
      carryFallbackLog: {
        alice: {
          3: {
            taskId: 3,
            field: 'carryCodeFrom',
            requestedSourceTaskId: 2,
            resolvedSourceTaskId: 1,
            skippedSourceTaskIds: [2],
            fallbackAt: 1500,
          },
        },
      },
    }

    const report = buildSessionReport({ session: carrySession, lesson: carryLesson })
    expect(taskById(studentByLabel(report, 'Student 1').tasks, 3).carryFallback).toEqual({
      taskId: 3,
      field: 'carryCodeFrom',
      requestedSourceTaskId: 2,
      resolvedSourceTaskId: 1,
      skippedSourceTaskIds: [2],
      fallbackAt: 1500,
    })
    expect(taskById(report.taskSummary, 3)).toMatchObject({
      carryFallbackCount: 1,
      carryFallbacks: [{
        field: 'carryCodeFrom',
        requestedSourceTaskId: 2,
        resolvedSourceTaskId: 1,
        skippedSourceTaskIds: [2],
        count: 1,
      }],
    })
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
