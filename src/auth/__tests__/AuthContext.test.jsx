import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
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
  beforeEach(() => {
    vi.clearAllMocks()
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

  it('signs the user out if the retry also fails', async () => {
    const firebaseUser = { uid: 'teacher-uid' }
    authMocks.onAuthStateChanged.mockImplementation((_auth, callback) => {
      callback(firebaseUser)
      return () => {}
    })
    authMocks.getIdTokenResult.mockRejectedValue(new Error('still cold'))

    render(<AuthProvider><Probe /></AuthProvider>)

    await waitFor(() => {
      expect(screen.getByText('user:none role:none')).toBeInTheDocument()
    })
  })
})
