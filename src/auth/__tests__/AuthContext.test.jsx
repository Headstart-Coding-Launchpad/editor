import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AuthProvider } from '../AuthContext'
import { useAuth } from '../useAuth'

const authMocks = vi.hoisted(() => ({
  onAuthStateChanged: vi.fn(),
  getIdTokenResult: vi.fn(),
}))

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (...args) => authMocks.onAuthStateChanged(...args),
  getIdTokenResult: (...args) => authMocks.getIdTokenResult(...args),
}))

vi.mock('../../shared/firebase', () => ({
  auth: {},
}))

function Probe() {
  const { user, role, loading } = useAuth()
  return <div>{loading ? 'loading' : `user:${user?.uid ?? 'none'} role:${role ?? 'none'}`}</div>
}

describe('AuthContext', () => {
  let warnSpy
  let errorSpy

  beforeEach(() => {
    vi.clearAllMocks()
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
    errorSpy.mockRestore()
  })

  it('retries a failed cached token fetch without forcing a network refresh', async () => {
    const firebaseUser = { uid: 'teacher-uid' }
    authMocks.onAuthStateChanged.mockImplementation((_auth, callback) => {
      callback(firebaseUser)
      return () => {}
    })
    // Cold cache: first (cached) read throws, retry should succeed.
    authMocks.getIdTokenResult
      .mockRejectedValueOnce(new Error('cold cache'))
      .mockResolvedValueOnce({ claims: { role: 'teacher' } })

    render(<AuthProvider><Probe /></AuthProvider>)

    await waitFor(() => {
      expect(screen.getByText('user:teacher-uid role:teacher')).toBeInTheDocument()
    })

    // Regression guard for #180/#279: the retry must use forceRefresh=false. Passing
    // true rewrites the persisted auth user and can bounce other open tabs to /login.
    expect(authMocks.getIdTokenResult).toHaveBeenCalledTimes(2)
    expect(authMocks.getIdTokenResult).toHaveBeenNthCalledWith(1, firebaseUser, false)
    expect(authMocks.getIdTokenResult).toHaveBeenNthCalledWith(2, firebaseUser, false)
  })

  it('signs the user out and logs the cause if the retry also fails', async () => {
    const firebaseUser = { uid: 'teacher-uid' }
    authMocks.onAuthStateChanged.mockImplementation((_auth, callback) => {
      callback(firebaseUser)
      return () => {}
    })
    const retryError = new Error('still cold')
    authMocks.getIdTokenResult.mockRejectedValue(retryError)

    render(<AuthProvider><Probe /></AuthProvider>)

    await waitFor(() => {
      expect(screen.getByText('user:none role:none')).toBeInTheDocument()
    })

    // The redirect to /login that follows from this state needs a traceable cause —
    // both the cold-cache retry attempt and its final failure should be logged.
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('retrying with a network refresh'), expect.any(Error))
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('signing out and redirecting to /login'), retryError)
  })

  it('holds the loading screen during the grace period and signs out if no recovery', async () => {
    vi.useFakeTimers()
    try {
      const firebaseUser = { uid: 'teacher-uid' }
      let authCallback
      authMocks.onAuthStateChanged.mockImplementation((_auth, callback) => {
        authCallback = callback
        return () => {}
      })
      authMocks.getIdTokenResult.mockResolvedValue({ claims: { role: 'teacher' } })

      render(<AuthProvider><Probe /></AuthProvider>)

      // Initial sign-in
      await act(async () => { await authCallback(firebaseUser) })
      expect(screen.getByText('user:teacher-uid role:teacher')).toBeInTheDocument()

      // Firebase fires null — the cross-tab storage-event bounce (#180/#279/#305).
      // Should immediately enter loading (not redirect), log the warning, then sign
      // out only after the grace period elapses with no recovery.
      act(() => { authCallback(null) })
      expect(screen.getByText('loading')).toBeInTheDocument()
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('waiting for potential bounce recovery'))

      await act(async () => { vi.runAllTimers() })
      expect(screen.getByText('user:none role:none')).toBeInTheDocument()
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('no recovery within grace period'))
    } finally {
      vi.useRealTimers()
    }
  })

  it('recovers silently from a transient null without signing out if the user comes back within the grace period', async () => {
    vi.useFakeTimers()
    try {
      const firebaseUser = { uid: 'teacher-uid' }
      let authCallback
      authMocks.onAuthStateChanged.mockImplementation((_auth, callback) => {
        authCallback = callback
        return () => {}
      })
      authMocks.getIdTokenResult.mockResolvedValue({ claims: { role: 'teacher' } })

      render(<AuthProvider><Probe /></AuthProvider>)

      await act(async () => { await authCallback(firebaseUser) })
      expect(screen.getByText('user:teacher-uid role:teacher')).toBeInTheDocument()

      // Null bounce — enters loading
      act(() => { authCallback(null) })
      expect(screen.getByText('loading')).toBeInTheDocument()

      // User comes back before grace period (Firebase recovered) — should stay signed in
      await act(async () => { await authCallback(firebaseUser) })
      expect(screen.getByText('user:teacher-uid role:teacher')).toBeInTheDocument()

      // Confirm the grace-period timer was cancelled: running outstanding timers has no effect
      act(() => { vi.runAllTimers() })
      expect(screen.getByText('user:teacher-uid role:teacher')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})
