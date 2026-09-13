import { describe, expect, it } from 'vitest'
import {
  parseJsonOrYaml,
  parseLessonJsonOrYaml,
  parseTopicJsonOrYaml,
  parseTopicLibraryJsonOrYaml,
} from './structured-input.mjs'

describe('structured CLI input', () => {
  it('parses lesson JSON from a file', () => {
    expect(parseLessonJsonOrYaml('lesson.json', '{"id":"lesson-1","tasks":[]}')).toEqual({
      id: 'lesson-1',
      tasks: [],
    })
  })

  it('silently retains legacy draft YAML during conversion', () => {
    const lesson = parseLessonJsonOrYaml(
      'lesson.yaml',
      `
id: lesson-1
type: python
title: Legacy lesson
tasks:
  - type: draft
    title: Plan the introduction
`
    )

    expect(lesson.tasks[0]).toMatchObject({
      id: 1,
      taskType: 'draft',
      title: 'Plan the introduction',
    })
  })

  it('auto-detects lesson YAML piped through stdin', () => {
    const lesson = parseLessonJsonOrYaml(
      null,
      `
id: lesson-1
type: python
title: Piped lesson
tasks: []
`
    )

    expect(lesson).toMatchObject({ id: 'lesson-1', title: 'Piped lesson', tasks: [] })
  })

  it('auto-detects generic YAML piped through stdin', () => {
    expect(parseJsonOrYaml(null, 'title: Piped task')).toEqual({ title: 'Piped task' })
  })

  it('parses a single topic from YAML', () => {
    expect(
      parseTopicJsonOrYaml(
        'topic.yaml',
        `
id: for-loop
title: For loop
types: [python]
`
      )
    ).toMatchObject({ id: 'for-loop', title: 'For loop', types: ['python'] })
  })

  it('rejects multiple topics for single-topic upsert', () => {
    expect(() =>
      parseTopicJsonOrYaml(
        'topics.yaml',
        `
topics:
  - id: one
    title: One
  - id: two
    title: Two
`
      )
    ).toThrow('Expected exactly one topic, received 2')
  })

  it('parses a topic library from YAML stdin', () => {
    expect(
      parseTopicLibraryJsonOrYaml(
        null,
        `
topics:
  - id: for-loop
    title: For loop
`
      )
    ).toEqual([{ id: 'for-loop', title: 'For loop' }])
  })
})
