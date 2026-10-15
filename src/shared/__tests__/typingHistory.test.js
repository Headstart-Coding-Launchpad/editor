import { describe, expect, it } from 'vitest'
import keyboard from '../../activities/keyboard/definition.js'
import { validateKeyboardTask } from '../../activities/keyboard/keyboard.js'
import { buildSessionReport } from '../lessonReport.js'
import {
  collectTypingEntries,
  compareTypingScores,
  formatTypingHistoryChip,
  formatTypingHistoryLine,
  formatTypingTrend,
  lessonKeepsTypingHistory,
  makeTypingEntryId,
  sameTypingSummary,
  showsTypingHistory,
  summariseTypingHistory,
  typingAttemptHash,
  typingHistoryReportFields,
  typingResultsOf,
} from '../typingHistory.js'

const CODE_TASK = {
  id: 2,
  title: 'Timed challenge',
  taskType: 'activity',
  activityType: 'keyboard',
  mode: 'type_code',
  showHistory: true,
  items: [
    { id: 'a', code: 'print("Hi")' },
    { id: 'b', code: 'x = 1', showHistory: false },
  ],
}
const LESSON = {
  id: 'typing-1',
  type: 'python',
  tasks: [{ id: 1, title: 'Intro', taskType: 'information' }, CODE_TASK],
}

function result(overrides = {}) {
  return {
    mode: 'type_code',
    typed: 'print("Hi")',
    accuracy: 0.9,
    cpm: 60,
    wpm: 12,
    corrections: 1,
    timeMs: 11000,
    source: 'hardware',
    done: true,
    ...overrides,
  }
}

function stateWith(items) {
  return { v: 1, items }
}

function session(overrides = {}) {
  return {
    state: 'active',
    startedAt: 5000,
    currentTaskId: 2,
    students: {},
    attemptLog: {},
    ...overrides,
  }
}

describe('typing history hooks on the Keyboard activity', () => {
  it('reads finished, genuinely typed results only', () => {
    const state = stateWith({
      a: result(),
      b: result({ done: false }),
    })
    expect(typingResultsOf(CODE_TASK, state)).toEqual([
      expect.objectContaining({ itemId: 'a', mode: 'type_code', cpm: 60, accuracy: 0.9 }),
    ])
  })

  it('never treats shown answers (Complete) as history', () => {
    expect(typingResultsOf(CODE_TASK, keyboard.solutionState(CODE_TASK))).toEqual([])
  })

  it('keeps no history for non-typing modes', () => {
    const task = { ...CODE_TASK, mode: 'find_key', items: [{ id: 'a', key: 'Enter' }] }
    expect(typingResultsOf(task, stateWith({ a: { pressed: true } }))).toEqual([])
    expect(lessonKeepsTypingHistory({ tasks: [task] })).toBe(false)
    expect(lessonKeepsTypingHistory(LESSON)).toBe(true)
  })

  it('shows history per task, with a per-item override', () => {
    expect(showsTypingHistory(CODE_TASK, CODE_TASK.items[0])).toBe(true)
    expect(showsTypingHistory(CODE_TASK, CODE_TASK.items[1])).toBe(false)
    expect(showsTypingHistory({ ...CODE_TASK, showHistory: undefined }, { id: 'x' })).toBe(false)
  })

  it('validates showHistory', () => {
    expect(validateKeyboardTask({ ...CODE_TASK, showHistory: 'yes' }, 1).errors).toContain(
      'Task 1: showHistory must be true or false.'
    )
    const findKey = { ...CODE_TASK, mode: 'find_key', items: [{ id: 'a', key: 'Enter' }] }
    expect(validateKeyboardTask(findKey, 1).warnings[0]).toMatch(/showHistory only works/)
    expect(validateKeyboardTask(CODE_TASK, 1).errors).toEqual([])
  })
})

describe('dedupe keys', () => {
  it('keys an entry by stock lesson, task, item and attempt', () => {
    const hash = typingAttemptHash(result())
    expect(makeTypingEntryId({ sourceLessonId: 'l/1', sourceTaskId: 2, itemId: 'a', hash })).toBe(
      `l_1__2__a__${hash}`
    )
    expect(makeTypingEntryId({ sourceLessonId: 'l', sourceTaskId: 2, itemId: '', hash })).toBe(null)
  })

  it('gives the same attempt the same hash and a new attempt a new one', () => {
    expect(typingAttemptHash(result())).toBe(typingAttemptHash({ ...result() }))
    expect(typingAttemptHash(result({ timeMs: 11001 }))).not.toBe(typingAttemptHash(result()))
  })
})

