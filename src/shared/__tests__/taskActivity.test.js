// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  TASK_ACTIVITY_FORMATS,
  TASK_ACTIVITY_PATTERNS,
  getTaskActivityPatternId,
  parseTaskActivity,
} from '../taskActivity.js'

describe('parseTaskActivity', () => {
  it.each([
    ['Code Task, Debug Code Task', 'code_task', 'debug_code_task'],
    ['Code Task, Copy the Code', 'code_task', 'copy_the_code'],
    ['Code Task, Challenge (Open-Ended)', 'code_task', 'challenge_open_ended'],
    ['Code Task, Complete Example', 'code_task', 'complete_example'],
    ['Code Task, Take It Further', 'code_task', 'take_it_further'],
    ['Information: Take It Further', 'information', 'take_it_further'],
    ['Information: Coming Up Next', 'information', 'coming_up_next'],
    [
      'Arrange Task, Meaningful Fill in the Blanks',
      'arrange_task',
      'meaningful_fill_in_the_blanks',
    ],
    ['Quiz: What Is the Error?', 'quiz', 'quiz_what_is_the_error'],
    ['Quiz: Fix a Common Bug', 'quiz', 'quiz_fix_a_common_bug'],
    ['Quiz: What Do You Expect the Code to Do', 'quiz', 'quiz_what_do_you_expect'],
    ['Quiz: Confirm the Syntax', 'quiz', 'quiz_confirm_the_syntax'],
    ['Quiz: Confirm / Recall the Syntax', 'quiz', 'quiz_confirm_the_syntax'],
    ['Quiz: Which of These Is an Integer', 'quiz', 'quiz_which_of_these_is_a_type'],
    ['Quiz, Multiple Choice', 'quiz', 'quiz_multiple_choice'],
    ['Quiz, Confidence Rating', 'quiz', 'quiz_confidence_rating'],
    ['Quiz: Confidence Check', 'quiz', 'quiz_confidence_check'],
  ])('%s', (value, format, pattern) => {
    expect(parseTaskActivity(value)).toEqual({ format, pattern, known: true })
  })

  it('tolerates case, whitespace and , vs :', () => {
    const expected = { format: 'code_task', pattern: 'debug_code_task', known: true }
    expect(parseTaskActivity('  code task:   debug code task ')).toEqual(expected)
    expect(parseTaskActivity('CODE TASK , DEBUG CODE TASK')).toEqual(expected)
    expect(parseTaskActivity('Quiz, Fix a Common Bug')).toMatchObject({
      pattern: 'quiz_fix_a_common_bug',
      known: true,
    })
    expect(parseTaskActivity('quiz: what is the error')).toMatchObject({
      pattern: 'quiz_what_is_the_error',
    })
    expect(parseTaskActivity('Code Task, challenge open-ended')).toMatchObject({
      pattern: 'challenge_open_ended',
    })
  })

  it('reads the plain forms as a format with no pattern', () => {
    for (const value of ['Information', 'Code Task', 'Arrange Task', 'Quiz']) {
      expect(parseTaskActivity(value)).toMatchObject({ pattern: null, known: true })
    }
  })

  it('treats empty values as known and unset', () => {
    expect(parseTaskActivity('')).toEqual({ format: null, pattern: null, known: true })
    expect(parseTaskActivity(undefined)).toEqual({ format: null, pattern: null, known: true })
  })

  it('flags unrecognised patterns and formats', () => {
    expect(parseTaskActivity('Code Task, Speed Run')).toEqual({
      format: 'code_task',
      pattern: null,
      known: false,
    })
    // A pattern under the wrong format isn't recognised.
    expect(parseTaskActivity('Information, Debug Code Task')).toMatchObject({ known: false })
    expect(parseTaskActivity('End quiz 1 of 4')).toMatchObject({ format: null, known: false })
    // A bare, unambiguous pattern still resolves (but is flagged).
    expect(parseTaskActivity('Debug Code Task')).toEqual({
      format: null,
      pattern: 'debug_code_task',
      known: false,
    })
  })

  it('reads activities by label, id or YAML type, with an optional mode', () => {
    expect(parseTaskActivity('Activity, Binary: to_decimal')).toEqual({
      format: 'activity',
      pattern: null,
      known: true,
      activityId: 'binary',
      mode: 'to_decimal',
    })
    expect(parseTaskActivity('Activity, Keyboard: symbols')).toMatchObject({
      activityId: 'keyboard',
      mode: 'symbols',
      known: true,
    })
    expect(parseTaskActivity('Activity, Mouse')).toMatchObject({ activityId: 'mouse', mode: null })
    expect(parseTaskActivity('Activity, Juggling')).toMatchObject({ known: false })
  })

  it('reads a task', () => {
    expect(getTaskActivityPatternId({ taskActivity: 'Code Task, Copy the Code' })).toBe(
      'copy_the_code'
    )
    expect(getTaskActivityPatternId({})).toBeNull()
  })

  it('has unique, stable ids', () => {
    const ids = TASK_ACTIVITY_PATTERNS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    const formats = TASK_ACTIVITY_FORMATS.map((f) => f.id)
    for (const p of TASK_ACTIVITY_PATTERNS) {
      for (const format of p.formats) expect(formats).toContain(format)
    }
  })
})
