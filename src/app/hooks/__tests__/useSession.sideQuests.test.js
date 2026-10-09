// Side-quest status in useSession (src/shared/sideQuests.js): the open side-quest on the student
// node, and the per-side-quest log (opened, runs, error runs, done). Never any code.
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSession } from '../useSession'

const SERVER_TIME = { '.sv': 'timestamp' }
const store = new Map()

const firebaseMocks = vi.hoisted(() => ({
  ref: vi.fn((_db, path) => ({ path })),
  onValue: vi.fn(),
  set: vi.fn(() => Promise.resolve()),
  update: vi.fn(() => Promise.resolve()),
  remove: vi.fn(() => Promise.resolve()),
  push: vi.fn((parentRef) => ({ path: `${parentRef.path}/mockPushId`, key: 'mockPushId' })),
  onDisconnect: vi.fn(() => ({
    set: vi.fn(() => Promise.resolve()),
    remove: vi.fn(() => Promise.resolve()),
  })),
  get: vi.fn(() => Promise.resolve({ val: () => null })),
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
const LOG = `sessions/${LESSON}/sideQuestLog/${STUDENT}/t2/1`
let sessionCallback = null

beforeEach(() => {
  vi.clearAllMocks()
  store.clear()
  sessionCallback = null
  firebaseMocks.ref.mockImplementation((_db, path) => ({ path }))
  firebaseMocks.set.mockResolvedValue(undefined)
  firebaseMocks.update.mockResolvedValue(undefined)
  firebaseMocks.remove.mockResolvedValue(undefined)
  firebaseMocks.runTransaction.mockImplementation(async (refObj, apply) => {
    const next = apply(store.has(refObj.path) ? store.get(refObj.path) : null)
    store.set(refObj.path, next)
    return { committed: true, snapshot: { val: () => next } }
  })
  firebaseMocks.onValue.mockImplementation((refObj, callback) => {
    if (!refObj.path.startsWith('.info/')) sessionCallback = callback
    return vi.fn()
  })
})

function renderSession(data) {
  const hook = renderHook(() => useSession(LESSON))
  act(() => {
    sessionCallback?.({ exists: () => data !== null, val: () => data })
  })
  return hook
}

const setCallsTo = (path) => firebaseMocks.set.mock.calls.filter(([r]) => r.path === path)
const updateCallsTo = (path) => firebaseMocks.update.mock.calls.filter(([r]) => r.path === path)

describe('side-quest status', () => {
  it('writes the open side-quest index on the student node, and null on close', async () => {
    const { result } = renderSession({ state: 'active' })
    await act(async () => {
      await result.current.writeSideQuestOpen(STUDENT, 1)
      await result.current.writeSideQuestOpen(STUDENT, null)
    })
    const calls = setCallsTo(`sessions/${LESSON}/students/${STUDENT}/sideQuestOpen`)
    expect(calls.map(([, value]) => value)).toEqual([1, null])
  })

  it('stamps openedAt only the first time', async () => {
    const { result } = renderSession({ state: 'active' })
    await act(async () => {
      await result.current.recordSideQuestOpened(STUDENT, 't2', 1)
    })
    expect(updateCallsTo(LOG)).toEqual([[{ path: LOG }, { openedAt: SERVER_TIME }]])

    vi.clearAllMocks()
    const opened = renderSession({
      state: 'active',
      sideQuestLog: { [STUDENT]: { t2: { 1: { openedAt: 5 } } } },
    })
    await act(async () => {
      await opened.result.current.recordSideQuestOpened(STUDENT, 't2', 1)
    })
    expect(updateCallsTo(LOG)).toEqual([])
  })

  it('counts runs and error runs with transactions', async () => {
    const { result } = renderSession({ state: 'active' })
    await act(async () => {
      await result.current.recordSideQuestRun(STUDENT, 't2', 1)
      await result.current.recordSideQuestRun(STUDENT, 't2', 1)
      await result.current.recordSideQuestRun(STUDENT, 't2', 1, { error: true })
    })
    expect(store.get(`${LOG}/runs`)).toBe(2)
    expect(store.get(`${LOG}/errorRuns`)).toBe(1)
  })

  it('records Done with a time, and clears the time when undone', async () => {
    const { result } = renderSession({ state: 'active' })
    await act(async () => {
      await result.current.setSideQuestDone(STUDENT, 't2', 1, true)
      await result.current.setSideQuestDone(STUDENT, 't2', 1, false)
    })
    expect(updateCallsTo(LOG).map(([, value]) => value)).toEqual([
      { done: true, doneAt: SERVER_TIME },
      { done: false, doneAt: null },
    ])
  })

  it('ignores a write without a student, task or index', async () => {
    const { result } = renderSession({ state: 'active' })
    await act(async () => {
      await result.current.recordSideQuestOpened(null, 't2', 1)
      await result.current.recordSideQuestRun(STUDENT, null, 1)
      await result.current.setSideQuestDone(STUDENT, 't2', 'x', true)
    })
    expect(firebaseMocks.update).not.toHaveBeenCalled()
    expect(firebaseMocks.runTransaction).not.toHaveBeenCalled()
  })

  it('setTaskId closes every open side-quest; createSession clears the log', async () => {
    const { result } = renderSession({
      state: 'active',
      currentTaskId: 't2',
      students: { [STUDENT]: { anonymousId: STUDENT, sideQuestOpen: 0 } },
    })
    await act(async () => {
      await result.current.setTaskId('t3')
    })
    expect(updateCallsTo(`sessions/${LESSON}`)[0][1]).toMatchObject({
      [`students/${STUDENT}/sideQuestOpen`]: null,
    })
    await act(async () => {
      await result.current.createSession()
    })
    expect(setCallsTo(`sessions/${LESSON}`)[0][1]).toMatchObject({ sideQuestLog: null })
  })
})
