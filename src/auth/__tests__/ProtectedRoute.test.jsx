import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import ProtectedRoute from '../ProtectedRoute'
import { useAuth } from '../useAuth'

vi.mock('../useAuth', () => ({ useAuth: vi.fn() }))

function renderProtected({ requiredRole } = {}) {
  return render(
    <MemoryRouter initialEntries={['/builder']}>
      <Routes>
        <Route
          path="/builder"
          element={<ProtectedRoute requiredRole={requiredRole}>secret</ProtectedRoute>}
        />
        <Route path="/login" element={<div>login page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ProtectedRoute', () => {
  let warnSpy

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  it('logs why it redirected when there is no signed-in user', () => {
    useAuth.mockReturnValue({ user: null, role: null, loading: false })

    renderProtected()

    expect(screen.getByText('login page')).toBeInTheDocument()
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('no signed-in user'))
  })

  it('tells a signed-in user without the role that they need another account, with a way back', () => {
    useAuth.mockReturnValue({ user: { uid: 'student-uid' }, role: 'student', loading: false })

    renderProtected({ requiredRole: 'teacher' })

    expect(screen.queryByText('login page')).not.toBeInTheDocument()
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('You need a tutor account to see this page')
    expect(screen.getByRole('button', { name: '← Go back' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in with a different account' })).toHaveAttribute(
      'href',
      '/login'
    )
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('role "student" does not satisfy required role "teacher"')
    )
  })

  it('names the admin account when a tutor opens an admin page', () => {
    useAuth.mockReturnValue({ user: { uid: 'tutor-uid' }, role: 'teacher', loading: false })

    renderProtected({ requiredRole: 'admin' })

    expect(screen.getByRole('alert')).toHaveTextContent(
      'You need an admin account to see this page'
    )
  })

  it('does not log or redirect when the role satisfies the requirement', () => {
    useAuth.mockReturnValue({ user: { uid: 'teacher-uid' }, role: 'teacher', loading: false })

    renderProtected({ requiredRole: 'teacher' })

    expect(screen.getByText('secret')).toBeInTheDocument()
    expect(warnSpy).not.toHaveBeenCalled()
  })
})
