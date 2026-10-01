import { describe, expect, it } from 'vitest'
import yaml from 'js-yaml'
import {
  anonymizeSessionReport,
  attachTeacherFeedback,
  buildSessionReport,
  encodeSessionReportForFirestore,
  reportToYamlText,
} from '../lessonReport'
import { buildQuizSubmission } from '../../app/studentQuizContent'
import {
  ALL_LEGACY_ACTIVITY_TASKS,
  CONFIDENCE_TASK,
  FILL_BLANK_DRAG_TASK,
  FILL_BLANK_TYPE_TASK,
  MATCH_TASK,
  legacyActivityLesson,
} from '../../test/fixtures/legacyActivityTasks'

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
      options: [
        { id: 'a', text: 'Yes' },
        { id: 'b', text: 'No' },
      ],
      check: { type: 'answer_equals', value: 'a' },
    },
    {
      id: 4,
      title: 'Fill Blank',
      priority: 'optional',
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
        k1: {
          submission: 'print("hi")',
          passed: false,
          suggestion: 'missing hello',
          attemptNumber: 1,
          retries: 1,
          loggedAt: 1100,
        },
        k2: {
          submission: 'print("hello")',
          passed: true,
          suggestion: null,
          attemptNumber: 2,
          retries: 0,
          loggedAt: 1300,
          passedAt: 1300,
        },
      },
      3: {
        k3: {
          submission: 'a',
          passed: true,
          suggestion: null,
          attemptNumber: 1,
          retries: 0,
          loggedAt: 1150,
          passedAt: 1150,
        },
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
        k7: {
          submission: 3,
          passed: true,
          suggestion: null,
          attemptNumber: 1,
          retries: 0,
          loggedAt: 1210,
          passedAt: 1210,
        },
        k8: {
          submission: 4,
          passed: true,
          suggestion: null,
          attemptNumber: 2,
          retries: 0,
          loggedAt: 1220,
          passedAt: 1220,
        },
      },
      7: {
        k9: {
          submission: 'It prints text.',
          passed: true,
          suggestion: null,
          attemptNumber: 1,
          retries: 0,
          loggedAt: 1230,
          passedAt: 1230,
        },
      },
    },
    bob: {
      1: {
        k10: {
          submission: 'print("hi")',
          passed: false,
          suggestion: 'missing hello',
          attemptNumber: 1,
          retries: 0,
          loggedAt: 1200,
        },
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
        k12: {
          submission: '5',
          passed: true,
          suggestion: null,
          attemptNumber: 1,
          retries: 0,
          loggedAt: 1270,
          passedAt: 1270,
        },
      },
    },
  },
}

function studentByLabel(report, label) {
  return report.students.find((s) => s.studentLabel === label)
}

function taskById(items, taskId) {
  return items.find((t) => t.taskId === taskId)
}

