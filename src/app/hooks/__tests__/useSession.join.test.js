// Join history on the student node for the session report: firstJoinedAt / firstJoinTaskId are
// written once, later joins and reload-returns append to `rejoins` (docs/agents/runtime-model.md).
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_STUDENT_REJOINS, useSession } from '../useSession'

// A tiny in-memory store for transactions and get(), so write-once can be exercised for real.
const store = new Map()

const firebaseMocks = vi.hoisted(() => ({
  ref: vi.fn((_db, path) => ({ path })),
  onValue: vi.fn(),
  set: vi.fn(() => Promise.resolve()),
  update: vi.fn(() => Promise.resolve()),
  remove: vi.fn(() => Promise.resolve()),
  push: vi.fn(),
  onDisconnect: vi.fn(() => ({
    set: vi.fn(() => Promise.resolve()),
    remove: vi.fn(() => Promise.resolve()),
  })),
  get: vi.fn(),
  runTransaction: vi.fn(),
}))

vi.mock('firebase/database', () => ({
  ref: (...args) => firebaseMocks.ref(...args),
  onValue: (...args) => firebaseMocks.onValue(...args),
  set: (...args) => firebaseMocks.set(...args),
  update: (...args) => firebaseMocks.update(...args),
  remove: (...args) => firebaseMocks.remove(...args),
  push: (...args) => firebaseMocks.push(...args),
  serverTimestamp: vi.fn(() => ({ '.sv': 'timestamp' })),
  onDisconnect: (...args) => firebaseMocks.onDisconnect(...args),
  get: (...args) => firebaseMocks.get(...args),
  runTransaction: (...args) => firebaseMocks.runTransaction(...args),
}))

vi.mock('../../../shared/firebase', () => ({ db: {} }))

const LESSON = 'lesson-1'
const STUDENT = 'student-abc'
const STUDENT_PATH = `sessions/${LESSON}/students/${STUDENT}`
let sessionCallback = null

beforeEach(() => {
  vi.clearAllMocks()
  store.clear()
  sessionCallback = null
  firebaseMocks.ref.mockImplementation((_db, path) => ({ path }))
  firebaseMocks.set.mockResolvedValue(undefined)
  firebaseMocks.update.mockResolvedValue(undefined)
  firebaseMocks.get.mockImplementation(async (refObj) => ({
    val: () => store.get(refObj.path) ?? null,
  }))
  firebaseMocks.runTransaction.mockImplementation(async (refObj, apply) => {
    const next = apply(store.has(refObj.path) ? store.get(refObj.path) : null)
    if (next === undefined) {
      return { committed: false, snapshot: { val: () => store.get(refObj.path) ?? null } }
    }
    store.set(refObj.path, next)
    return { committed: true, snapshot: { val: () => next } }
  })
  firebaseMocks.onValue.mockImplementation((refObj, callback) => {
    if (!refObj.path.startsWith('.info/')) sessionCallback = callback
    return vi.fn()
  })
})

afterEach(() => {
  vi.useRealTimers()
})

function fireSession(data) {
  act(() => {
    sessionCallback?.({ exists: () => data !== null, val: () => data })
  })
}

function renderSession(data) {
  const hook = renderHook(() => useSession(LESSON))
  fireSession(data)
  return hook
}

const studentUpdates = () =>
  firebaseMocks.update.mock.calls.filter(([r]) => r.path === STUDENT_PATH).map(([, data]) => data)

describe('joinSession join history', () => {
  it('records the first join and the current task once', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(1000)
    const { result } = renderSession({ state: 'active', currentTaskId: 7 })
    await act(async () => {
      await result.current.joinSession(STUDENT, 'Jamie')
    })

    expect(store.get(`${STUDENT_PATH}/firstJoinedAt`)).toBe(1000)
    expect(studentUpdates()[0]).toMatchObject({ displayName: 'Jamie', joinedAt: 1000 })
    expect(studentUpdates()).toContainEqual({ firstJoinTaskId: 7 })
    expect(store.has(`${STUDENT_PATH}/rejoins`)).toBe(false)
  })

  it('keeps the first join on a repeat join and appends a rejoin instead', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(1000)
    const { result } = renderSession({ state: 'active', currentTaskId: 2 })
    await act(async () => {
      await result.current.joinSession(STUDENT, 'Jamie')
    })

    fireSession({ state: 'active', currentTaskId: 5 })
    vi.setSystemTime(4000)
    await act(async () => {
      await result.current.joinSession(STUDENT, 'Jamie B')
    })

    expect(store.get(`${STUDENT_PATH}/firstJoinedAt`)).toBe(1000)
    expect(store.get(`${STUDENT_PATH}/rejoins`)).toEqual([{ at: 4000, taskId: 5 }])
    expect(studentUpdates().filter((data) => 'firstJoinTaskId' in data)).toEqual([
      { firstJoinTaskId: 2 },
    ])
    // The node's own joinedAt still tracks the latest name entry.
    expect(studentUpdates()).toContainEqual(
      expect.objectContaining({ displayName: 'Jamie B', joinedAt: 4000 })
    )
  })

  it('caps rejoins at the most recent MAX_STUDENT_REJOINS entries', async () => {
    store.set(`${STUDENT_PATH}/firstJoinedAt`, 1)
    store.set(
      `${STUDENT_PATH}/rejoins`,
      Array.from({ length: MAX_STUDENT_REJOINS }, (_, i) => ({ at: i + 10, taskId: 1 }))
    )
    const { result } = renderSession({ state: 'active', currentTaskId: 3 })
    await act(async () => {
      await result.current.joinSession(STUDENT, 'Jamie')
    })

    const rejoins = store.get(`${STUDENT_PATH}/rejoins`)
    expect(rejoins).toHaveLength(MAX_STUDENT_REJOINS)
    expect(rejoins[0].at).toBe(11)
    expect(rejoins.at(-1).taskId).toBe(3)
  })

  it('still resolves when the join-history transaction fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    firebaseMocks.runTransaction.mockRejectedValue(new Error('offline'))
    const { result } = renderSession({ state: 'active', currentTaskId: 1 })
    await act(async () => {
      await expect(result.current.joinSession(STUDENT, 'Jamie')).resolves.toBeUndefined()
    })
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('recordStudentReturn', () => {
  it('appends a rejoin with the current task when a first join is on record', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(9000)
    store.set(`${STUDENT_PATH}/firstJoinedAt`, 1000)
    const { result } = renderSession({ state: 'active', currentTaskId: 4 })
    await act(async () => {
      await result.current.recordStudentReturn(STUDENT)
    })
    expect(store.get(`${STUDENT_PATH}/rejoins`)).toEqual([{ at: 9000, taskId: 4 }])
  })

  it('writes nothing without a first join (removed student or older session)', async () => {
    const { result } = renderSession({ state: 'active', currentTaskId: 4 })
    await act(async () => {
      await result.current.recordStudentReturn(STUDENT)
    })
    expect(firebaseMocks.runTransaction).not.toHaveBeenCalled()
    expect(firebaseMocks.update).not.toHaveBeenCalled()
  })
})
