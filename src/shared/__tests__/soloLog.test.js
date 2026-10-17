// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  anonymizeSoloRows,
  applySoloAttempt,
  buildSideQuestRows,
  buildSoloExport,
  buildSoloRows,
  soloLogName,
  soloLogPath,
  summariseSoloEntry,
} from '../soloLog'

const tasks = [
  { id: 1, title: 'Intro', taskType: 'information' },
  { id: 2, title: 'Print', taskType: 'code' },
  { id: 3, title: 'Loop', taskType: 'code' },
]

describe('applySoloAttempt', () => {
  it('records a first-try pass', () => {
    expect(applySoloAttempt(null, true, 100)).toEqual({
      attempts: 1,
      passed: true,
      firstTry: true,
      firstAt: 100,
      passedAt: 100,
    })
  })

  it('counts retries, and a later pass is not a first try', () => {
    const failed = applySoloAttempt(null, false, 100)
    expect(failed).toEqual({ attempts: 1, passed: false, firstTry: false, firstAt: 100 })
    expect(applySoloAttempt(failed, true, 250)).toEqual({
      attempts: 2,
      passed: true,
      firstTry: false,
      firstAt: 100,
      passedAt: 250,
    })
  })

  it('leaves a passed task alone', () => {
    const passed = applySoloAttempt(null, true, 100)
    expect(applySoloAttempt(passed, false, 900)).toBe(passed)
  })
})

describe('soloLogName', () => {
  it('drops the Solo placeholder and blanks, and caps the length', () => {
    expect(soloLogName('Solo')).toBeNull()
    expect(soloLogName('  ')).toBeNull()
    expect(soloLogName(null)).toBeNull()
    expect(soloLogName(' Ava ')).toBe('Ava')
    expect(soloLogName('x'.repeat(50))).toHaveLength(30)
  })
})

describe('summariseSoloEntry', () => {
  const entry = {
    startedAt: 10,
    lastAt: 50,
    finishedAt: 60,
    tasks: {
      2: { attempts: 1, passed: true, firstTry: true, firstAt: 20, passedAt: 20 },
      3: { attempts: 3, passed: false, firstTry: false, firstAt: 30 },
    },
  }

  it('lists the lesson tasks (not information) with first-attempt passes', () => {
    const summary = summariseSoloEntry(entry, tasks)
    expect(summary).toMatchObject({
      startedAt: 10,
      finishedAt: 60,
      taskCount: 2,
      tasksPassed: 1,
      firstAttemptPasses: 1,
    })
    expect(summary.tasks.map((t) => [t.taskId, t.attempts, t.passed, t.firstTry])).toEqual([
      [2, 1, true, true],
      [3, 3, false, false],
    ])
  })

  it('falls back to the logged tasks without a lesson, and handles an empty entry', () => {
    expect(summariseSoloEntry(entry).taskCount).toBe(2)
    expect(summariseSoloEntry({}, tasks)).toMatchObject({
      startedAt: null,
      finishedAt: null,
      tasksPassed: 0,
    })
  })
})

describe('solo rows and the anonymised export', () => {
  const lessonLog = {
    uidB: { startedAt: 200, lastAt: 300, name: 'Ben', tasks: {} },
    uidA: { startedAt: 100, lastAt: 400, name: 'Solo', tasks: {} },
  }

  it('sorts by latest activity and keeps the real name only', () => {
    const rows = buildSoloRows(lessonLog, tasks)
    expect(rows.map((r) => [r.anonymousId, r.name])).toEqual([
      ['uidA', null],
      ['uidB', 'Ben'],
    ])
  })

  it('exports "Student N" in start order with no names or ids', () => {
    const doc = buildSoloExport({
      lessonId: 'l1',
      lessonTitle: 'Loops',
      lessonLog,
      lessonTasks: tasks,
    })
    expect(doc.students.map((s) => s.studentLabel)).toEqual(['Student 1', 'Student 2'])
    expect(doc.students[0].startedAt).toBe(100)
    const text = JSON.stringify(doc)
    expect(text).not.toContain('Ben')
    expect(text).not.toContain('uidA')
    expect(text).not.toContain('anonymousId')
    expect(anonymizeSoloRows([])).toEqual([])
  })
})

describe('buildSideQuestRows', () => {
  it('flattens the stored session reports, newest open first', () => {
    const reports = [
      {
        lessonId: 'l1',
        sessionId: '111',
        startedAt: 111,
        students: [
          {
            studentLabel: 'Student 1',
            tasks: [
              {
                taskId: 2,
                title: 'Print',
                sideQuests: [
                  {
                    index: 0,
                    title: 'A',
                    kind: 'challenge',
                    openedAt: 5,
                    runs: 2,
                    errorRuns: 1,
                    done: true,
                    doneAt: 9,
                  },
                  {
                    index: 1,
                    title: 'B',
                    openedAt: 7,
                    runs: 0,
                    errorRuns: 0,
                    done: false,
                    doneAt: null,
                  },
                ],
              },
              { taskId: 3, title: 'Loop' },
            ],
          },
        ],
      },
    ]
    const rows = buildSideQuestRows(reports)
    expect(rows.map((r) => [r.studentLabel, r.index, r.done, r.openedAt])).toEqual([
      ['Student 1', 1, false, 7],
      ['Student 1', 0, true, 5],
    ])
    expect(rows[1]).toMatchObject({ lessonId: 'l1', sessionId: '111', taskTitle: 'Print', runs: 2 })
    expect(buildSideQuestRows(null)).toEqual([])
  })
})

describe('soloLogPath', () => {
  it('keys by lesson then student', () => {
    expect(soloLogPath('l1', 'u1')).toBe('soloLog/l1/u1')
  })
})
