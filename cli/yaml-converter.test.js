// @vitest-environment node
import { describe, expect, it } from 'vitest'
import yaml from 'js-yaml'
import { lessonToYamlText, parseYamlLesson } from './yaml-converter.mjs'
import {
  ALL_LEGACY_ACTIVITY_TASKS,
  CONFIDENCE_TASK,
  MATCH_TASK,
  MULTIPLE_CHOICE_TASK,
  PYTHON_CODE_ARRANGE_TASK,
  SHORT_ANSWER_TASK,
  legacyActivityLesson,
} from '../src/test/fixtures/legacyActivityTasks.js'

describe('lesson YAML conversion', () => {
  it('round-trips task priority while preserving omitted priority fields', () => {
    const source = `
id: priority-demo
type: python
title: Priority demo
description: A lesson with priorities
tasks:
  - title: Core by omission
    starterCode: print("core")
  - title: Optional task
    priority: optional
    starterCode: print("optional")
  - type: quiz
    title: Explicit core quiz
    priority: core
    options:
      - id: a
        text: A
      - id: b
        text: B
    answer: a
`
    const lesson = parseYamlLesson(source)
    expect(lesson.tasks.map((task) => task.priority)).toEqual([undefined, 'optional', 'core'])

    const roundTripped = yaml.load(lessonToYamlText(lesson))
    expect(roundTripped.tasks.map((task) => task.priority)).toEqual([undefined, 'optional', 'core'])
  })

  it('preserves draft, intent, task ids, and current audit metadata through YAML', () => {
    const source = `
id: yaml-draft
type: python
title: YAML draft
description: Draft lesson
draft: true
version: 4
tasks:
  - id: 42
    title: First real task
    intent: |
      Explain the goal in **Markdown**.
    intentLastChangedAt: 2026-07-25T10:00:00.000Z
    taskLastChangedAt: 2026-07-25T09:00:00.000Z
`
    const lesson = parseYamlLesson(source)
    expect(lesson).toMatchObject({
      draft: true,
      version: 4,
      tasks: [{ id: 42, intent: expect.stringContaining('**Markdown**') }],
    })
    const exported = yaml.load(lessonToYamlText(lesson))
    expect(exported.tasks[0].intentLastChangedAt).toBe('2026-07-25T10:00:00.000Z')
    expect(exported.tasks[0].taskLastChangedAt).toBe('2026-07-25T09:00:00.000Z')
  })
})

// Phase 0 characterisation (docs/architecture/modular-activities-plan.md step 0.3):
// how quiz and code_arrange tasks survive JSON -> YAML -> JSON today.
describe('characterisation: quiz + code_arrange YAML round-trip', () => {
  // multiple_choice is covered separately below: its check hint does not survive.
  it.each(Object.entries(ALL_LEGACY_ACTIVITY_TASKS).filter(([name]) => name !== 'multiple_choice'))(
    'round-trips the %s fixture unchanged',
    (_name, task) => {
      const lesson = legacyActivityLesson([task])
      const back = parseYamlLesson(lessonToYamlText(lesson))
      // Task ids are dropped on export and reassigned sequentially on import.
      expect(back).toEqual({ ...lesson, tasks: [{ ...task, id: 1 }] })
    }
  )

  it('exports quiz and code_arrange tasks with `type:` and the multiple-choice `answer:` shorthand', () => {
    const lesson = legacyActivityLesson([
      MULTIPLE_CHOICE_TASK,
      MATCH_TASK,
      SHORT_ANSWER_TASK,
      PYTHON_CODE_ARRANGE_TASK,
    ])
    const exported = yaml.load(lessonToYamlText(lesson))
    expect(exported.tasks.map((task) => [task.type, task.taskType, task.id])).toEqual([
      ['quiz', undefined, undefined],
      ['quiz', undefined, undefined],
      ['quiz', undefined, undefined],
      ['code_arrange', undefined, undefined],
    ])
    // answer_equals on multiple choice collapses to `answer:`, dropping the check's hint.
    expect(exported.tasks[0].answer).toBe('a')
    expect(exported.tasks[0]).not.toHaveProperty('check')
    // Any other quiz keeps its check object.
    expect(exported.tasks[2].check).toEqual(SHORT_ANSWER_TASK.check)
  })

  it('loses a multiple-choice check hint on round-trip (answer shorthand has no hint)', () => {
    const back = parseYamlLesson(lessonToYamlText(legacyActivityLesson([MULTIPLE_CHOICE_TASK])))
    expect(back.tasks[0].check).toEqual({ type: 'answer_equals', value: 'a' })
  })

  it('reassigns non-sequential task ids on round-trip', () => {
    const back = parseYamlLesson(
      lessonToYamlText(legacyActivityLesson([{ ...CONFIDENCE_TASK, id: 42 }]))
    )
    expect(back.tasks[0].id).toBe(1)
  })

  it('passes a literal `taskType: code_arrange` YAML key straight through', () => {
    const lesson = parseYamlLesson(`
id: literal-task-type
type: python
title: Literal taskType
description: d
tasks:
  - title: Arrange
    taskType: code_arrange
    lines: []
`)
    expect(lesson.tasks[0]).toEqual({
      id: 1,
      title: 'Arrange',
      taskType: 'code_arrange',
      lines: [],
    })
  })

  it('does not expand `answer:` into a check when the task already has one', () => {
    const lesson = parseYamlLesson(`
id: answer-and-check
type: python
title: Answer and check
description: d
tasks:
  - type: quiz
    title: Q
    answer: b
    check:
      type: answer_equals
      value: a
`)
    expect(lesson.tasks[0]).toEqual({
      id: 1,
      title: 'Q',
      taskType: 'quiz',
      check: { type: 'answer_equals', value: 'a' },
    })
  })
})
