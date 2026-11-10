// students/{id}/health (src/shared/studentHealth.js, deep review R3): written once on a change.
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSession } from '../useSession'

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

const HEALTH = `sessions/${LESSON}/students/${STUDENT}/health`
const healthWrites = () =>
  firebaseMocks.set.mock.calls.filter(([r]) => r.path === HEALTH).map(([, value]) => value)

describe('writeStudentHealth', () => {
  it('writes a change once, never a repeat, and only the three values', async () => {
    const { result } = renderSession({ students: { [STUDENT]: { displayName: 'Mia' } } })
    await act(async () => {
      await result.current.writeStudentHealth(STUDENT, 'python_stuck')
      await result.current.writeStudentHealth(STUDENT, 'python_stuck')
      await result.current.writeStudentHealth(STUDENT, 'broken')
    })
    expect(healthWrites()).toEqual(['python_stuck'])
  })

  it("writes nothing for 'ok' on a healthy student, and 'ok' to clear a problem", async () => {
    const healthy = renderSession({ students: { [STUDENT]: { displayName: 'Mia' } } })
    await act(async () => {
      await healthy.result.current.writeStudentHealth(STUDENT, 'ok')
    })
    expect(healthWrites()).toEqual([])
    healthy.unmount()

    const stuck = renderSession({
      students: { [STUDENT]: { displayName: 'Mia', health: 'screen_error' } },
    })
    await act(async () => {
      await stuck.result.current.writeStudentHealth(STUDENT, 'screen_error')
      await stuck.result.current.writeStudentHealth(STUDENT, 'ok')
    })
    expect(healthWrites()).toEqual(['ok'])
  })

  it("never recreates a removed student's node", async () => {
    const { result } = renderSession({ students: {} })
    await act(async () => {
      await result.current.writeStudentHealth(STUDENT, 'python_stuck')
    })
    expect(healthWrites()).toEqual([])
  })
})
