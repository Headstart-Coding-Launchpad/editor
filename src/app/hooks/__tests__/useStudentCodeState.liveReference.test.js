// The teacher's live code as a support reference (session.teacherLiveReference), in its two
// modes: a one-off "Reveal live code" that shows for the current task only (a supportRevealLog
// entry, like a stage reveal) and a pinned "Keep showing live code" that stays on across
// tasks and is logged once per pin rather than once per task.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ANON, makeSession, renderStudentCodeState } from '../../../test/studentCodeStateHarness'
import { pythonLesson } from '../../../test/fixtures/studentCodeStateLessons'

vi.mock('../../../modules/python/pyodide', async () =>
  (await import('../../../test/studentCodeStateMocks')).pyodideMock()
)
vi.mock('../../../shared/useTypeAssets', async () =>
  (await import('../../../test/studentCodeStateMocks')).typeAssetsMock()
)
vi.mock('../../../shared/useLessonStorageAssets', async () =>
  (await import('../../../test/studentCodeStateMocks')).lessonStorageAssetsMock()
)

afterEach(() => {
  vi.restoreAllMocks()
})

const liveOn = (taskId) => ({ active: true, taskId, code: 'print("live")' })

let pushedAt = 0
function remoteReset(h, action) {
  pushedAt += 1
  h.updateStudent({ remoteResetPushedAt: pushedAt, remoteResetAction: action })
}

function pinLogCalls(h) {
  return h.writers.recordSupportStageReveal.mock.calls.filter(
    ([, , key]) => key === 'teacherLivePinned'
  )
}

describe('teacher live reference — one-off reveal', () => {
  it('shows for the task it was revealed on (supportRevealLog entry)', () => {
    const h = renderStudentCodeState({
      lesson: pythonLesson(),
      currentTaskId: 't1',
      session: makeSession({
        teacherLiveReference: liveOn('t1'),
        supportRevealLog: { [ANON]: { t1: { teacherLive: { source: 'teacher' } } } },
      }),
    })
    expect(h.result.current.teacherLiveReferenceActive).toBe(true)
    expect(h.result.current.teacherLiveReferencePinned).toBe(false)
    // Not an authored stage: it never becomes the active support stage.
    expect(h.result.current.activeSupportStageIndex).toBe(null)
  })

  it('drops off when the task changes, even though Presentation follows to the new task', () => {
    const h = renderStudentCodeState({
      lesson: pythonLesson(),
      currentTaskId: 't1',
      session: makeSession({
        teacherLiveReference: liveOn('t1'),
        supportRevealLog: { [ANON]: { t1: { teacherLive: { source: 'teacher' } } } },
      }),
    })
    expect(h.result.current.teacherLiveReferenceActive).toBe(true)
    h.update((p) => ({
      currentTaskId: 't2',
      session: { ...p.session, currentTaskId: 't2', teacherLiveReference: liveOn('t2') },
    }))
    expect(h.result.current.teacherLiveReferenceActive).toBe(false)
  })

  it('"Reveal live code to all" (reveal_live) shows it at once and logs a teacher reveal', () => {
    const h = renderStudentCodeState({
      lesson: pythonLesson(),
      currentTaskId: 't1',
      session: makeSession({ teacherLiveReference: liveOn('t1') }),
    })
    expect(h.result.current.teacherLiveReferenceActive).toBe(false)
    remoteReset(h, 'reveal_live')
    expect(h.result.current.teacherLiveReferenceActive).toBe(true)
    expect(h.writers.recordSupportStageReveal).toHaveBeenCalledWith(ANON, 't1', 'teacherLive', {
      source: 'teacher',
      stageLabel: "Teacher's live code",
    })
    // The editor is untouched — it is a read-only reference.
    expect(h.result.current.code).toBe('print("start")')
  })

  it('reveal_live from the previous task does not carry to the next task', () => {
    const h = renderStudentCodeState({
      lesson: pythonLesson(),
      currentTaskId: 't1',
      session: makeSession({ teacherLiveReference: liveOn('t1') }),
    })
    remoteReset(h, 'reveal_live')
    expect(h.result.current.teacherLiveReferenceActive).toBe(true)
    h.update((p) => ({
      currentTaskId: 't2',
      session: { ...p.session, currentTaskId: 't2', teacherLiveReference: liveOn('t2') },
    }))
    expect(h.result.current.teacherLiveReferenceActive).toBe(false)
  })

  it('reveal_live is ignored while Presentation is not broadcasting this task', () => {
    const h = renderStudentCodeState({
      lesson: pythonLesson(),
      currentTaskId: 't1',
      session: makeSession({ teacherLiveReference: liveOn('t2') }),
    })
    remoteReset(h, 'reveal_live')
    expect(h.writers.recordSupportStageReveal).not.toHaveBeenCalled()
    h.updateSession({ teacherLiveReference: liveOn('t1') })
    expect(h.result.current.teacherLiveReferenceActive).toBe(false)
  })
})