describe('buildSessionReport', () => {
  it('excludes information tasks and includes check-less quiz tasks', () => {
    const report = buildSessionReport({ session, lesson })
    expect(report.taskSummary.map((t) => t.taskId)).toEqual([1, 3, 4, 5, 6, 7])
    for (const student of report.students) {
      expect(student.tasks.map((t) => t.taskId)).toEqual([1, 3, 4, 5, 6, 7])
    }
  })

  it('adds explicit taskType and quizType fields', () => {
    const report = buildSessionReport({ session, lesson })
    expect(taskById(report.students[0].tasks, 1)).toMatchObject({ taskType: 'code' })
    expect(taskById(report.students[0].tasks, 3)).toMatchObject({
      taskType: 'quiz',
      quizType: 'multiple_choice',
    })
    expect(taskById(report.taskSummary, 6)).toMatchObject({
      taskType: 'quiz',
      quizType: 'confidence',
    })
  })

  it('adds defaulted priority to task summaries', () => {
    const report = buildSessionReport({ session, lesson })
    expect(taskById(report.taskSummary, 1)).toMatchObject({ priority: 'core' })
    expect(taskById(report.taskSummary, 4)).toMatchObject({ priority: 'optional' })
  })

  it('computes checked-task completion, attempts, final result, and failures', () => {
    const report = buildSessionReport({ session, lesson })
    const alice = studentByLabel(report, 'Student 1')
    const bob = studentByLabel(report, 'Student 2')

    expect(taskById(alice.tasks, 1)).toMatchObject({
      completed: true,
      attempts: 3,
      finalResult: 'passed',
    })
    expect(taskById(bob.tasks, 1)).toMatchObject({
      completed: false,
      attempts: 1,
      finalResult: 'failed',
    })
    expect(taskById(bob.tasks, 3)).toMatchObject({
      completed: false,
      attempts: 0,
      finalResult: 'not_attempted',
    })
    expect(taskById(report.taskSummary, 1).commonFailures).toEqual([
      { suggestion: 'missing hello', count: 2 },
    ])
  })

  it('preserves distinct attempts with submission and retry counts', () => {
    const report = buildSessionReport({ session, lesson })
    const aliceCode = taskById(studentByLabel(report, 'Student 1').tasks, 1)
    expect(aliceCode.distinctAttempts).toEqual([
      {
        attemptNumber: 1,
        passed: false,
        retries: 1,
        suggestion: 'missing hello',
        submission: 'print("hi")',
      },
      {
        attemptNumber: 2,
        passed: true,
        retries: 0,
        suggestion: null,
        submission: 'print("hello")',
      },
    ])
  })

  it('parses a JSON-stringified code-task submission back to an object, and leaves plain code strings alone', () => {
    // logAttempt now always writes submission as a JSON string (see useSession.js), since an
    // object-shaped submission — Scratch workspace state, a filesystem tree, an HTML file map —
    // can contain values the Realtime Database's set() rejects outright. The report should
    // still read as structured data for those, not an escaped JSON blob.
    const scratchLesson = {
      id: 'scratch-lesson',
      title: 'Scratch Lesson',
      tasks: [{ id: 1, title: 'Say Hello', check: { type: 'block_run', opcode: 'looks_say' } }],
    }
    const scratchSession = {
      lessonId: 'scratch-lesson',
      startedAt: 1000,
      endedAt: 2000,
      taskStartTimes: { 1: 1000 },
      students: { alice: { displayName: 'Alice' } },
      attemptLog: {
        alice: {
          1: {
            k1: {
              submission: JSON.stringify({ sprite1: { blocks: { blocks: [] } } }),
              passed: true,
              suggestion: null,
              attemptNumber: 1,
              retries: 0,
              loggedAt: 1100,
              passedAt: 1100,
            },
          },
        },
      },
    }
    const report = buildSessionReport({ session: scratchSession, lesson: scratchLesson })
    const aliceScratch = taskById(studentByLabel(report, 'Student 1').tasks, 1)
    expect(aliceScratch.distinctAttempts[0].submission).toEqual({
      sprite1: { blocks: { blocks: [] } },
    })
    expect(aliceScratch.attempts).toBe(1)
    expect(aliceScratch.finalResult).toBe('passed')
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
    expect(aliceShort.distinctAttempts[0]).toMatchObject({
      passed: null,
      submission: 'It prints text.',
    })
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
      {
        attemptNumber: 1,
        passed: false,
        retries: 0,
        suggestion: 'missing hello',
        submission: 'print("hi")',
      },
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
      override: {
        taskId: 3,
        overriddenAt: 1400,
        attemptNumber: 0,
        previousCheckState: 'unattempted',
      },
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
        {
          id: 2,
          title: 'Skipped Bridge',
          carryCodeFrom: 1,
          check: { type: 'output_contains', value: 'two' },
        },
        {
          id: 3,
          title: 'Continue',
          carryCodeFrom: 2,
          check: { type: 'output_contains', value: 'three' },
        },
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
      carryFallbacks: [
        {
          field: 'carryCodeFrom',
          requestedSourceTaskId: 2,
          resolvedSourceTaskId: 1,
          skippedSourceTaskIds: [2],
          count: 1,
        },
      ],
    })
  })

  it('includes support-stage reveal metadata in student rows and task summaries', () => {
    const withReveals = {
      ...session,
      supportRevealLog: {
        alice: {
          1: {
            0: {
              taskId: 1,
              stageIndex: 0,
              stageLabel: 'With name started',
              source: 'student',
              attemptNumber: 2,
              revealedAt: 1250,
            },
          },
        },
        bob: {
          1: {
            0: {
              taskId: 1,
              stageIndex: 0,
              stageLabel: 'With name started',
              source: 'teacher',
              attemptNumber: 1,
              revealedAt: 1260,
            },
          },
        },
      },
    }
    const report = buildSessionReport({ session: withReveals, lesson })

    expect(taskById(studentByLabel(report, 'Student 1').tasks, 1).supportReveals).toEqual([
      {
        taskId: 1,
        stageIndex: 0,
        stageLabel: 'With name started',
        source: 'student',
        attemptNumber: 2,
        revealedAt: 1250,
      },
    ])
    expect(taskById(studentByLabel(report, 'Student 2').tasks, 1).supportReveals).toEqual([
      {
        taskId: 1,
        stageIndex: 0,
        stageLabel: 'With name started',
        source: 'teacher',
        attemptNumber: 1,
        revealedAt: 1260,
      },
    ])
    expect(taskById(report.taskSummary, 1)).toMatchObject({
      supportRevealCount: 2,
      supportRevealStudentCount: 2,
      supportRevealSources: { teacher: 1, student: 1 },
    })
  })

  it('keeps "every task" (teacher-auto) reveals as their own source', () => {
    const withAuto = {
      ...session,
      supportRevealLog: {
        alice: {
          1: { 0: { taskId: 1, stageIndex: 0, stageLabel: 'Hint', source: 'teacher-auto' } },
        },
      },
    }
    const report = buildSessionReport({ session: withAuto, lesson })
    expect(taskById(studentByLabel(report, 'Student 1').tasks, 1).supportReveals[0].source).toBe(
      'teacher-auto'
    )
    expect(taskById(report.taskSummary, 1).supportRevealSources).toEqual({
      teacher: 0,
      student: 0,
      'teacher-auto': 1,
    })
  })

  it('reports large pastes per student task and per task summary', () => {
    const withPastes = {
      ...session,
      students: {
        ...session.students,
        alice: { ...session.students.alice, pasteLog: { 1: { count: 2, chars: 180, lastAt: 1 } } },
      },
    }
    const report = buildSessionReport({ session: withPastes, lesson })
    expect(taskById(studentByLabel(report, 'Student 1').tasks, 1).pastes).toEqual({
      count: 2,
      chars: 180,
    })
    expect(taskById(studentByLabel(report, 'Student 2').tasks, 1).pastes).toBeUndefined()
    expect(taskById(report.taskSummary, 1)).toMatchObject({ pasteCount: 2, pastedStudentCount: 1 })
  })

  it("folds a live per-task teacher rating into that task's summary", () => {
    const withTaskRating = {
      ...session,
      taskRatingLog: {
        1: {
          taskId: 1,
          rating: 4,
          whatWorkedWell: 'Good pacing',
          whatDidntWork: 'Check was flaky',
          submittedAt: 1300,
        },
      },
    }
    const report = buildSessionReport({ session: withTaskRating, lesson })

    expect(taskById(report.taskSummary, 1).teacherRating).toEqual({
      rating: 4,
      whatWorkedWell: 'Good pacing',
      whatDidntWork: 'Check was flaky',
      submittedAt: 1300,
    })
    expect(taskById(report.taskSummary, 3)).not.toHaveProperty('teacherRating')
  })

  it('omits teacherRating for a task rating log entry left entirely blank', () => {
    const withBlankRating = {
      ...session,
      taskRatingLog: { 1: { taskId: 1, rating: null, whatWorkedWell: '', whatDidntWork: '' } },
    }
    const report = buildSessionReport({ session: withBlankRating, lesson })

    expect(taskById(report.taskSummary, 1)).not.toHaveProperty('teacherRating')
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

describe('attachTeacherFeedback', () => {
  it('attaches a trimmed rating and feedback text with a submitted timestamp', () => {
    const report = buildSessionReport({ session, lesson })
    const result = attachTeacherFeedback(report, {
      rating: 4,
      whatWorkedWell: '  Great pace  ',
      whatDidntWork: '  Iframe crashed once  ',
    })
    expect(result.teacherFeedback).toMatchObject({
      rating: 4,
      whatWorkedWell: 'Great pace',
      whatDidntWork: 'Iframe crashed once',
    })
    expect(typeof result.teacherFeedback.submittedAt).toBe('number')
  })

  it('returns the report unchanged when the teacher left every field blank', () => {
    const report = buildSessionReport({ session, lesson })
    const result = attachTeacherFeedback(report, {
      rating: null,
      whatWorkedWell: '  ',
      whatDidntWork: '',
    })
    expect(result).toBe(report)
    expect(result.teacherFeedback).toBeUndefined()
  })

  it('returns the report unchanged when no feedback is passed', () => {
    const report = buildSessionReport({ session, lesson })
    expect(attachTeacherFeedback(report, undefined)).toBe(report)
  })

  it('discards an out-of-range rating', () => {
    const report = buildSessionReport({ session, lesson })
    const result = attachTeacherFeedback(report, {
      rating: 7,
      whatWorkedWell: 'Fine',
      whatDidntWork: '',
    })
    expect(result.teacherFeedback.rating).toBeNull()
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
      students: [{ anonymousId: 'alice', displayName: 'Alice', tasks: report.students[0].tasks }],
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

describe('student join history', () => {
  const joinSession = {
    ...session,
    students: {
      alice: {
        displayName: 'Alice',
        joinedAt: 5000, // latest name entry: overwritten on re-join, so never reported
        firstJoinedAt: 1600,
        firstJoinTaskId: 3,
        rejoins: [
          { at: 1900, taskId: 5 },
          { at: 1700, taskId: 4 },
        ],
      },
      bob: { displayName: 'Bob', firstJoinedAt: 900, firstJoinTaskId: 1 },
    },
  }

  it('reports the first join, the gap after the start, the task at join and rejoins in time order', () => {
    const report = buildSessionReport({ session: joinSession, lesson })
    const [alice, bob] = report.students
    expect(alice).toMatchObject({
      joinedAt: 1600,
      joinedAfterMs: 600,
      joinedAtTaskId: 3,
      rejoins: [
        { at: 1700, taskId: 4 },
        { at: 1900, taskId: 5 },
      ],
    })
    // Joined in the waiting room, before the session started: clamped to 0, no rejoins.
    expect(bob).toMatchObject({ joinedAt: 900, joinedAfterMs: 0, joinedAtTaskId: 1 })
    expect(bob).not.toHaveProperty('rejoins')
  })

  it('reads rejoins stored as an RTDB object', () => {
    const report = buildSessionReport({
      session: {
        ...joinSession,
        students: {
          alice: { firstJoinedAt: 1600, rejoins: { 0: { at: 1800, taskId: 4 }, 1: { at: 1750 } } },
        },
      },
      lesson,
    })
    expect(report.students[0].rejoins).toEqual([{ at: 1750 }, { at: 1800, taskId: 4 }])
  })

  it('omits every join field when the session has no join history (older sessions)', () => {
    const report = buildSessionReport({
      session: { ...session, students: { alice: { displayName: 'Alice', joinedAt: 1500 } } },
      lesson,
    })
    for (const student of report.students) {
      expect(student).not.toHaveProperty('joinedAt')
      expect(student).not.toHaveProperty('joinedAfterMs')
      expect(student).not.toHaveProperty('joinedAtTaskId')
      expect(student).not.toHaveProperty('rejoins')
    }
  })

  it('omits joinedAfterMs when the session start is unknown', () => {
    const report = buildSessionReport({
      session: { ...joinSession, startedAt: null },
      lesson,
    })
    expect(report.students[0].joinedAt).toBe(1600)
    expect(report.students[0]).not.toHaveProperty('joinedAfterMs')
  })

  it('keeps the join fields through anonymisation', () => {
    const report = anonymizeSessionReport(buildSessionReport({ session: joinSession, lesson }))
    expect(report.students[0]).toMatchObject({
      studentLabel: 'Student 1',
      joinedAt: 1600,
      joinedAfterMs: 600,
      joinedAtTaskId: 3,
      rejoins: [
        { at: 1700, taskId: 4 },
        { at: 1900, taskId: 5 },
      ],
    })
    expect(report.students[0]).not.toHaveProperty('displayName')
    expect(report.students[0]).not.toHaveProperty('anonymousId')
  })
})

describe('encodeSessionReportForFirestore', () => {
  it('re-stringifies object-shaped submissions so Firestore never sees a raw array-in-array', () => {
    // Blockly's mutator/extraState serialization can nest an array directly
    // inside another array — a shape Firestore rejects outright.
    const nestedArraySubmission = {
      sprite1: { blocks: { blocks: [{ extraState: { params: [['x', 'y']] } }] } },
    }
    const report = {
      students: [
        {
          studentLabel: 'Student 1',
          tasks: [
            {
              taskId: 1,
              distinctAttempts: [
                { attemptNumber: 1, passed: false, submission: nestedArraySubmission },
                { attemptNumber: 2, passed: true, submission: 'print("hi")' },
              ],
            },
          ],
        },
      ],
    }

    const encoded = encodeSessionReportForFirestore(report)

    const [first, second] = encoded.students[0].tasks[0].distinctAttempts
    expect(typeof first.submission).toBe('string')
    expect(JSON.parse(first.submission)).toEqual(nestedArraySubmission)
    expect(second.submission).toBe('print("hi")')
  })

  it('passes through reports with no students unchanged', () => {
    expect(encodeSessionReportForFirestore(null)).toBe(null)
    expect(encodeSessionReportForFirestore({ sessionId: 'x' })).toEqual({ sessionId: 'x' })
  })

  it('marks a pass reached through a teacher answer edit as teacher assisted', () => {
    const assistedSession = {
      ...session,
      attemptLog: {
        ...session.attemptLog,
        bob: {
          ...(session.attemptLog.bob ?? {}),
          5: {
            t1: {
              submission: '{}',
              passed: true,
              teacherAssisted: true,
              attemptNumber: 1,
              retries: 0,
              loggedAt: 1500,
              passedAt: 1500,
            },
          },
        },
      },
    }
    const report = buildSessionReport({ session: assistedSession, lesson })
    const bob = studentByLabel(report, 'Student 2')
    expect(taskById(bob.tasks, 5)).toMatchObject({ completed: true, teacherAssisted: true })
    expect(taskById(report.taskSummary, 5).teacherAssistedCount).toBe(1)
    expect(taskById(report.taskSummary, 1).teacherAssistedCount).toBe(0)
  })
})

// Phase 0 characterisation (docs/architecture/modular-activities-plan.md step 0.3):
// the full per-task summary for quiz and code_arrange tasks, built from attempt
// entries shaped exactly as useSession.logAttempt writes them (submission is
// always a string: JSON.stringify(buildQuizSubmission(...)) for object shapes).
describe('characterisation: buildSessionReport for legacy quiz + code_arrange tasks', () => {
  function attempt(submission, passed, extra = {}) {
    return {
      submission: typeof submission === 'string' ? submission : JSON.stringify(submission),
      passed,
      suggestion: null,
      retries: 0,
      ...extra,
    }
  }
  function entries(...list) {
    return Object.fromEntries(list.map((entry, i) => [`k${i}`, { attemptNumber: i + 1, ...entry }]))
  }

  const fixtureLesson = legacyActivityLesson(Object.values(ALL_LEGACY_ACTIVITY_TASKS))
  const matchWrong = buildQuizSubmission(MATCH_TASK, { p1: 'p2', p2: 'p1', p3: 'p3' })
  const matchRight = buildQuizSubmission(MATCH_TASK, { p1: 'p1', p2: 'p2', p3: 'p3' })
  const fillWrong = buildQuizSubmission(FILL_BLANK_DRAG_TASK, { b1: 'b1', b2: 'd1' })
  const fillBothWrong = buildQuizSubmission(FILL_BLANK_DRAG_TASK, { b1: 'b2', b2: 'd1' })

  const fixtureSession = {
    lessonId: 'legacy-activities',
    startedAt: 1000,
    endedAt: 9000,
    taskStartTimes: { 1: 1000, 2: 2000, 7: 7000, 8: 8000 },
    students: { alice: { displayName: 'Alice' }, bob: { displayName: 'Bob' } },
    attemptLog: {
      alice: {
        1: entries(
          attempt('b', false, {
            suggestion: 'input() asks the user a question.',
            retries: 2,
            loggedAt: 1100,
          }),
          attempt('a', true, { loggedAt: 1400, passedAt: 1400 })
        ),
        2: entries(
          attempt(matchWrong, false, { suggestion: 'Check each pair again.', loggedAt: 2100 }),
          attempt(matchRight, true, { teacherAssisted: true, loggedAt: 2500, passedAt: 2500 })
        ),
        3: entries(attempt(fillWrong, false, { suggestion: '' })),
        4: entries(attempt(buildQuizSubmission(FILL_BLANK_TYPE_TASK, { t1: 'loop' }), true)),
        6: entries(attempt('I learned about loops', true)),
        7: entries(
          attempt(JSON.stringify(buildQuizSubmission(CONFIDENCE_TASK, '3')), true, {
            loggedAt: 7100,
          }),
          attempt(JSON.stringify(buildQuizSubmission(CONFIDENCE_TASK, '4')), true, {
            loggedAt: 7200,
          })
        ),
        8: entries(
          attempt('for i in range(10):\n    print(i * 2)', false, {
            suggestion: 'Check the output',
            loggedAt: 8100,
          }),
          attempt('for i in range(5):\n    print(i * 2)', true, { loggedAt: 8300, passedAt: 8300 })
        ),
      },
      bob: {
        1: entries(attempt('c', false, { suggestion: 'Think about showing text.' })),
        2: entries(attempt(matchWrong, false, { suggestion: 'Check each pair again.' })),
        3: entries(attempt(fillBothWrong, false)),
        5: entries(attempt('It prints', false, { suggestion: 'Mention what print shows.' })),
        7: entries(attempt('5', true)),
      },
    },
  }

  it('pins the task summary for every sub-type', () => {
    const report = buildSessionReport({ session: fixtureSession, lesson: fixtureLesson })
    expect(report.taskSummary).toMatchInlineSnapshot(`
      [
        {
          "avgAttempts": 2.5,
          "avgTimeOnTaskMs": 400,
          "carryFallbackCount": 0,
          "carryFallbacks": [],
          "commonFailures": [
            {
              "count": 1,
              "suggestion": "input() asks the user a question.",
            },
            {
              "count": 1,
              "suggestion": "Think about showing text.",
            },
          ],
          "completedCount": 1,
          "completionRate": 0.5,
          "firstRealPass": {
            "afterMs": 400,
            "studentLabel": "Student 1",
          },
          "overriddenFailedCount": 0,
          "overriddenUnattemptedCount": 0,
          "overrideCount": 0,
          "priority": "core",
          "quizType": "multiple_choice",
          "supportRevealCount": 0,
          "supportRevealSources": {
            "student": 0,
            "teacher": 0,
          },
          "supportRevealStudentCount": 0,
          "taskId": 1,
          "taskType": "quiz",
          "teacherAssistedCount": 0,
          "title": "Pick the output function",
          "totalStudents": 2,
        },
        {
          "avgAttempts": 1.5,
          "avgTimeOnTaskMs": 500,
          "carryFallbackCount": 0,
          "carryFallbacks": [],
          "commonFailures": [
            {
              "count": 2,
              "suggestion": "Check each pair again.",
            },
          ],
          "completedCount": 1,
          "completionRate": 0.5,
          "overriddenFailedCount": 0,
          "overriddenUnattemptedCount": 0,
          "overrideCount": 0,
          "pairFailures": [
            {
              "count": 2,
              "expected": "Shows text",
              "pairId": "p1",
              "prompt": "print()",
              "values": [
                {
                  "count": 2,
                  "value": "Asks a question",
                },
              ],
            },
            {
              "count": 2,
              "expected": "Asks a question",
              "pairId": "p2",
              "prompt": "input()",
              "values": [
                {
                  "count": 2,
                  "value": "Shows text",
                },
              ],
            },
          ],
          "priority": "core",
          "quizType": "match",
          "supportRevealCount": 0,
          "supportRevealSources": {
            "student": 0,
            "teacher": 0,
          },
          "supportRevealStudentCount": 0,
          "taskId": 2,
          "taskType": "quiz",
          "teacherAssistedCount": 1,
          "title": "Match each function",
          "totalStudents": 2,
        },
        {
          "avgAttempts": 1,
          "avgTimeOnTaskMs": null,
          "blankFailures": [
            {
              "blankId": "b2",
              "count": 2,
              "expected": "input",
              "values": [
                {
                  "count": 2,
                  "value": "len",
                },
              ],
            },
            {
              "blankId": "b1",
              "count": 1,
              "expected": "print",
              "values": [
                {
                  "count": 1,
                  "value": "input",
                },
              ],
            },
          ],
          "carryFallbackCount": 0,
          "carryFallbacks": [],
          "commonFailures": [],
          "completedCount": 0,
          "completionRate": 0,
          "overriddenFailedCount": 0,
          "overriddenUnattemptedCount": 0,
          "overrideCount": 0,
          "priority": "core",
          "quizType": "fill_blank",
          "supportRevealCount": 0,
          "supportRevealSources": {
            "student": 0,
            "teacher": 0,
          },
          "supportRevealStudentCount": 0,
          "taskId": 3,
          "taskType": "quiz",
          "teacherAssistedCount": 0,
          "title": "Fill the gaps (drag)",
          "totalStudents": 2,
        },
        {
          "avgAttempts": 1,
          "avgTimeOnTaskMs": null,
          "blankFailures": [],
          "carryFallbackCount": 0,
          "carryFallbacks": [],
          "commonFailures": [],
          "completedCount": 1,
          "completionRate": 0.5,
          "overriddenFailedCount": 0,
          "overriddenUnattemptedCount": 0,
          "overrideCount": 0,
          "priority": "core",
          "quizType": "fill_blank",
          "supportRevealCount": 0,
          "supportRevealSources": {
            "student": 0,
            "teacher": 0,
          },
          "supportRevealStudentCount": 0,
          "taskId": 4,
          "taskType": "quiz",
          "teacherAssistedCount": 0,
          "title": "Fill the gap (typed)",
          "totalStudents": 2,
        },
        {
          "avgAttempts": 1,
          "avgTimeOnTaskMs": null,
          "carryFallbackCount": 0,
          "carryFallbacks": [],
          "commonFailures": [
            {
              "count": 1,
              "suggestion": "Mention what print shows.",
            },
          ],
          "completedCount": 0,
          "completionRate": 0,
          "overriddenFailedCount": 0,
          "overriddenUnattemptedCount": 0,
          "overrideCount": 0,
          "priority": "core",
          "quizType": "short_answer",
          "supportRevealCount": 0,
          "supportRevealSources": {
            "student": 0,
            "teacher": 0,
          },
          "supportRevealStudentCount": 0,
          "taskId": 5,
          "taskType": "quiz",
          "teacherAssistedCount": 0,
          "title": "Explain print",
          "totalStudents": 2,
        },
        {
          "avgTimeOnTaskMs": null,
          "carryFallbackCount": 0,
          "carryFallbacks": [],
          "commonFailures": [],
          "overriddenFailedCount": 0,
          "overriddenUnattemptedCount": 0,
          "overrideCount": 0,
          "priority": "core",
          "quizType": "short_answer",
          "respondedCount": 1,
          "supportRevealCount": 0,
          "supportRevealSources": {
            "student": 0,
            "teacher": 0,
          },
          "supportRevealStudentCount": 0,
          "taskId": 6,
          "taskType": "quiz",
          "title": "Reflect",
          "totalStudents": 2,
        },
        {
          "avgTimeOnTaskMs": 100,
          "carryFallbackCount": 0,
          "carryFallbacks": [],
          "commonFailures": [],
          "overriddenFailedCount": 0,
          "overriddenUnattemptedCount": 0,
          "overrideCount": 0,
          "priority": "core",
          "quizType": "confidence",
          "ratingDistribution": {
            "1": 0,
            "2": 0,
            "3": 0,
            "4": 1,
            "5": 1,
          },
          "respondedCount": 2,
          "supportRevealCount": 0,
          "supportRevealSources": {
            "student": 0,
            "teacher": 0,
          },
          "supportRevealStudentCount": 0,
          "taskId": 7,
          "taskType": "quiz",
          "title": "How confident are you?",
          "totalStudents": 2,
        },
        {
          "avgAttempts": 2,
          "avgTimeOnTaskMs": 300,
          "carryFallbackCount": 0,
          "carryFallbacks": [],
          "commonFailures": [
            {
              "count": 1,
              "suggestion": "Check the output",
            },
          ],
          "completedCount": 1,
          "completionRate": 0.5,
          "firstRealPass": {
            "afterMs": 300,
            "studentLabel": "Student 1",
          },
          "overriddenFailedCount": 0,
          "overriddenUnattemptedCount": 0,
          "overrideCount": 0,
          "priority": "core",
          "supportRevealCount": 0,
          "supportRevealSources": {
            "student": 0,
            "teacher": 0,
          },
          "supportRevealStudentCount": 0,
          "taskId": 8,
          "taskType": "code",
          "teacherAssistedCount": 0,
          "title": "Print the first five even numbers",
          "totalStudents": 2,
        },
        {
          "avgAttempts": 0,
          "avgTimeOnTaskMs": null,
          "carryFallbackCount": 0,
          "carryFallbacks": [],
          "commonFailures": [],
          "completedCount": 0,
          "completionRate": 0,
          "overriddenFailedCount": 0,
          "overriddenUnattemptedCount": 0,
          "overrideCount": 0,
          "priority": "core",
          "supportRevealCount": 0,
          "supportRevealSources": {
            "student": 0,
            "teacher": 0,
          },
          "supportRevealStudentCount": 0,
          "taskId": 9,
          "taskType": "code",
          "teacherAssistedCount": 0,
          "title": "Arrange a heading and paragraph",
          "totalStudents": 2,
        },
      ]
    `)
  })

  it("pins each quiz/code_arrange row for one student's report", () => {
    const report = buildSessionReport({ session: fixtureSession, lesson: fixtureLesson })
    const alice = studentByLabel(report, 'Student 1')
    expect(
      alice.tasks.map((task) => ({
        taskId: task.taskId,
        taskType: task.taskType,
        quizType: task.quizType,
        completed: task.completed,
        finalResult: task.finalResult,
        teacherAssisted: task.teacherAssisted,
        submissions: task.distinctAttempts.map((a) => [a.passed, a.submission]),
      }))
    ).toMatchInlineSnapshot(`
      [
        {
          "completed": true,
          "finalResult": "passed",
          "quizType": "multiple_choice",
          "submissions": [
            [
              false,
              "b",
            ],
            [
              true,
              "a",
            ],
          ],
          "taskId": 1,
          "taskType": "quiz",
          "teacherAssisted": undefined,
        },
        {
          "completed": true,
          "finalResult": "passed",
          "quizType": "match",
          "submissions": [
            [
              false,
              {
                "p1": {
                  "correct": false,
                  "expected": "Shows text",
                  "prompt": "print()",
                  "value": "Asks a question",
                },
                "p2": {
                  "correct": false,
                  "expected": "Asks a question",
                  "prompt": "input()",
                  "value": "Shows text",
                },
                "p3": {
                  "correct": true,
                  "expected": "Counts items",
                  "prompt": "len()",
                  "value": "Counts items",
                },
              },
            ],
            [
              true,
              {
                "p1": {
                  "correct": true,
                  "expected": "Shows text",
                  "prompt": "print()",
                  "value": "Shows text",
                },
                "p2": {
                  "correct": true,
                  "expected": "Asks a question",
                  "prompt": "input()",
                  "value": "Asks a question",
                },
                "p3": {
                  "correct": true,
                  "expected": "Counts items",
                  "prompt": "len()",
                  "value": "Counts items",
                },
              },
            ],
          ],
          "taskId": 2,
          "taskType": "quiz",
          "teacherAssisted": true,
        },
        {
          "completed": false,
          "finalResult": "failed",
          "quizType": "fill_blank",
          "submissions": [
            [
              false,
              {
                "b1": {
                  "correct": true,
                  "expected": "print",
                  "value": "print",
                },
                "b2": {
                  "correct": false,
                  "expected": "input",
                  "value": "len",
                },
              },
            ],
          ],
          "taskId": 3,
          "taskType": "quiz",
          "teacherAssisted": undefined,
        },
        {
          "completed": true,
          "finalResult": "passed",
          "quizType": "fill_blank",
          "submissions": [
            [
              true,
              {
                "t1": {
                  "correct": true,
                  "expected": "Loop",
                  "value": "loop",
                },
              },
            ],
          ],
          "taskId": 4,
          "taskType": "quiz",
          "teacherAssisted": undefined,
        },
        {
          "completed": false,
          "finalResult": "not_attempted",
          "quizType": "short_answer",
          "submissions": [],
          "taskId": 5,
          "taskType": "quiz",
          "teacherAssisted": undefined,
        },
        {
          "completed": true,
          "finalResult": "not_applicable",
          "quizType": "short_answer",
          "submissions": [
            [
              null,
              "I learned about loops",
            ],
          ],
          "taskId": 6,
          "taskType": "quiz",
          "teacherAssisted": undefined,
        },
        {
          "completed": true,
          "finalResult": "not_applicable",
          "quizType": "confidence",
          "submissions": [
            [
              null,
              3,
            ],
            [
              null,
              4,
            ],
          ],
          "taskId": 7,
          "taskType": "quiz",
          "teacherAssisted": undefined,
        },
        {
          "completed": true,
          "finalResult": "passed",
          "quizType": undefined,
          "submissions": [
            [
              false,
              "for i in range(10):
          print(i * 2)",
            ],
            [
              true,
              "for i in range(5):
          print(i * 2)",
            ],
          ],
          "taskId": 8,
          "taskType": "code",
          "teacherAssisted": undefined,
        },
        {
          "completed": false,
          "finalResult": "not_attempted",
          "quizType": undefined,
          "submissions": [],
          "taskId": 9,
          "taskType": "code",
          "teacherAssisted": undefined,
        },
      ]
    `)
  })
})
