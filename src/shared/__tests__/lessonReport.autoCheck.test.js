// @vitest-environment node
// The session report's reconciliation of class-advance overrides, tutor hand passes and
// auto-check-on-leave records (src/shared/autoCheck.js).
import { describe, expect, it } from 'vitest'
import { buildSessionReport, encodeSessionReportForFirestore } from '../lessonReport'

const lesson = {
  id: 'auto-lesson',
  title: 'Auto Lesson',
  tasks: [
    { id: 1, title: 'Checked', check: { type: 'code', operator: 'contains', value: 'for' } },
    { id: 2, title: 'Free practice' },
    {
      id: 3,
      title: 'Quiz',
      taskType: 'quiz',
      quizType: 'multiple_choice',
      options: [
        { id: 'a', text: 'Yes' },
        { id: 'b', text: 'No' },
      ],
      check: { type: 'answer_equals', value: 'a' },
    },
  ],
}

const advance = (taskId, previousCheckState = 'unattempted', extra = {}) => ({
  taskId,
  overriddenAt: 1500,
  attemptNumber: previousCheckState === 'failed' ? 1 : 0,
  previousCheckState,
  source: 'class_advance',
  ...extra,
})

const leave = (autoResult, extra = {}) => ({
  submission: 'for i in x: pass',
  passed: false,
  suggestion: null,
  auto: 'leave',
  autoResult,
  attemptNumber: 0,
  retries: 0,
  loggedAt: 1600,
  ...extra,
})

const failed = (extra = {}) => ({
  submission: 'print(1)',
  passed: false,
  suggestion: 'Use for',
  attemptNumber: 1,
  retries: 0,
  loggedAt: 1200,
  ...extra,
})

function report(session) {
  return buildSessionReport({
    session: { startedAt: 1000, taskStartTimes: { 1: 1000, 2: 1000, 3: 1000 }, ...session },
    lesson,
  })
}

function task(rep, label, taskId) {
  return rep.students
    .find((student) => student.studentLabel === label)
    .tasks.find((t) => t.taskId === taskId)
}

const summary = (rep, taskId) => rep.taskSummary.find((t) => t.taskId === taskId)

