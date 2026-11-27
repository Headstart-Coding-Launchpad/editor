import { describe, expect, it } from 'vitest'
import definition from '../definition.js'
import { linesLabel, parseLinePicks } from '../lines.js'
import { switchQuizType } from '../../quiz/quizBuilder.js'
import { getTaskActivity } from '../../registry.pure.js'
import { validateLessonCore } from '../../../shared/lessonValidation.js'
import { lessonToYamlText, parseYamlLesson } from '../../../../cli/yaml-converter.mjs'
import { buildCapabilities } from '../../../../cli/capabilities.mjs'

const TASK = {
  id: 't1',
  title: 'Which line is wrong?',
  taskType: 'quiz',
  quizType: 'code_lines',
  explainer: 'Which line is wrong?',
  code: 'a = 1\nprint(a +)\nprint("ok")',
  correctLines: [2],
}
const validate = (task) => definition.validateTask(task, { n: 1 })

describe('code_lines definition', () => {
  it('resolves taskType quiz + quizType code_lines to this activity', () => {
    expect(getTaskActivity(TASK)?.id).toBe('quiz_code_lines')
    expect(definition.legacy).toEqual({ taskType: 'quiz', quizType: 'code_lines' })
  })

  it('grades one line, and two lines in any order, against correctLines', () => {
    expect(definition.grade(TASK, '2').passed).toBe(true)
    expect(definition.grade(TASK, '3').passed).toBe(false)
    expect(definition.grade(TASK, '').passed).toBe(false)
    const two = { ...TASK, correctLines: [1, 3] }
    expect(definition.grade(two, '[3,1]').passed).toBe(true)
    expect(definition.grade(two, '[1,2]').passed).toBe(false)
    expect(definition.grade(two, '[1]').passed).toBe(false)
  })

  it("gives a wrong pick's lineFeedback, else feedback, else the explanation", () => {
    const task = { ...TASK, lineFeedback: { 3: 'Line 3 is fine.' }, explanation: 'Why 2.' }
    expect(definition.grade(task, '3').suggestion).toBe('Line 3 is fine.')
    expect(definition.grade(task, '1').suggestion).toBe('Why 2.')
    expect(definition.grade({ ...task, feedback: 'Look again.' }, '1').suggestion).toBe(
      'Look again.'
    )
    expect(definition.grade(task, '2').suggestion).toBe('')
  })

  it('keeps only real line numbers when reading a stored answer', () => {
    expect(definition.deserialize('2', TASK)).toBe('2')
    expect(definition.deserialize('9', TASK)).toBe('')
    expect(definition.deserialize('[1,9]', { ...TASK, correctLines: [1, 2] })).toBe('1')
    expect(definition.deserialize('[3,1]', { ...TASK, correctLines: [1, 3] })).toBe('[3,1]')
    expect(definition.deserialize('{oops', TASK)).toBe('')
  })

  it('names no pick plainly, drops repeats and lines the code no longer has', () => {
    expect(linesLabel([])).toBe('')
    expect(definition.summarize(TASK, '').text).toBe('No line picked')
    expect(definition.summarize(TASK, '[7,8]').text).toBe('No line picked')
    expect(definition.summarize(TASK, '[1,9]').text).toBe('Line 1')
    expect(parseLinePicks('[2,2,3]')).toEqual([2, 3])
    expect(definition.deserialize('[2,2]', TASK)).toBe('2')
  })

  it('never reads lineFeedback for a missing wrong pick', () => {
    const task = { ...TASK, correctLines: [1, 2], lineFeedback: { undefined: 'oops' } }
    expect(definition.grade(task, '1').suggestion).toBe('')
    expect(definition.grade({ ...task, feedback: 'Pick two.' }, '1').suggestion).toBe('Pick two.')
  })

  it('switching another quiz to it (Builder) gives a valid task, keeping its own code', () => {
    const mc = { id: 't9', title: 'Q', taskType: 'quiz', options: [{ id: 'a', text: 'A' }] }
    const switched = switchQuizType(mc, 'code_lines')
    expect(switched).toMatchObject({ quizType: 'code_lines', options: undefined, check: null })
    expect(validate(switched).errors).toEqual([])
    expect(switchQuizType({ ...TASK, quizType: 'poll' }, 'code_lines').code).toBe(TASK.code)
  })

  it('summarises the pick for the tutor card and report', () => {
    expect(definition.summarize(TASK, '2').text).toBe('Line 2')
    expect(definition.summarize({ ...TASK, correctLines: [1, 3] }, '[1,3]').text).toBe(
      'Lines 1 and 3'
    )
  })

  it('seals the answer fields from the public lesson document', () => {
    expect(definition.sealedFields).toEqual(
      expect.arrayContaining(['correctLines', 'lineFeedback', 'explanation'])
    )
  })
})

