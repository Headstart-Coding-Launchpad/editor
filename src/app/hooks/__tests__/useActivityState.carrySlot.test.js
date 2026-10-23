import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ANON,
  actAsync,
  fileKey,
  makeSession,
  readStored,
  renderStudentCodeState,
  writeStored,
} from '../../../test/studentCodeStateHarness'
import { defineActivity } from '../../../activities/defineActivity.js'

vi.mock('../../../modules/python/pyodide', async () =>
  (await import('../../../test/studentCodeStateMocks')).pyodideMock()
)
vi.mock('../../../shared/useTypeAssets', async () =>
  (await import('../../../test/studentCodeStateMocks')).typeAssetsMock()
)
vi.mock('../../../shared/useLessonStorageAssets', async () =>
  (await import('../../../test/studentCodeStateMocks')).lessonStorageAssetsMock()
)

// A fake activity with a carry slot (not the real station, which is still in flux).
const mocks = vi.hoisted(() => ({ readCarryInbox: vi.fn(), fake: { current: null } }))
vi.mock('../../../shared/roster/crossLessonCarryService', () => ({
  readCarryInbox: (...args) => mocks.readCarryInbox(...args),
}))
vi.mock('../../../activities/registry.pure.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getTaskActivity: (task) =>
      task?.activityType === 'carrydemo' ? mocks.fake.current : actual.getTaskActivity(task),
  }
})

const TASK = { id: 2, title: 'Build', taskType: 'activity', activityType: 'carrydemo', start: 1 }
const LESSON = {
  id: 'lesson-1',
  title: 'Carry',
  type: 'python',
  tasks: [{ id: 1, title: 'Code', starterCode: 'print(1)' }, TASK],
}
const STATE_FILE = '__activity_state__'
const initial = (task) => ({ v: 1, n: task.start })

mocks.fake.current = defineActivity({
  id: 'carrydemo',
  label: 'Carry demo',
  category: 'computing',
  defaultTask: () => ({}),
  validateTask: () => ({ errors: [], warnings: [] }),
  initialState: initial,
  grade: () => ({ passed: true }),
  carrySlot: {
    id: 'demo',
    extract: (state) => ({ v: 1, n: state.n }),
    apply: (task, carried) => ({ v: 1, n: carried.n + task.start }),
  },
})

const status = (value, extra = {}) => ({ [ANON]: { 2: { status: value, at: 1, ...extra } } })
const FOUND = { kind: 'activity_slot', slotId: 'demo', state: { v: 1, n: 40 } }

function render({ carryStatus, ...options } = {}) {
  return renderStudentCodeState({
    lesson: LESSON,
    currentTaskId: 2,
    session: makeSession({ carryStatus }),
    ...options,
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  mocks.readCarryInbox.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('activity carry slot: student side', () => {
  it('holds a live student with no state of their own until the tutor writes the status', () => {
    const { result } = render()
    expect(result.current.crossLessonCarry.state).toBe('hold')
    expect(result.current.crossLessonCarry.carry.kind).toBe('activity_slot')
    expect(result.current.activity.state).toEqual({ v: 1, n: 1 })
    expect(readStored(fileKey(2, STATE_FILE))).toBeNull()
  })

  it('applies the carried work on found and saves it as their own state', async () => {
    mocks.readCarryInbox.mockResolvedValue(FOUND)
    const { result, update } = render()
    expect(result.current.crossLessonCarry.state).toBe('hold')
    update((p) => ({ session: { ...p.session, carryStatus: status('found') } }))
    await actAsync(() => Promise.resolve())
    expect(mocks.readCarryInbox).toHaveBeenCalledWith('lesson-1', ANON, 2, 'activity_slot')
    expect(result.current.crossLessonCarry.state).toBe('found')
    expect(result.current.activity.state).toEqual({ v: 1, n: 41 })
    expect(readStored(fileKey(2, STATE_FILE))).toEqual({
      content: JSON.stringify({ v: 1, n: 41 }),
    })
  })

  it('does not wait again after a reload: the saved state is their own', () => {
    writeStored(fileKey(2, STATE_FILE), { content: JSON.stringify({ v: 1, n: 41 }) })
    const { result } = render()
    expect(result.current.crossLessonCarry.state).toBe('own')
    expect(result.current.activity.state).toEqual({ v: 1, n: 41 })
    expect(mocks.readCarryInbox).not.toHaveBeenCalled()
  })

  it.each(['none', 'starter'])('starts from the initial state on %s', async (value) => {
    const { result } = render({ carryStatus: status(value) })
    await actAsync(() => Promise.resolve())
    expect(result.current.crossLessonCarry.state).toBe(value)
    expect(result.current.activity.state).toEqual({ v: 1, n: 1 })
    expect(mocks.readCarryInbox).not.toHaveBeenCalled()
  })

  it('starts from the initial state when the inbox entry is unreadable', async () => {
    mocks.readCarryInbox.mockResolvedValue(null)
    const { result } = render({ carryStatus: status('found') })
    await actAsync(() => Promise.resolve())
    expect(result.current.crossLessonCarry.state).toBe('missing')
    expect(result.current.activity.state).toEqual({ v: 1, n: 1 })
  })

  it('never waits in solo, the Builder preview or the presentation window', () => {
    for (const options of [
      { phase: 'solo', session: null },
      { previewMode: true },
      { teacherPresentation: true },
    ]) {
      const { result, unmount } = render(options)
      expect(result.current.crossLessonCarry.state).toBe('solo')
      expect(result.current.activity.state).toEqual({ v: 1, n: 1 })
      unmount?.()
    }
    expect(mocks.readCarryInbox).not.toHaveBeenCalled()
  })

  it('never waits in a "No class" session', () => {
    const { result } = render({
      session: makeSession({ classChosenAt: 1, carryStatus: undefined }),
    })
    expect(result.current.crossLessonCarry.state).toBe('no_class')
    expect(result.current.activity.state).toEqual({ v: 1, n: 1 })
  })
})