describe('collectTypingEntries', () => {
  const submission = JSON.stringify(stateWith({ a: result() }))

  it('saves nothing for unmatched students or before the session starts', () => {
    const s = session({ attemptLog: { s1: { 2: { p1: { submission, loggedAt: 6000 } } } } })
    expect(
      collectTypingEntries({ session: s, lesson: LESSON, lessonId: 'l', matches: {} })
    ).toEqual([])
    expect(
      collectTypingEntries({
        session: { ...s, startedAt: undefined },
        lesson: LESSON,
        lessonId: 'l',
        matches: { s1: 'r1' },
      })
    ).toEqual([])
  })

  it('reads this session’s attempts (including those from before the match) once each', () => {
    const s = session({
      students: { s1: { currentAnswer: submission } },
      attemptLog: {
        s1: {
          2: {
            p1: { submission, loggedAt: 6000 },
            p2: { submission, loggedAt: 7000, retries: 1 },
          },
        },
      },
    })
    const entries = collectTypingEntries({
      session: s,
      lesson: LESSON,
      lessonId: 'typing-1',
      matches: { s1: 'r1' },
    })
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ anonymousId: 's1', rosterId: 'r1' })
    expect(entries[0].entry).toEqual({
      date: 6000,
      sessionId: '5000',
      lessonId: 'typing-1',
      sourceLessonId: 'typing-1',
      taskId: '2',
      sourceTaskId: '2',
      itemId: 'a',
      mode: 'type_code',
      cpm: 60,
      wpm: 12,
      accuracy: 0.9,
      corrections: 1,
      timeMs: 11000,
    })
  })

  it('reads the live answer on the current task, but not one the tutor edited', () => {
    const live = JSON.stringify(stateWith({ a: result({ cpm: 70, timeMs: 9000 }) }))
    const base = { students: { s1: { currentAnswer: live } } }
    const args = { lesson: LESSON, lessonId: 'typing-1', matches: { s1: 'r1' } }
    expect(collectTypingEntries({ ...args, session: session(base) })).toHaveLength(1)
    expect(
      collectTypingEntries({
        ...args,
        session: session({ students: { s1: { currentAnswer: live, teacherAssistedTaskId: 2 } } }),
      })
    ).toEqual([])
    expect(
      collectTypingEntries({ ...args, session: session({ ...base, currentTaskId: 1 }) })
    ).toEqual([])
  })

  it('keys a class fork’s entries by the stock lesson', () => {
    const fork = {
      ...LESSON,
      id: 'typing-1-maple',
      fork: { sourceLessonId: 'typing-1', classId: 'maple', taskLinks: [] },
    }
    const s = session({ students: { s1: { currentAnswer: submission } } })
    const [entry] = collectTypingEntries({
      session: s,
      lesson: fork,
      lessonId: 'typing-1-maple',
      matches: { s1: 'r1' },
    })
    expect(entry.id.startsWith('typing-1__2__a__')).toBe(true)
    expect(entry.entry.lessonId).toBe('typing-1-maple')
  })
})