describe('teacher live reference — pinned (keep showing)', () => {
  it('stays on across task changes', () => {
    const h = renderStudentCodeState({
      lesson: pythonLesson(),
      currentTaskId: 't1',
      session: makeSession({
        student: { teacherLiveReferenceVisible: 1000 },
        teacherLiveReference: liveOn('t1'),
      }),
    })
    expect(h.result.current.teacherLiveReferenceActive).toBe(true)
    expect(h.result.current.teacherLiveReferencePinned).toBe(true)
    h.update((p) => ({
      currentTaskId: 't2',
      session: { ...p.session, currentTaskId: 't2', teacherLiveReference: liveOn('t2') },
    }))
    expect(h.result.current.teacherLiveReferenceActive).toBe(true)
    expect(h.result.current.teacherLiveReferencePinned).toBe(true)
  })

  it('the class pin also stays on across task changes', () => {
    const h = renderStudentCodeState({
      lesson: pythonLesson(),
      currentTaskId: 't1',
      session: makeSession({
        teacherLiveReferenceVisibleToAll: 2000,
        teacherLiveReference: liveOn('t1'),
      }),
    })
    h.update((p) => ({
      currentTaskId: 't2',
      session: { ...p.session, currentTaskId: 't2', teacherLiveReference: liveOn('t2') },
    }))
    expect(h.result.current.teacherLiveReferenceActive).toBe(true)
  })

  it('logs the pin once, on the first task it shows, not again on the next task', () => {
    const h = renderStudentCodeState({
      lesson: pythonLesson(),
      currentTaskId: 't1',
      session: makeSession({
        student: { teacherLiveReferenceVisible: 1000 },
        teacherLiveReference: liveOn('t1'),
      }),
    })
    expect(pinLogCalls(h)).toEqual([
      [
        ANON,
        't1',
        'teacherLivePinned',
        {
          source: 'teacher-auto',
          stageLabel: "Teacher's live code (kept on)",
          pinnedAt: 1000,
        },
      ],
    ])
    h.update((p) => ({
      currentTaskId: 't2',
      session: { ...p.session, currentTaskId: 't2', teacherLiveReference: liveOn('t2') },
    }))
    expect(pinLogCalls(h)).toHaveLength(1)
    // Pinned display never writes a one-off (per-task) reveal entry.
    expect(
      h.writers.recordSupportStageReveal.mock.calls.some(([, , key]) => key === 'teacherLive')
    ).toBe(false)
  })

  it('does not re-log a pin already in the log from an earlier task (e.g. after a reload)', () => {
    const h = renderStudentCodeState({
      lesson: pythonLesson(),
      currentTaskId: 't2',
      session: makeSession({
        student: { teacherLiveReferenceVisible: 1000 },
        teacherLiveReference: liveOn('t2'),
        supportRevealLog: { [ANON]: { t1: { teacherLivePinned: { pinnedAt: 1000 } } } },
      }),
    })
    expect(h.result.current.teacherLiveReferenceActive).toBe(true)
    expect(pinLogCalls(h)).toHaveLength(0)
  })

  it('logs again for a new pin (turned off and on again)', () => {
    const h = renderStudentCodeState({
      lesson: pythonLesson(),
      currentTaskId: 't2',
      session: makeSession({
        student: { teacherLiveReferenceVisible: 1000 },
        teacherLiveReference: liveOn('t2'),
        supportRevealLog: { [ANON]: { t1: { teacherLivePinned: { pinnedAt: 1000 } } } },
      }),
    })
    expect(pinLogCalls(h)).toHaveLength(0)
    h.updateStudent({ teacherLiveReferenceVisible: null })
    expect(h.result.current.teacherLiveReferenceActive).toBe(false)
    h.updateStudent({ teacherLiveReferenceVisible: 3000 })
    expect(pinLogCalls(h)).toHaveLength(1)
    expect(pinLogCalls(h)[0][1]).toBe('t2')
    expect(pinLogCalls(h)[0][3]).toMatchObject({ pinnedAt: 3000 })
  })

  it('does not log a pin while Presentation is on another task', () => {
    const h = renderStudentCodeState({
      lesson: pythonLesson(),
      currentTaskId: 't1',
      session: makeSession({
        student: { teacherLiveReferenceVisible: 1000 },
        teacherLiveReference: liveOn('t2'),
      }),
    })
    expect(h.result.current.teacherLiveReferenceActive).toBe(false)
    expect(pinLogCalls(h)).toHaveLength(0)
  })

  it('a pin log entry on its own does not show the reference once unpinned', () => {
    const h = renderStudentCodeState({
      lesson: pythonLesson(),
      currentTaskId: 't1',
      session: makeSession({
        teacherLiveReference: liveOn('t1'),
        supportRevealLog: { [ANON]: { t1: { teacherLivePinned: { pinnedAt: 1000 } } } },
      }),
    })
    expect(h.result.current.teacherLiveReferenceActive).toBe(false)
  })
})
