// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { getActivityDefinition, getTaskActivity, isLegacyQuizTask } from '../../registry.pure.js'
import { buildQuizSubmission } from '../../quiz/quizActivity.js'
import { switchQuizType } from '../../quiz/quizBuilder.js'
import { quizHasCheckValue, quizHasStarter } from '../../legacyValidation.js'
import { validateLessonForMcp } from '../../../../cli/validate.mjs'
import { validateLesson } from '../../../builder/lessonUtils.js'
import { buildSessionReport } from '../../../shared/lessonReport.js'
import { validateDraftLessonStructure } from '../../../shared/draftLesson.js'

const POLL_TASK = {
  id: 1,
  title: 'What next?',
  taskType: 'quiz',
  quizType: 'poll',
  explainer: 'What would you like to do next?',
  options: [
    { id: 'a', text: 'Games' },
    { id: 'b', text: 'Art' },
    { id: 'c', text: 'Music' },
  ],
}

const errorsFor = (task) => getTaskActivity(task).validateTask(task, { n: 1 }).errors

describe('quiz_poll definition', () => {
  const activity = getActivityDefinition('quiz_poll')

  it('resolves quizType poll as an ungraded, never-complete-by-itself legacy quiz', () => {
    expect(getTaskActivity(POLL_TASK).id).toBe('quiz_poll')
    expect(isLegacyQuizTask(POLL_TASK)).toBe(true)
    expect(activity.label).toBe('Poll')
    expect(activity.legacy).toEqual({ taskType: 'quiz', quizType: 'poll' })
    expect(activity.yaml).toEqual({ type: 'quiz', quizType: 'poll' })
    expect(activity.completion).toBe('none')
    expect(activity.isGraded(POLL_TASK)).toBe(false)
    expect(activity.category).toBe('quiz')
  })

  it('records any choice as a response, never a wrong answer', () => {
    expect(activity.grade(POLL_TASK, 'a')).toEqual({ passed: true, suggestion: '' })
    expect(activity.grade(POLL_TASK, 'c')).toEqual({ passed: true, suggestion: '' })
  })

  it('stores the chosen option id and drops ids the task no longer has', () => {
    expect(activity.serialize('b')).toBe('b')
    expect(activity.deserialize('b', POLL_TASK)).toBe('b')
    expect(activity.deserialize('z', POLL_TASK)).toBe('')
    expect(activity.deserialize(null, POLL_TASK)).toBe('')
    expect(buildQuizSubmission(POLL_TASK, 'b')).toBe('b')
  })

  it('summarises the choice for the teacher card', () => {
    expect(activity.summarize(POLL_TASK, 'b')).toEqual({ text: 'b Art', tone: 'neutral' })
  })

  it('has a valid default task, and switching to a poll strips marking fields', () => {
    expect(errorsFor(activity.defaultTask({ id: 1 }))).toEqual([])
    const switched = switchQuizType(
      {
        ...POLL_TASK,
        quizType: 'multiple_choice',
        options: [
          { id: 'a', text: 'A', feedback: 'no' },
          { id: 'b', text: 'B' },
        ],
        check: { type: 'answer_equals', value: 'b' },
      },
      'poll'
    )
    expect(switched.quizType).toBe('poll')
    expect(switched.check).toBeNull()
    expect(switched.options).toEqual([
      { id: 'a', text: 'A' },
      { id: 'b', text: 'B' },
    ])
    expect(errorsFor(switched)).toEqual([])
  })

  it('prints its options', () => {
    const esc = (value) => String(value)
    expect(activity.printHtml(POLL_TASK, { esc })).toContain('<td>Games</td>')
  })
})

describe('quiz_poll validation', () => {
  it('accepts a 2 to 6 option poll', () => {
    expect(errorsFor(POLL_TASK)).toEqual([])
    expect(quizHasStarter(POLL_TASK)).toBe(true)
    expect(quizHasCheckValue(POLL_TASK)).toBe(true)
  })

  it.each([
    [{ options: [{ id: 'a', text: 'Only' }] }, 'Task 1 is a poll but has fewer than 2 options'],
    [{ options: undefined }, 'Task 1 is a poll but has fewer than 2 options'],
    [
      {
        options: ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => ({ id, text: id.toUpperCase() })),
      },
      'Task 1 is a poll but has more than 6 options',
    ],
    [
      {
        options: [
          { id: 'a', text: 'A' },
          { id: 'b', text: '  ' },
        ],
      },
      'Task 1 is a poll but has an empty option text',
    ],
    [
      {
        options: [{ id: 'a', text: 'A' }, { text: 'B' }],
      },
      'Task 1 is a poll but has an option with no id',
    ],
    [
      {
        options: [
          { id: 'a', text: 'A' },
          { id: 'a', text: 'B' },
        ],
      },
      'Task 1 is a poll but has duplicate option ids',
    ],
    [
      { check: { type: 'answer_equals', value: 'a' } },
      'Task 1 is a poll but has a check (polls are never marked)',
    ],
  ])('rejects %j', (overrides, message) => {
    expect(errorsFor({ ...POLL_TASK, ...overrides })).toContain(message)
  })

  it('is valid in the Builder and CLI validators and the lesson shape check', () => {
    const lesson = {
      id: 'poll-lesson',
      title: 'Poll lesson',
      description: 'A lesson with a poll',
      type: 'python',
      tasks: [POLL_TASK],
    }
    expect(validateLesson(lesson).errors).toEqual([])
    expect(validateLessonForMcp(lesson).errors).toEqual([])
    const shapeErrors = []
    validateDraftLessonStructure(lesson, shapeErrors)
    expect(shapeErrors).toEqual([])
  })
})

describe('quiz_poll session report', () => {
  it('reports responses (not passes) and the option distribution', () => {
    const lesson = { id: 'poll-lesson', title: 'Poll lesson', tasks: [POLL_TASK] }
    const attempt = (submission, attemptNumber) => ({
      attemptNumber,
      passed: true,
      submission,
      loggedAt: 1000 + attemptNumber,
    })
    const session = {
      startedAt: 1,
      students: { s1: {}, s2: {}, s3: {} },
      attemptLog: {
        // s1 changed their mind: only the latest choice counts.
        s1: { 1: { x1: attempt('a', 1), x2: attempt('b', 2) } },
        s2: { 1: { x1: attempt('b', 1) } },
      },
    }
    const report = buildSessionReport({ session, lesson })
    const summary = report.taskSummary[0]
    expect(summary).toMatchObject({ taskType: 'quiz', quizType: 'poll', respondedCount: 2 })
    expect(summary.optionDistribution).toEqual([
      { id: 'a', text: 'Games', count: 0 },
      { id: 'b', text: 'Art', count: 2 },
      { id: 'c', text: 'Music', count: 0 },
    ])
    expect(summary).not.toHaveProperty('completionRate')
    const s1 = report.students[0].tasks[0]
    expect(s1.distinctAttempts.map((a) => [a.submission, a.passed])).toEqual([
      ['a', null],
      ['b', null],
    ])
  })
})
