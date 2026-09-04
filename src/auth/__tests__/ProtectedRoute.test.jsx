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

  it('logs why it redirected when the role does not satisfy the requirement', () => {
    useAuth.mockReturnValue({ user: { uid: 'student-uid' }, role: 'student', loading: false })

    renderProtected({ requiredRole: 'teacher' })

    expect(screen.getByText('login page')).toBeInTheDocument()
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('role "student" does not satisfy required role "teacher"')
    )
  })

  it('does not log or redirect when the role satisfies the requirement', () => {
    useAuth.mockReturnValue({ user: { uid: 'teacher-uid' }, role: 'teacher', loading: false })

    renderProtected({ requiredRole: 'teacher' })

    expect(screen.getByText('secret')).toBeInTheDocument()
    expect(warnSpy).not.toHaveBeenCalled()
  })
})