describe('summariseTypingHistory', () => {
  const entries = [
    { mode: 'type_code', cpm: 40, accuracy: 0.8, date: 100, sessionId: 's1' },
    { mode: 'type_code', cpm: 50, accuracy: 0.9, date: 110, sessionId: 's1' },
    { mode: 'type_code', cpm: 80, accuracy: 0.85, date: 200, sessionId: 's2' },
    { mode: 'type_code', cpm: 80, accuracy: 0.95, date: 210, sessionId: 's2' },
    { mode: 'type_code', cpm: 62, accuracy: 0.91, date: 300, sessionId: 's3' },
    { mode: 'type_text', cpm: 100, accuracy: 1, date: 300, sessionId: 's3' },
    { mode: 'type_code', cpm: 200, accuracy: 1, date: 400, sessionId: 'now' },
  ]

  it('gives last, best and first per mode, leaving out the session in progress', () => {
    const summary = summariseTypingHistory(entries, { excludeSessionId: 'now' })
    expect(summary.byMode.type_code).toEqual({
      last: { cpm: 62, accuracy: 0.91, date: 300 },
      best: { cpm: 80, accuracy: 0.95, date: 210 },
      first: { cpm: 45, accuracy: 0.85, date: 110 },
      sessions: 3,
    })
    expect(summary.byMode.type_text.sessions).toBe(1)
  })

  it('is null with no history', () => {
    expect(summariseTypingHistory([], {})).toBe(null)
    expect(summariseTypingHistory(entries.slice(-1), { excludeSessionId: 'now' })).toBe(null)
  })

  it('ranks by characters a minute, then accuracy', () => {
    expect(compareTypingScores({ cpm: 80, accuracy: 0.9 }, { cpm: 70, accuracy: 1 })).toBeLessThan(
      0
    )
    expect(
      compareTypingScores({ cpm: 80, accuracy: 0.8 }, { cpm: 80, accuracy: 0.9 })
    ).toBeGreaterThan(0)
  })

  it('compares a pushed node with a summary regardless of key order and updatedAt', () => {
    const summary = summariseTypingHistory(entries, { excludeSessionId: 'now' })
    const node = JSON.parse(JSON.stringify({ updatedAt: 1, ...summary }))
    expect(sameTypingSummary(node, summary)).toBe(true)
    expect(sameTypingSummary(null, null)).toBe(true)
    expect(sameTypingSummary(node, null)).toBe(false)
  })
})

describe('words', () => {
  const history = {
    last: { cpm: 62, accuracy: 0.91, date: 3 },
    best: { cpm: 75, accuracy: 0.9, date: 2 },
    first: { cpm: 40, accuracy: 0.8, date: 1 },
    sessions: 3,
  }

  it('describes the last and best score', () => {
    expect(formatTypingHistoryLine(history)).toBe('Last time: 62 cpm, 91% · Best: 75 cpm')
    expect(formatTypingHistoryLine(null)).toBe('')
    expect(formatTypingHistoryChip(history)).toBe('Last 62 · Best 75 cpm · first 40')
  })

  it('celebrates progress and stays quiet otherwise', () => {
    expect(formatTypingTrend(history, 70)).toBe('You went from 40 to 70 characters a minute.')
    expect(formatTypingTrend(history, 80)).toBe(
      'New best! You went from 40 to 80 characters a minute.'
    )
    expect(formatTypingTrend(history, 30)).toBe('')
    expect(formatTypingTrend(null, 80)).toBe('')
  })
})

describe('session report', () => {
  const history = {
    byMode: {
      type_code: {
        last: { cpm: 62, accuracy: 0.91, date: 3 },
        best: { cpm: 75, accuracy: 0.9, date: 2 },
        first: { cpm: 40, accuracy: 0.8, date: 1 },
        sessions: 3,
      },
    },
  }

  it('puts this session’s score beside the previous one', () => {
    const s = session({ typingHistory: { s1: history } })
    const state = stateWith({ a: result({ cpm: 70, accuracy: 0.95 }) })
    expect(typingHistoryReportFields(s, CODE_TASK, 's1', state)).toEqual({
      typingHistory: {
        mode: 'type_code',
        cpm: 70,
        accuracy: 0.95,
        previousCpm: 62,
        previousAccuracy: 0.91,
        bestCpm: 75,
        firstCpm: 40,
      },
    })
    expect(typingHistoryReportFields(s, CODE_TASK, 's2', state)).toEqual({})
    expect(typingHistoryReportFields(s, LESSON.tasks[0], 's1', state)).toEqual({})
  })

  it('is written into the anonymous report', () => {
    const submission = JSON.stringify(stateWith({ a: result({ cpm: 70, accuracy: 0.95 }) }))
    const report = buildSessionReport({
      lesson: LESSON,
      session: session({
        students: { s1: { displayName: 'Jamie', joinedAt: 1 } },
        typingHistory: { s1: history },
        attemptLog: {
          s1: { 2: { p1: { submission, loggedAt: 6000, attemptNumber: 1, passed: true } } },
        },
      }),
    })
    const task = report.students[0].tasks.find((t) => t.taskId === 2)
    expect(task.typingHistory).toMatchObject({ cpm: 70, previousCpm: 62, bestCpm: 75 })
    expect(JSON.stringify(task.typingHistory)).not.toContain('Jamie')
  })
})
