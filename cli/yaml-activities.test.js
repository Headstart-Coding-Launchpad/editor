// @vitest-environment node
import { describe, expect, it } from 'vitest'
import yaml from 'js-yaml'
import { lessonToYamlText, parseYamlLesson } from './yaml-converter.mjs'

// Plan step 2.4: the `type: <activity>` YAML shorthand for taskType 'activity' tasks.
describe('activity YAML shorthand', () => {
  const source = `
id: activity-shorthand
type: python
title: Activities
description: d
tasks:
  - title: Make the numbers
    type: binary
    mode: make_number
    bits: 4
    items:
      - id: a
        target: 5
  - title: Type it
    type: keyboard
    mode: type_text
    items:
      - id: a
        text: Hello World
  - title: Click it
    type: mouse
    targets:
      - id: star
        x: 0.5
        y: 0.5
    items:
      - id: a
        action: click
        target: star
  - title: Code
    type: python
    starterCode: print(1)
`

  it('parses `type: <activity>` into taskType activity + activityType', () => {
    const lesson = parseYamlLesson(source)
    expect(lesson.tasks.map((task) => [task.taskType, task.activityType])).toEqual([
      ['activity', 'binary'],
      ['activity', 'keyboard'],
      ['activity', 'mouse'],
      [undefined, undefined],
    ])
    expect(lesson.tasks[0]).toEqual({
      id: 1,
      title: 'Make the numbers',
      taskType: 'activity',
      activityType: 'binary',
      mode: 'make_number',
      bits: 4,
      items: [{ id: 'a', target: 5 }],
    })
  })

  it('exports activities with the shorthand, right after the title, and round-trips', () => {
    const lesson = parseYamlLesson(source)
    const text = lessonToYamlText(lesson)
    const exported = yaml.load(text)
    expect(exported.tasks.slice(0, 3).map((task) => Object.keys(task).slice(0, 2))).toEqual([
      ['title', 'type'],
      ['title', 'type'],
      ['title', 'type'],
    ])
    expect(exported.tasks.map((task) => task.type)).toEqual([
      'binary',
      'keyboard',
      'mouse',
      undefined,
    ])
    expect(text).not.toMatch(/taskType|activityType/)
    expect(parseYamlLesson(text)).toEqual(lesson)
  })

  it('still accepts the explicit taskType + activityType form', () => {
    const lesson = parseYamlLesson(`
id: explicit
type: python
title: Explicit
description: d
tasks:
  - title: Bits
    taskType: activity
    activityType: binary
    mode: make_number
    items:
      - id: a
        target: 1
`)
    expect(lesson.tasks[0]).toMatchObject({ taskType: 'activity', activityType: 'binary' })
    expect(yaml.load(lessonToYamlText(lesson)).tasks[0].type).toBe('binary')
  })

  it('keeps an unknown activityType explicit, and an unknown type is not an activity', () => {
    const lesson = {
      id: 'future',
      type: 'python',
      title: 'Future',
      tasks: [{ id: 1, title: 'Morse', taskType: 'activity', activityType: 'morse' }],
    }
    const exported = yaml.load(lessonToYamlText(lesson))
    expect(exported.tasks[0]).toEqual({
      title: 'Morse',
      taskType: 'activity',
      activityType: 'morse',
    })
    expect(parseYamlLesson(lessonToYamlText(lesson)).tasks[0]).toEqual(lesson.tasks[0])

    const typo = parseYamlLesson(`
id: typo
type: python
title: Typo
description: d
tasks:
  - title: T
    type: morse
`)
    expect(typo.tasks[0].taskType).toBeUndefined()
  })

  it('quizzes keep `type: quiz` (not an activity shorthand)', () => {
    const lesson = parseYamlLesson(`
id: quiz
type: python
title: Quiz
description: d
tasks:
  - type: quiz
    quizType: match
    title: Q
    pairs:
      - id: p1
        prompt: A
        answer: B
`)
    expect(lesson.tasks[0].taskType).toBe('quiz')
    expect(lesson.tasks[0].activityType).toBeUndefined()
    expect(yaml.load(lessonToYamlText(lesson)).tasks[0].type).toBe('quiz')
  })
})
