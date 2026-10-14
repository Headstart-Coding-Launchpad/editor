// The tutor's view of side-quests (src/shared/sideQuests.js "Tutor view"): the live record,
// "probably stuck", and the per-side-quest class counts.
import { describe, expect, it } from 'vitest'
import {
  readSideQuestCode,
  sideQuestStuckState,
  SIDE_QUEST_OUTPUT_MAX,
  SIDE_QUEST_STUCK_IDLE_MS,
  studentOpenSideQuest,
  summariseSideQuestClass,
  trimSideQuestOutput,
} from '../sideQuests.js'

const task = {
  id: 't2',
  sideQuests: [
    { title: 'Add a colour', kind: 'challenge' },
    { title: 'Fix the loop', kind: 'debug' },
  ],
}
const NOW = 1_000_000_000

const onQuest = (id, index, record = {}) => ({
  anonymousId: id,
  online: true,
  sideQuestOpen: index,
  sideQuestCode: { taskId: 't2', index, openedAt: NOW - 1000, updatedAt: NOW, ...record },
})

describe('readSideQuestCode', () => {
  it('reads the record for the open side-quest on this task', () => {
    const live = readSideQuestCode(onQuest('ali', 1, { code: 'print(1)', errorStreak: 2 }), 't2')
    expect(live).toMatchObject({ index: 1, code: 'print(1)', errorStreak: 2, output: '' })
  })

  it('ignores a record for another side-quest, another task, or none open', () => {
    expect(readSideQuestCode({ ...onQuest('ali', 1), sideQuestOpen: 0 }, 't2')).toBeNull()
    expect(readSideQuestCode(onQuest('ali', 1), 't3')).toBeNull()
    expect(readSideQuestCode({ ...onQuest('ali', 1), sideQuestOpen: null }, 't2')).toBeNull()
    expect(readSideQuestCode({ anonymousId: 'ali', sideQuestOpen: 0 }, 't2')).toBeNull()
  })
})

describe('studentOpenSideQuest', () => {
  it('names the open side-quest, with its live record when it has arrived', () => {
    const info = studentOpenSideQuest({
      student: onQuest('ali', 1, { code: 'x' }),
      moduleType: 'python',
      task,
    })
    expect(info.quest.title).toBe('Fix the loop')
    expect(info.total).toBe(2)
    expect(info.live.code).toBe('x')
    expect(
      studentOpenSideQuest({
        student: { anonymousId: 'ali', sideQuestOpen: 0 },
        moduleType: 'python',
        task,
      }).live
    ).toBeNull()
  })

  it('is null off a side-quest or on a module without side-quests', () => {
    expect(
      studentOpenSideQuest({ student: { sideQuestOpen: null }, moduleType: 'python', task })
    ).toBeNull()
    expect(
      studentOpenSideQuest({ student: onQuest('ali', 0), moduleType: 'scratch', task })
    ).toBeNull()
  })
})

describe('sideQuestStuckState', () => {
  const session = {}
  it('is stuck after two error runs in a row', () => {
    expect(
      sideQuestStuckState({
        student: onQuest('ali', 0, { errorStreak: 2, lastRunAt: NOW }),
        session,
        taskId: 't2',
        now: NOW,
      })
    ).toEqual({ stuck: true, reason: 'errors' })
  })

  it('is stuck after five minutes without a Run (since the last Run, or since opening)', () => {
    const idle = NOW - SIDE_QUEST_STUCK_IDLE_MS
    expect(
      sideQuestStuckState({
        student: onQuest('ali', 0, { lastRunAt: idle }),
        session,
        taskId: 't2',
        now: NOW,
      })
    ).toEqual({ stuck: true, reason: 'idle' })
    expect(
      sideQuestStuckState({
        student: onQuest('ali', 0, { openedAt: idle }),
        session,
        taskId: 't2',
        now: NOW,
      }).reason
    ).toBe('idle')
    expect(
      sideQuestStuckState({
        student: onQuest('ali', 0, { openedAt: idle, lastRunAt: NOW - 1000 }),
        session,
        taskId: 't2',
        now: NOW,
      }).stuck
    ).toBe(false)
  })

  it('is never stuck once marked done, or offline', () => {
    const student = onQuest('ali', 0, { errorStreak: 3 })
    expect(
      sideQuestStuckState({
        student,
        session: { sideQuestLog: { ali: { t2: { 0: { done: true } } } } },
        taskId: 't2',
        now: NOW,
      }).stuck
    ).toBe(false)
    expect(
      sideQuestStuckState({
        student: { ...student, online: false },
        session,
        taskId: 't2',
        now: NOW,
      }).stuck
    ).toBe(false)
  })
})

describe('summariseSideQuestClass', () => {
  it('counts who is on each side-quest now, done, and probably stuck', () => {
    const session = {
      students: {
        ali: onQuest('ali', 0, { lastRunAt: NOW }),
        bo: onQuest('bo', 0, { errorStreak: 2 }),
        cy: { ...onQuest('cy', 1), online: false },
        di: { anonymousId: 'di', online: true, sideQuestOpen: null },
      },
      sideQuestLog: {
        di: { t2: { 0: { done: true }, 1: { done: true } } },
        cy: { t2: { 1: { done: false } } },
      },
    }
    expect(summariseSideQuestClass({ session, task, now: NOW })).toEqual([
      { index: 0, onIt: ['ali', 'bo'], done: ['di'], stuck: ['bo'] },
      { index: 1, onIt: [], done: ['di'], stuck: [] },
    ])
  })
})

describe('trimSideQuestOutput', () => {
  it('keeps the newest output', () => {
    const long = 'a'.repeat(SIDE_QUEST_OUTPUT_MAX) + 'END'
    expect(trimSideQuestOutput(long)).toHaveLength(SIDE_QUEST_OUTPUT_MAX)
    expect(trimSideQuestOutput(long).endsWith('END')).toBe(true)
    expect(trimSideQuestOutput(null)).toBe('')
  })
})
