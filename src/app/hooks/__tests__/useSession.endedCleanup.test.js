import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSession } from '../useSession'

// A small stand-in for the server: the stored session states and the onDisconnect handlers this
// connection has queued. cancel() drops a location's handlers and its children's, as Firebase does.
const server = vi.hoisted(() => ({ states: {}, listeners: new Map(), queued: new Set() }))

vi.mock('firebase/database', () => {
  const emit = (path) =>
    server.listeners.get(path)?.forEach((cb) => cb({ val: () => server.states[path] ?? null }))
  const write = (path, value) => {
    if (!/^sessions\/[^/]+$/.test(path) || !value?.state) return Promise.resolve()
    server.states[`${path}/state`] = value.state
    emit(`${path}/state`)
    return Promise.resolve()
  }
  return {
    ref: (_db, path) => ({ path }),
    set: (r, value) => write(r.path, value),
    update: (r, value) => write(r.path, value),
    remove: () => Promise.resolve(),
    push: (r) => ({ path: `${r.path}/key`, key: 'key' }),
    get: () => Promise.resolve({ val: () => null, exists: () => false }),
    serverTimestamp: () => 0,
    runTransaction: () => Promise.resolve({ committed: true }),
    onValue: (r, cb) => {
      const set = server.listeners.get(r.path) ?? new Set()
      server.listeners.set(r.path, set.add(cb))
      if (r.path.endsWith('/state')) cb({ val: () => server.states[r.path] ?? null })
      return () => set.delete(cb)
    },
    onDisconnect: ({ path }) => ({
      remove: () => Promise.resolve(void server.queued.add(path)),
      set: () => Promise.resolve(void server.queued.add(path)),
      cancel: () => {
        for (const p of server.queued) {
          if (p === path || p.startsWith(`${path}/`)) server.queued.delete(p)
        }
        return Promise.resolve()
      },
    }),
  }
})

vi.mock('../../../shared/firebase', () => ({ db: {} }))
vi.mock('../../../shared/onValueWhenSignedIn.js', () => ({
  onValueWhenSignedIn: () => () => {},
}))

const cleanupPaths = (key) =>
  ['sessions', 'sharedWorkspacePayloads', 'carryInbox', 'sessionArchive'].map(
    (root) => `${root}/${key}`
  )

async function endedSession(key) {
  const { result } = renderHook(() => useSession(key))
  await act(() => result.current.endSession())
  return result
}

// Another tab or tutor device writing the session: this tab only sees the new state.
function remoteState(key, state) {
  const path = `sessions/${key}/state`
  server.states[path] = state
  server.listeners.get(path)?.forEach((cb) => cb({ val: () => state }))
}

describe('endSession disconnect cleanup', () => {
  beforeEach(() => {
    server.states = {}
    server.listeners.clear()
    server.queued.clear()
  })

  it('stays queued while the session is ended, so closing the tab removes it', async () => {
    await endedSession('closed')
    expect([...server.queued]).toEqual(cleanupPaths('closed'))
  })

  it('is cancelled by Restart in the same tab', async () => {
    const result = await endedSession('same-tab')
    await act(() => result.current.restartSession())
    expect([...server.queued]).toEqual([])
  })

  it('is cancelled when another tab or device restarts the session', async () => {
    await endedSession('other-tab')
    act(() => remoteState('other-tab', null))
    expect(server.queued.size).toBe(4)
    act(() => remoteState('other-tab', 'waiting'))
    expect([...server.queued]).toEqual([])
  })

  it('is cancelled when Restart is pressed before End Session has finished', async () => {
    const { result } = renderHook(() => useSession('quick'))
    await act(async () => {
      const ending = result.current.endSession()
      await result.current.restartSession()
      await ending
    })
    expect([...server.queued]).toEqual([])
  })

  it('is queued again when the restarted session is ended again', async () => {
    const result = await endedSession('again')
    await act(() => result.current.restartSession())
    await act(() => result.current.endSession())
    expect([...server.queued]).toEqual(cleanupPaths('again'))
  })
})