describe('code_lines validation', () => {
  it('accepts a well-formed task', () => {
    expect(validate(TASK)).toEqual({ errors: [], warnings: [] })
  })

  it('needs code and at least one correct line', () => {
    expect(validate({ ...TASK, code: '  ' }).errors).toContain(
      'Task 1 is a code-lines quiz but has no code'
    )
    expect(validate({ ...TASK, correctLines: [] }).errors).toContain(
      'Task 1 is a code-lines quiz but has no correctLines (list the line numbers to pick, e.g. [3])'
    )
  })

  it('keeps correctLines inside the block, whole and different', () => {
    expect(validate({ ...TASK, correctLines: [4] }).errors).toContain(
      'Task 1 is a code-lines quiz but correctLines has 4, which is not a line of its code (it has 3 lines)'
    )
    expect(validate({ ...TASK, correctLines: [2, 2] }).errors).toContain(
      'Task 1 is a code-lines quiz but correctLines lists a line twice'
    )
  })

  it('checks pick matches the number of correct lines', () => {
    expect(validate({ ...TASK, pick: 2 }).errors).toContain(
      'Task 1 is a code-lines quiz but pick is 2 and correctLines has 1 line (leave pick out, or make them match)'
    )
    expect(validate({ ...TASK, pick: 1 }).errors).toEqual([])
  })

  it('warns about lineFeedback for a line that is not a wrong pick, and long blocks', () => {
    expect(validate({ ...TASK, lineFeedback: { 2: 'x', 7: 'y' } }).warnings).toEqual([
      'Task 1 is a code-lines quiz but lineFeedback has line 2, which is a correct line (it is never shown)',
      'Task 1 is a code-lines quiz but lineFeedback has line 7, which is not a line of its code',
    ])
    const long = Array.from({ length: 14 }, (_, i) => `print(${i})`).join('\n')
    expect(validate({ ...TASK, code: long }).warnings).toContain(
      'Task 1 is a code-lines quiz with 14 lines; keep it to 12 or fewer so it fits the screen'
    )
  })

  it('runs through the shared lesson validator', () => {
    const lesson = { id: 'l', title: 'L', type: 'python', tasks: [{ ...TASK, correctLines: [9] }] }
    expect(validateLessonCore(lesson).errors.join('\n')).toMatch(/correctLines has 9/)
  })
})

describe('code_lines in YAML and capabilities', () => {
  it('round-trips through the CLI YAML converter', () => {
    const lesson = { id: 'l', title: 'L', type: 'python', tasks: [{ ...TASK, pick: 1 }] }
    const back = parseYamlLesson(lessonToYamlText(lesson))
    expect(back.tasks[0]).toMatchObject({
      taskType: 'quiz',
      quizType: 'code_lines',
      code: TASK.code,
      correctLines: [2],
    })
  })

  it('is listed by `lessons capabilities` with its fields', () => {
    const activity = buildCapabilities({ requests: [] }).activities.find(
      (entry) => entry.id === 'quiz_code_lines'
    )
    expect(activity).toBeTruthy()
    expect(JSON.stringify(activity)).toMatch(/correctLines/)
  })
})
