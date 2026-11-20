import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fb = vi.hoisted(() => ({
  ref: vi.fn((_db, path) => ({ path })),
  set: vi.fn(() => Promise.resolve()),
}))
vi.mock('firebase/database', () => ({
  ref: (...a) => fb.ref(...a),
  set: (...a) => fb.set(...a),
}))
vi.mock('../../../shared/firebase', () => ({ db: {} }))

import { useStudentBeacon, writeHealthBeacon } from '../useHealthBeacon'

const PATH = 'sessions/L1/students/kid/healthBeacon'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('writeHealthBeacon (R1)', () => {
  it("writes the summary to the student's own node and resolves true", async () => {
    const session = { students: { kid: { displayName: 'Mia' } } }
    expect(await writeHealthBeacon('L1', session, 'kid', { errorCount: 1 })).toBe(true)
    expect(fb.set).toHaveBeenCalledWith({ path: PATH }, { errorCount: 1 })
  })

  it('never recreates a student missing from the session: resolves false', async () => {
    expect(await writeHealthBeacon('L1', { students: {} }, 'kid', { errorCount: 1 })).toBe(false)
    expect(await writeHealthBeacon(null, { students: { kid: {} } }, 'kid', {})).toBe(false)
    expect(fb.set).not.toHaveBeenCalled()
  })
})

describe('useStudentBeacon', () => {
  const base = {
    sessionKey: 'L1',
    identity: { anonymousId: 'kid' },
    cs: { pyodideStatus: 'idle' },
    connected: true,
    serverTimeOffset: 0,
  }

  it('writes once in a live lesson while the node exists, never otherwise', async () => {
    const withNode = { students: { kid: {} } }
    renderHook(() => useStudentBeacon({ ...base, session: withNode, live: false }))
    renderHook(() => useStudentBeacon({ ...base, session: { students: {} }, live: true }))
    expect(fb.set).not.toHaveBeenCalled()
    await act(async () => {
      renderHook(() => useStudentBeacon({ ...base, session: withNode, live: true }))
    })
    expect(fb.set).toHaveBeenCalledTimes(1)
    expect(fb.set.mock.calls[0][0]).toEqual({ path: PATH })
  })

  it("sends 'stuck' when Python is stuck", async () => {
    await act(async () => {
      renderHook(() =>
        useStudentBeacon({
          ...base,
          cs: { pythonStuck: true, pyodideStatus: 'error' },
          session: { students: { kid: {} } },
          live: true,
        })
      )
    })
    expect(fb.set.mock.calls[0][1].pythonStatus).toBe('stuck')
  })
})
