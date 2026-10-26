import { describe, expect, it } from 'vitest'
import {
  accrue,
  buildRunPayload,
  displayTimes,
  formatClock,
  restoreRun,
  setHidden,
  setUserPaused,
  startRun,
  switchTask,
} from '../timingRun'

const taskList = [
  { taskId: 'a', title: 'A', type: 'python', estimatedMinutes: 5 },
  { taskId: 'b', title: 'B', type: 'activity:beats', estimatedMinutes: null },
  { taskId: 'c', title: 'C', type: 'quiz', estimatedMinutes: 2 },
]
const meta = { lessonId: 'L1', lessonTitle: 'Lesson', taskList, tutorUid: 'u1', appVersion: 'v1' }

describe('timing run state', () => {
  it('times the task on screen and switches', () => {
    let s = startRun(0, { taskId: 'a' })
    s = switchTask(s, 'b', 10000)
    s = accrue(s, 25000)
    expect(s.tasks.a.ms).toBe(10000)
    expect(s.tasks.b.ms).toBe(15000)
  })

  it('adds revisits to the same task and counts visits', () => {
    let s = startRun(0, { taskId: 'a' })
    s = switchTask(s, 'b', 5000)
    s = switchTask(s, 'a', 8000)
    s = accrue(s, 10000)
    expect(s.tasks.a).toEqual({ ms: 7000, visits: 2 })
  })

  it('pauses while the tab is hidden and counts it as paused time', () => {
    let s = startRun(0, { taskId: 'a' })
    s = setHidden(s, true, 4000)
    s = setHidden(s, false, 14000)
    s = accrue(s, 16000)
    expect(s.tasks.a.ms).toBe(6000)
    expect(s.pausedMs).toBe(10000)
  })

  it('user pause stops the clock', () => {
    let s = startRun(0, { taskId: 'a' })
    s = setUserPaused(s, true, 3000)
    s = setUserPaused(s, false, 9000)
    expect(accrue(s, 10000).tasks.a.ms).toBe(4000)
  })

  it('shows live times without changing state', () => {
    const s = startRun(0, { taskId: 'a' })
    expect(displayTimes(s, 7500)).toEqual({ currentSeconds: 7, totalSeconds: 7 })
    expect(s.tasks.a.ms).toBe(0)
  })

  it('restores a saved run as paused, counting the gap as paused time', () => {
    const saved = switchTask(startRun(0, { taskId: 'a' }), 'a', 5000)
    const r = restoreRun(saved, 65000)
    expect(r.userPaused).toBe(true)
    expect(r.pausedMs).toBe(60000)
    expect(restoreRun({}, 0)).toBeNull()
  })

  it('builds the payload in lesson order with unopened tasks at 0', () => {
    let s = startRun(1000, { taskId: 'b' })
    s = switchTask(s, 'a', 31000)
    const p = buildRunPayload(s, 41000, { ...meta, tutorEmail: 't@x.uk' })
    expect(p).toMatchObject({
      lessonId: 'L1',
      startedAt: 1000,
      finishedAt: 41000,
      totalSeconds: 40,
      pausedSeconds: 0,
      tutorUid: 'u1',
      tutorEmail: 't@x.uk',
      appVersion: 'v1',
    })
    expect(p.tasks.map((t) => [t.taskId, t.seconds, t.visits])).toEqual([
      ['a', 10, 1],
      ['b', 30, 1],
      ['c', 0, 0],
    ])
    expect(p.tasks[0].estimatedMinutes).toBe(5)
    expect(p.tasks[1].estimatedMinutes).toBeNull()
  })

  it('omits tutorEmail when absent and formats clocks', () => {
    const p = buildRunPayload(startRun(0), 1000, meta)
    expect('tutorEmail' in p).toBe(false)
    expect(formatClock(125)).toBe('2:05')
  })
})