describe('session report — class advance and auto-check on leave', () => {
  it('a class-advance override on a graded task is no longer complete', () => {
    const rep = report({
      students: { a: {}, b: {} },
      attemptLog: { b: { 1: { k1: failed() } } },
      overrideLog: { a: { 1: advance(1) }, b: { 1: advance(1, 'failed') } },
    })
    expect(task(rep, 'Student 1', 1)).toMatchObject({
      completed: false,
      finalResult: 'overridden_unattempted',
      override: { source: 'class_advance' },
    })
    expect(task(rep, 'Student 2', 1)).toMatchObject({
      completed: false,
      finalResult: 'overridden_failed',
      attempts: 1,
    })
    expect(summary(rep, 1)).toMatchObject({ completedCount: 0, overrideCount: 2 })
  })

  it('a class-advance override on a graded quiz still counts as complete', () => {
    const rep = report({ students: { a: {} }, overrideLog: { a: { 3: advance(3) } } })
    expect(task(rep, 'Student 1', 3)).toMatchObject({
      completed: true,
      finalResult: 'overridden_unattempted',
    })
  })

  it('a check-less code task moved past keeps counting as complete', () => {
    const rep = report({ students: { a: {} }, overrideLog: { a: { 2: advance(2) } } })
    expect(task(rep, 'Student 1', 2)).toMatchObject({
      completed: true,
      finalResult: 'overridden_unattempted',
    })
  })

  it("a tutor's hand pass and a pre-source override still count as complete", () => {
    const rep = report({
      students: { a: {}, b: {} },
      attemptLog: { a: { 1: { k1: failed() } } },
      overrideLog: {
        a: { 1: advance(1, 'failed', { source: 'teacher' }) },
        b: { 1: { taskId: 1, overriddenAt: 1500, previousCheckState: 'unattempted' } },
      },
    })
    expect(task(rep, 'Student 1', 1)).toMatchObject({
      completed: true,
      finalResult: 'overridden_failed',
    })
    expect(task(rep, 'Student 2', 1)).toMatchObject({
      completed: true,
      finalResult: 'overridden_unattempted',
    })
    expect(task(rep, 'Student 2', 1).override).not.toHaveProperty('source')
  })

  it('a leave record decides the result over the class-advance override', () => {
    const rep = report({
      students: { a: {}, b: {}, c: {} },
      attemptLog: {
        a: { 1: { l1: leave('passed') } },
        b: { 1: { l1: leave('failed', { suggestion: 'Use for' }) } },
        c: { 1: { l1: leave('not_run') } },
      },
      overrideLog: { a: { 1: advance(1) }, b: { 1: advance(1) }, c: { 1: advance(1) } },
    })
    expect(task(rep, 'Student 1', 1)).toMatchObject({
      completed: true,
      finalResult: 'auto_passed',
      attempts: 0,
      distinctAttempts: [],
      timeOnTaskMs: 600,
      autoCheck: {
        result: 'passed',
        submission: 'for i in x: pass',
        checkedAt: 1600,
        suggestion: null,
      },
    })
    expect(task(rep, 'Student 2', 1)).toMatchObject({
      completed: false,
      finalResult: 'auto_failed',
      attempts: 0,
      autoCheck: { result: 'failed', suggestion: 'Use for' },
    })
    expect(task(rep, 'Student 3', 1)).toMatchObject({
      completed: false,
      finalResult: 'auto_not_run',
    })
    expect(summary(rep, 1)).toMatchObject({
      completedCount: 1,
      autoPassedCount: 1,
      autoFailedCount: 1,
      autoNotRunCount: 1,
      overrideCount: 0,
      // The leave records never reach the common failures.
      commonFailures: [],
    })
  })

  it('a leave record decides the result even when the override arrived first or not at all', () => {
    const rep = report({
      students: { a: {} },
      attemptLog: { a: { 1: { l1: leave('passed') } } },
    })
    expect(task(rep, 'Student 1', 1)).toMatchObject({ completed: true, finalResult: 'auto_passed' })
  })

  it('a real pass beats a leave record; leave records never add attempts', () => {
    const rep = report({
      students: { a: {} },
      attemptLog: {
        a: {
          1: {
            l1: leave('failed', { loggedAt: 1100 }),
            k1: failed({ retries: 2 }),
            k2: failed({ attemptNumber: 2, passed: true, passedAt: 1900, loggedAt: 1900 }),
          },
        },
      },
    })
    const result = task(rep, 'Student 1', 1)
    expect(result).toMatchObject({ completed: true, finalResult: 'passed', attempts: 4 })
    expect(result).not.toHaveProperty('autoCheck')
    expect(result.distinctAttempts).toHaveLength(2)
  })

  it('not run after real failed attempts falls back to the runs the student made', () => {
    const rep = report({
      students: { a: {} },
      attemptLog: { a: { 1: { k1: failed(), l1: leave('not_run') } } },
      overrideLog: { a: { 1: advance(1, 'failed') } },
    })
    expect(task(rep, 'Student 1', 1)).toMatchObject({
      completed: false,
      finalResult: 'overridden_failed',
      attempts: 1,
      autoCheck: { result: 'not_run' },
    })
  })

  it('a later leave record (the class came back and moved on again) wins', () => {
    const rep = report({
      students: { a: {} },
      attemptLog: {
        a: { 1: { l2: leave('passed', { loggedAt: 2600 }), l1: leave('failed') } },
      },
    })
    expect(task(rep, 'Student 1', 1).finalResult).toBe('auto_passed')
  })

  it('leaves the auto-check summary fields out when nobody was auto-checked', () => {
    const rep = report({ students: { a: {} }, overrideLog: { a: { 1: advance(1) } } })
    expect(summary(rep, 1)).not.toHaveProperty('autoPassedCount')
  })

  it('stringifies an object-shaped auto-check submission for Firestore', () => {
    const rep = report({
      students: { a: {} },
      attemptLog: {
        a: { 1: { l1: leave('failed', { submission: JSON.stringify({ '/': { type: 'dir' } }) }) } },
      },
    })
    const encoded = encodeSessionReportForFirestore(rep)
    const auto = encoded.students[0].tasks.find((t) => t.taskId === 1).autoCheck
    expect(typeof auto.submission).toBe('string')
  })
})
