// @vitest-environment node
// Handoff #89 item 4 (Ryan, 2026-10-22): a task with no check saved nothing in the report. The
// code of each student's last Run (students/{id}/lastRuns) is kept as finalRun, flagged
// unchecked on a task without a check, and never counted as an attempt or a pass.
import { describe, expect, it } from 'vitest'
import yaml from 'js-yaml'
import { anonymizeSessionReport, buildSessionReport, reportToYamlText } from '../lessonReport'

const lesson = {
  id: 'L',
  title: 'Final runs',
  type: 'python',
  tasks: [
    {
      id: 1,
      title: 'Checked',
      taskType: 'code',
      check: [{ type: 'output', operator: 'contains', value: 'hi' }],
    },
    { id: 2, title: 'Make It Your Own', taskType: 'code' },
  ],
}

function session(students, attemptLog = {}) {
  return {
    state: 'active',
    startedAt: 1000,
    taskStartTimes: { 1: 1000, 2: 2000 },
    students,
    attemptLog,
  }
}

const passed = {
  a1: { submission: 'print("hi")', passed: true, attemptNumber: 1, retries: 0, loggedAt: 1500 },
}

describe('finalRun in the session report', () => {
  it('keeps the last Run of a task with no check, flagged unchecked, not as an attempt', () => {
    const report = buildSessionReport({
      lesson,
      session: session({
        s1: { displayName: 'Ava', lastRuns: { 2: { code: 'print("mine")', at: 2500 } } },
      }),
    })
    const task = report.students[0].tasks.find((t) => t.taskId === 2)
    expect(task.finalRun).toEqual({ code: 'print("mine")', unchecked: true, at: 2500 })
    expect(task.attempts).toBe(0)
    expect(task.completed).toBe(false)
  })

  it('keeps code run after the pass, and nothing when the last attempt already has it', () => {
    const after = buildSessionReport({
      lesson,
      session: session(
        { s1: { lastRuns: { 1: { code: 'print("hi there")', at: 1800 } } } },
        { s1: { 1: passed } }
      ),
    })
    expect(after.students[0].tasks.find((t) => t.taskId === 1).finalRun).toEqual({
      code: 'print("hi there")',
      at: 1800,
    })
    const same = buildSessionReport({
      lesson,
      session: session(
        { s1: { lastRuns: { 1: { code: 'print("hi")', at: 1500 } } } },
        { s1: { 1: passed } }
      ),
    })
    expect(same.students[0].tasks.find((t) => t.taskId === 1).finalRun).toBeUndefined()
  })

  it('reaches the anonymised YAML', () => {
    const report = buildSessionReport({
      lesson,
      session: session({
        s1: { displayName: 'Ava', lastRuns: { 2: { code: 'x = 1', at: 2500 } } },
      }),
    })
    const text = reportToYamlText(anonymizeSessionReport(report))
    expect(text).not.toMatch(/Ava/)
    const parsed = yaml.load(text)
    const tasks = parsed.students[0].tasks
    expect(tasks.find((t) => t.taskId === 2).finalRun.code).toBe('x = 1')
  })
})
