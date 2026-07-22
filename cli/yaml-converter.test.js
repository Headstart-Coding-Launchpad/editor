import { describe, expect, it } from 'vitest'
import yaml from 'js-yaml'
import { lessonToYamlText, parseYamlLesson } from './yaml-converter.mjs'

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
    expect(lesson.tasks.map(task => task.priority)).toEqual([undefined, 'optional', 'core'])

    const roundTripped = yaml.load(lessonToYamlText(lesson))
    expect(roundTripped.tasks.map(task => task.priority)).toEqual([undefined, 'optional', 'core'])
  })
})
