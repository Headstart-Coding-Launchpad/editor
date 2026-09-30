import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { auditLessons, collectLessons } from '../audit-task-activity.mjs'

const dirs = []
afterEach(() => {
  while (dirs.length) rmSync(dirs.pop(), { recursive: true, force: true })
})

const LESSON_YAML = `id: audit-demo
type: python
title: Audit demo
tasks:
  - title: Fix it
    taskActivity: Code Task, Debug Code Task
    check: { type: output_contains, value: hi }
  - title: Explore
    taskActivity: Code Task, Speed Run
  - title: Plain
    taskActivity: Code Task
  - title: No tag
  - group: End Quiz
    tasks:
      - title: Q1
        type: quiz
        taskActivity: "Quiz: Fix a Common Bug"
        options: [{ id: a, text: A }, { id: b, text: B }]
        answer: a
      - title: Q2
        type: quiz
        options: [{ id: a, text: A }, { id: b, text: B }]
        answer: a
      - title: Q3
        type: quiz
        options: [{ id: a, text: A }, { id: b, text: B }]
        answer: a
`

describe('audit-task-activity', () => {
  it('counts patterns, checks, unknown values and quiz groups', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'audit-'))
    dirs.push(dir)
    writeFileSync(path.join(dir, 'Lesson.yaml'), LESSON_YAML)
    writeFileSync(path.join(dir, 'notes.json'), '{"not": "a lesson"}')
    mkdirSync(path.join(dir, 'Reports'))
    writeFileSync(path.join(dir, 'Reports', 'copy.yaml'), LESSON_YAML)

    const lessons = collectLessons([dir])
    expect(lessons.map(({ lesson }) => lesson.id)).toEqual(['audit-demo'])
    const report = auditLessons(lessons)
    expect(report).toMatchObject({ lessons: 1, tasks: 7, missing: 3, quizGroups: 1 })
    expect(report.rows.get('debug_code_task')).toEqual({ tasks: 1, withCheck: 1 })
    expect(report.rows.get('quiz_fix_a_common_bug')).toEqual({ tasks: 1, withCheck: 1 })
    expect(report.rows.get('(plain code_task)')).toEqual({ tasks: 1, withCheck: 0 })
    expect([...report.unknown.entries()]).toEqual([['Code Task, Speed Run', 1]])
  })
})
