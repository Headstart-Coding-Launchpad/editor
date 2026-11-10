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

  it("never recreates a missing student's node, and writes once they are back", async () => {
    const { result } = renderSession({ students: {} })
    await act(async () => {
      await result.current.writeStudentHealth(STUDENT, 'python_stuck')
    })
    expect(healthWrites()).toEqual([])
    // The student's node arrives (joined late, or rejoined): the waiting value is written.
    await act(async () => {
      sessionCallback({
        exists: () => true,
        val: () => ({ students: { [STUDENT]: { displayName: 'Mia' } } }),
      })
    })
    expect(healthWrites()).toEqual(['python_stuck'])
  })

  it('is the same function on every render (R3: no effect re-runs from it)', () => {
    const { result, rerender } = renderSession({ students: { [STUDENT]: { displayName: 'Mia' } } })
    const first = result.current.writeStudentHealth
    rerender()
    act(() => {
      sessionCallback({
        exists: () => true,
        val: () => ({ students: { [STUDENT]: { displayName: 'Mia', online: true } } }),
      })
    })
    expect(result.current.writeStudentHealth).toBe(first)
  })

  it('a failed write is tried again on the next call', async () => {
    const { result } = renderSession({ students: { [STUDENT]: { displayName: 'Mia' } } })
    firebaseMocks.set.mockRejectedValueOnce(new Error('offline'))
    await act(async () => {
      await result.current.writeStudentHealth(STUDENT, 'python_stuck').catch(() => {})
      await result.current.writeStudentHealth(STUDENT, 'python_stuck')
    })
    expect(healthWrites()).toEqual(['python_stuck', 'python_stuck'])
  })

  it('writes again after the student node was removed and rejoined', async () => {
    const { result } = renderSession({ students: { [STUDENT]: { displayName: 'Mia' } } })
    await act(async () => {
      await result.current.writeStudentHealth(STUDENT, 'python_stuck')
    })
    // Confirmed, then removed, then rejoined without the field.
    act(() => {
      sessionCallback({
        exists: () => true,
        val: () => ({ students: { [STUDENT]: { displayName: 'Mia', health: 'python_stuck' } } }),
      })
    })
    act(() => {
      sessionCallback({ exists: () => true, val: () => ({ students: {} }) })
    })
    act(() => {
      sessionCallback({
        exists: () => true,
        val: () => ({ students: { [STUDENT]: { displayName: 'Mia' } } }),
      })
    })
    await act(async () => {
      await result.current.writeStudentHealth(STUDENT, 'python_stuck')
    })
    expect(healthWrites()).toEqual(['python_stuck', 'python_stuck'])
  })

  it('a repeat while the snapshot still lags the write is not written twice', async () => {
    const { result } = renderSession({ students: { [STUDENT]: { displayName: 'Mia' } } })
    await act(async () => {
      await Promise.all([
        result.current.writeStudentHealth(STUDENT, 'screen_error'),
        result.current.writeStudentHealth(STUDENT, 'screen_error'),
      ])
      await result.current.writeStudentHealth(STUDENT, 'screen_error')
    })
    expect(healthWrites()).toEqual(['screen_error'])
  })

  // Second review (10 Nov).
  it("an 'ok' sent while a problem write is still in flight is not skipped", async () => {
    const { result } = renderSession({ students: { [STUDENT]: { displayName: 'Mia' } } })
    let release
    firebaseMocks.set.mockImplementationOnce(() => new Promise((resolve) => (release = resolve)))
    await act(async () => {
      const stuck = result.current.writeStudentHealth(STUDENT, 'python_stuck')
      const ok = result.current.writeStudentHealth(STUDENT, 'ok')
      release()
      await Promise.all([stuck, ok])
    })
    expect(healthWrites()).toEqual(['python_stuck', 'ok'])
  })

  it('a rejected write is retried by itself, at most 3 more times', async () => {
    vi.useFakeTimers()
    try {
      const { result } = renderSession({ students: { [STUDENT]: { displayName: 'Mia' } } })
      firebaseMocks.set.mockRejectedValue(new Error('offline'))
      await act(async () => {
        await result.current.writeStudentHealth(STUDENT, 'python_stuck').catch(() => {})
      })
      expect(healthWrites()).toEqual(['python_stuck'])
      for (let i = 0; i < 6; i += 1) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(5000)
        })
      }
      expect(healthWrites()).toEqual(['python_stuck', 'python_stuck', 'python_stuck', 'python_stuck'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('a retry that then succeeds stops retrying', async () => {
    vi.useFakeTimers()
    try {
      const { result } = renderSession({ students: { [STUDENT]: { displayName: 'Mia' } } })
      firebaseMocks.set.mockRejectedValueOnce(new Error('offline'))
      await act(async () => {
        await result.current.writeStudentHealth(STUDENT, 'python_stuck').catch(() => {})
      })
      for (let i = 0; i < 4; i += 1) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(5000)
        })
      }
      expect(healthWrites()).toEqual(['python_stuck', 'python_stuck'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('a failed problem write is not retried once a newer value went out', async () => {
    vi.useFakeTimers()
    try {
      const { result } = renderSession({ students: { [STUDENT]: { displayName: 'Mia' } } })
      let fail
      firebaseMocks.set.mockImplementationOnce(
        () => new Promise((_resolve, reject) => (fail = reject))
      )
      await act(async () => {
        const stuck = result.current.writeStudentHealth(STUDENT, 'python_stuck').catch(() => {})
        const ok = result.current.writeStudentHealth(STUDENT, 'ok')
        fail(new Error('offline'))
        await Promise.all([stuck, ok])
      })
      for (let i = 0; i < 4; i += 1) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(5000)
        })
      }
      expect(healthWrites()).toEqual(['python_stuck', 'ok'])
    } finally {
      vi.useRealTimers()
    }
  })
})
