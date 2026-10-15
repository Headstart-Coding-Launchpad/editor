import { describe, it, expect } from 'vitest'
import { COURSE_CHECK_HINTS, COURSE_CHECK_TYPES, evaluateCourseCheck } from '../courseChecks.js'
import { checkNeedsRunResult, evaluateSingleCheck, getCheckDefinition } from '../../checks.js'
import { validateLesson } from '../../../builder/lessonUtils'
import { validateLessonForMcp } from '../../../../cli/validate.mjs'

function context(maps) {
  return { turtle: { state: null, commands: [], calls: [], course: { type: 'grid', maps } } }
}

const reached = {
  status: 'success',
  goalReached: true,
  crashed: false,
  pickups: 2,
  pickupsTotal: 2,
  moves: 6,
}
const crashed = {
  status: 'success',
  goalReached: false,
  crashed: true,
  pickups: 1,
  pickupsTotal: 2,
  moves: 3,
}
const notRun = {
  status: 'not_run',
  goalReached: false,
  crashed: false,
  pickups: 0,
  pickupsTotal: 2,
  moves: 0,
}

describe('course checks', () => {
  it('are registered Turtle checks that need a run', () => {
    for (const type of COURSE_CHECK_TYPES) {
      expect(getCheckDefinition(type)?.owner).toBe('module:turtle')
      expect(checkNeedsRunResult({ type })).toBe(true)
      expect(COURSE_CHECK_HINTS[type]).toEqual(expect.any(String))
    }
  })

  it('course_goal_reached: on every map', () => {
    const check = { type: 'course_goal_reached' }
    expect(evaluateCourseCheck(check, context([reached]))).toBe(true)
    expect(evaluateCourseCheck(check, context([reached, crashed]))).toBe(false)
    expect(evaluateCourseCheck(check, context([reached, notRun]))).toBe(false)
    expect(evaluateCourseCheck(check, {})).toBe(false)
    expect(evaluateSingleCheck(check, '', context([reached]))).toBe(true)
  })

  it('course_no_crash: no map crashed, and every map ran', () => {
    const check = { type: 'course_no_crash' }
    expect(evaluateCourseCheck(check, context([reached, reached]))).toBe(true)
    expect(evaluateCourseCheck(check, context([reached, crashed]))).toBe(false)
    expect(evaluateCourseCheck(check, context([notRun]))).toBe(false)
  })

  it('course_pickups: all by default, or at least min', () => {
    expect(evaluateCourseCheck({ type: 'course_pickups' }, context([reached]))).toBe(true)
    expect(evaluateCourseCheck({ type: 'course_pickups' }, context([crashed]))).toBe(false)
    expect(evaluateCourseCheck({ type: 'course_pickups', min: 1 }, context([crashed]))).toBe(true)
    expect(evaluateCourseCheck({ type: 'course_pickups', min: '2' }, context([crashed]))).toBe(
      false
    )
    // A min above the map's pickups asks for them all.
    expect(evaluateCourseCheck({ type: 'course_pickups', min: 5 }, context([reached]))).toBe(true)
  })

  it('course_max_moves: at most max on every map', () => {
    expect(evaluateCourseCheck({ type: 'course_max_moves', max: 6 }, context([reached]))).toBe(true)
    expect(evaluateCourseCheck({ type: 'course_max_moves', max: '5' }, context([reached]))).toBe(
      false
    )
    expect(evaluateCourseCheck({ type: 'course_max_moves' }, context([reached]))).toBe(false)
  })
})

describe('course validation (Builder and CLI)', () => {
  const MAZE = '#####\n#>.G#\n#####'
  const lesson = (task) => ({
    id: 'course-lesson',
    type: 'composed',
    title: 'Course',
    description: 'Drive',
    tasks: [
      {
        id: 1,
        moduleType: 'turtle',
        title: 'Drive',
        starterCode: 'import turtle',
        codeStages: [{ label: 'Starter', role: 'starter', code: 'import turtle' }],
        ...task,
      },
    ],
  })
  const errorsOf = (task) => [
    validateLesson(lesson(task)).errors,
    validateLessonForMcp(lesson(task)).errors,
  ]

  it('accepts a course with course checks', () => {
    const task = {
      course: { type: 'grid', vehicle: 'rover', map: MAZE },
      check: [
        { type: 'course_goal_reached' },
        { type: 'course_no_crash' },
        { type: 'course_pickups', min: '0' },
        { type: 'course_max_moves', max: '4' },
      ],
    }
    for (const errors of errorsOf(task)) expect(errors).toEqual([])
  })

  it.each([
    [{ course: { type: 'grid', map: '#>..#' } }, 'Task 1 course map: the grid map has no goal'],
    [{ course: { type: 'race' } }, 'Task 1 course.type must be grid or track'],
    [{ check: { type: 'course_goal_reached' } }, 'has a course_goal_reached check but no course'],
    [
      { course: { type: 'grid', map: MAZE }, check: { type: 'course_max_moves' } },
      'has a course_max_moves check with no max',
    ],
    [
      { course: { type: 'grid', map: MAZE }, check: { type: 'course_pickups', min: 'all' } },
      "whose min isn't a whole number",
    ],
  ])('rejects %o', (task, message) => {
    for (const errors of errorsOf(task)) {
      expect(errors.some((error) => error.includes(message))).toBe(true)
    }
  })
})
