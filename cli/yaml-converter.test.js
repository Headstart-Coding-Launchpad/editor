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
    expect(lesson).toMatchObject({ draft: true, version: 4, tasks: [{ id: 42, intent: expect.stringContaining('**Markdown**') }] })
    const exported = yaml.load(lessonToYamlText(lesson))
    expect(exported.tasks[0].intentLastChangedAt).toBe('2026-07-25T10:00:00.000Z')
    expect(exported.tasks[0].taskLastChangedAt).toBe('2026-07-25T09:00:00.000Z')
  })
})
