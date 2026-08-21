import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useIdentity } from '../useIdentity'

const authMocks = vi.hoisted(() => ({
  onAuthStateChanged: vi.fn(),
  signInAnonymously: vi.fn(),
}))

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (...args) => authMocks.onAuthStateChanged(...args),
  signInAnonymously:  (...args) => authMocks.signInAnonymously(...args),
}))

vi.mock('../../../shared/firebase', () => ({
  auth: {},
}))

const STORAGE_KEY = 'headstart_identity'
const MOCK_UID    = 'firebase-anon-uid'

describe('useIdentity', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    // Default: user is already signed in anonymously (persistent session)
    authMocks.onAuthStateChanged.mockImplementation((_auth, callback) => {
      callback({ uid: MOCK_UID })
      return () => {}
    })
  })

  it('loaded becomes true and identity stays null when localStorage is empty', async () => {
    const { result } = renderHook(() => useIdentity())

    await waitFor(() => {
      expect(result.current.loaded).toBe(true)
    })

    expect(result.current.identity).toBe(null)
  })

  it('reads an existing identity from localStorage on mount', async () => {
    const stored = {
      anonymousId: MOCK_UID,
      displayName: 'Alice',
      lastSessionTimestamp: 1000,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))

    const { result } = renderHook(() => useIdentity())

    await waitFor(() => {
      expect(result.current.loaded).toBe(true)
    })

    expect(result.current.identity).toEqual(stored)
  })

  it('migrates a legacy UUID-based anonymousId to the Firebase UID on load', async () => {
    const stored = {
      anonymousId: 'old-uuid-from-before-anon-auth',
      displayName: 'Alice',
      lastSessionTimestamp: 1000,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))

    const { result } = renderHook(() => useIdentity())

    await waitFor(() => expect(result.current.loaded).toBe(true))

    expect(result.current.identity).toEqual({
      anonymousId: MOCK_UID,
      displayName: 'Alice',
      lastSessionTimestamp: 1000,
    })
    // Also persisted to localStorage
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).anonymousId).toBe(MOCK_UID)
  })

  it('signs in anonymously when no user is currently signed in', async () => {
    authMocks.onAuthStateChanged.mockImplementation((_auth, callback) => {
      callback(null)
      return () => {}
    })
    authMocks.signInAnonymously.mockResolvedValue({ user: { uid: MOCK_UID } })

    const { result } = renderHook(() => useIdentity())

    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(authMocks.signInAnonymously).toHaveBeenCalled()
  })

  it('createIdentity uses the Firebase UID as anonymousId', async () => {
    const { result } = renderHook(() => useIdentity())

    await waitFor(() => expect(result.current.loaded).toBe(true))

    let created
    act(() => {
      created = result.current.createIdentity('Bob', 5000)
    })

    expect(created.anonymousId).toBe(MOCK_UID)
    expect(created.displayName).toBe('Bob')
    expect(created.lastSessionTimestamp).toBe(5000)

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(stored).toEqual(created)
  })

  it('hook returns the identity on subsequent renders after createIdentity', async () => {
    const { result } = renderHook(() => useIdentity())

    await waitFor(() => expect(result.current.loaded).toBe(true))

    act(() => {
      result.current.createIdentity('Charlie', 9999)
    })

    expect(result.current.identity).toMatchObject({
      displayName: 'Charlie',
      lastSessionTimestamp: 9999,
    })
  })

  it('updateTimestamp updates only the lastSessionTimestamp in state and localStorage', async () => {
    const { result } = renderHook(() => useIdentity())

    await waitFor(() => expect(result.current.loaded).toBe(true))

    act(() => {
      result.current.createIdentity('Dana', 1000)
    })

    const originalId = result.current.identity.anonymousId

    act(() => {
      result.current.updateTimestamp(2000)
    })

    expect(result.current.identity.lastSessionTimestamp).toBe(2000)
    expect(result.current.identity.displayName).toBe('Dana')
    expect(result.current.identity.anonymousId).toBe(originalId)

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(stored.lastSessionTimestamp).toBe(2000)
  })

  it('updateTimestamp does nothing when identity is null', async () => {
    const { result } = renderHook(() => useIdentity())

    await waitFor(() => expect(result.current.loaded).toBe(true))

    act(() => {
      result.current.updateTimestamp(9999)
    })

    expect(result.current.identity).toBe(null)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(null)
  })

  it('updateDisplayName updates only the displayName in state and localStorage', async () => {
    const { result } = renderHook(() => useIdentity())

    await waitFor(() => expect(result.current.loaded).toBe(true))

    act(() => {
      result.current.createIdentity('Eve', 3000)
    })

    const originalId = result.current.identity.anonymousId

    act(() => {
      result.current.updateDisplayName('Evelyn')
    })

    expect(result.current.identity.displayName).toBe('Evelyn')
    expect(result.current.identity.lastSessionTimestamp).toBe(3000)
    expect(result.current.identity.anonymousId).toBe(originalId)

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(stored.displayName).toBe('Evelyn')
  })

  it('updateDisplayName does nothing when identity is null', async () => {
    const { result } = renderHook(() => useIdentity())

    await waitFor(() => expect(result.current.loaded).toBe(true))

    act(() => {
      result.current.updateDisplayName('Ghost')
    })

    expect(result.current.identity).toBe(null)
  })

  it('handles corrupted localStorage JSON gracefully without throwing', async () => {
    localStorage.setItem(STORAGE_KEY, 'this is { not valid JSON !!!')

    const { result } = renderHook(() => useIdentity())

    await waitFor(() => {
      expect(result.current.loaded).toBe(true)
    })

    expect(result.current.identity).toBe(null)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(null)
  })

  it('retries a failed anonymous sign-in before falling back, and succeeds without setting authError if a retry works', async () => {
    authMocks.onAuthStateChanged.mockImplementation((_auth, callback) => {
      callback(null)
      return () => {}
    })
    authMocks.signInAnonymously
      .mockRejectedValueOnce(new Error('network blip'))
      .mockResolvedValueOnce({ user: { uid: MOCK_UID } })

    const { result } = renderHook(() => useIdentity())

    await waitFor(() => expect(result.current.loaded).toBe(true), { timeout: 5000 })

    expect(authMocks.signInAnonymously).toHaveBeenCalledTimes(2)
    expect(result.current.authError).toBe(false)
  }, 10000)

  it('falls back to a local UUID and reports authError after every retry fails', async () => {
    authMocks.onAuthStateChanged.mockImplementation((_auth, callback) => {
      callback(null)
      return () => {}
    })
    authMocks.signInAnonymously.mockRejectedValue(new Error('blocked'))

    const { result } = renderHook(() => useIdentity())

    await waitFor(() => expect(result.current.authError).toBe(true), { timeout: 10000 })

    expect(authMocks.signInAnonymously).toHaveBeenCalledTimes(3)
  }, 15000)

  it('retrySignIn re-attempts sign-in and clears authError on success', async () => {
    authMocks.onAuthStateChanged.mockImplementation((_auth, callback) => {
      callback(null)
      return () => {}
    })
    authMocks.signInAnonymously.mockRejectedValue(new Error('blocked'))

    const { result } = renderHook(() => useIdentity())
    await waitFor(() => expect(result.current.authError).toBe(true), { timeout: 10000 })

    authMocks.signInAnonymously.mockReset()
    authMocks.signInAnonymously.mockResolvedValue({ user: { uid: MOCK_UID } })

    act(() => { result.current.retrySignIn() })

    await waitFor(() => expect(result.current.authError).toBe(false))
  }, 15000)
})
