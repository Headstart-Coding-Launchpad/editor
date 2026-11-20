// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { anonymizeSessionReport, buildSessionReport } from '../lessonReport'

const lesson = {
  id: 'demo-lesson',
  title: 'Demo Lesson',
  tasks: [{ id: 1, title: 'Code Task', check: { type: 'output_contains', value: 'hello' } }],
}

const session = {
  lessonId: 'demo-lesson',
  startedAt: 1000,
  endedAt: 2000,
  taskStartTimes: { 1: 1000 },
  students: {
    alice: {
      displayName: 'Alice',
      healthBeacon: {
        appVersion: '1.0.985',
        pythonStatus: 'ready',
        pythonLoadMs: 3200,
        errorCount: 2,
        lastError: "Cannot read properties of undefined (reading 'secret')",
        lastErrorAt: 1500,
        connectionDrops: 1,
        lastDropAt: 1400,
        updatedAt: 1600,
      },
    },
    bob: { displayName: 'Bob' },
  },
}

describe('session report screen health (health beacon, R1)', () => {
  it("records the tutor's app version and each screen's beacon, never a quoted string", () => {
    const report = buildSessionReport({ session, lesson, appVersion: '1.0.985' })
    expect(report.appVersion).toBe('1.0.985')
    const [alice, bob] = report.students
    expect(alice.screenHealth).toEqual({
      appVersion: '1.0.985',
      pythonStatus: 'ready',
      pythonLoadMs: 3200,
      errorCount: 2,
      connectionDrops: 1,
      lastError: "Cannot read properties of undefined (reading '…')",
    })
    expect(bob).not.toHaveProperty('screenHealth')
  })

  it('leaves appVersion out when it is not given, and keeps screenHealth through anonymising', () => {
    const report = buildSessionReport({ session, lesson })
    expect(report).not.toHaveProperty('appVersion')
    const anon = anonymizeSessionReport(report)
    expect(anon.students[0].screenHealth.errorCount).toBe(2)
  })
})
