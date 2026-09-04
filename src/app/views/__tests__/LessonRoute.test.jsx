import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import LessonRoute from '../LessonRoute'
import { useAuth } from '../../../auth/useAuth'

vi.mock('../../../auth/useAuth', () => ({ useAuth: vi.fn() }))

vi.mock('../TeacherView', () => ({
  default: ({ lessonId }) => <div>TeacherView {lessonId}</div>,
}))

vi.mock('../StudentView', () => ({
  default: (props) => <div>StudentView {JSON.stringify(props)}</div>,
}))

function renderRoute(search) {
  return render(
    <MemoryRouter initialEntries={[`/lesson/scratch-1-1${search}`]}>
      <Routes>
        <Route path="/lesson/:lessonId" element={<LessonRoute />} />
        <Route path="/login" element={<div>login page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('LessonRoute', () => {
  it('renders the plain StudentView for a bare student link', () => {
    useAuth.mockReturnValue({ user: null, role: null, loading: false })
    renderRoute('')
    expect(screen.getByText(/StudentView/)).toHaveTextContent('"forceSolo":false')
  })

  it('renders TeacherView for an authorised teacher', () => {
    useAuth.mockReturnValue({ user: { uid: 't1' }, role: 'teacher', loading: false })
    renderRoute('?teacher=true')
    expect(screen.getByText('TeacherView scratch-1-1')).toBeInTheDocument()
  })

  it('renders the presenter StudentView for an authorised teacher with present=true', () => {
    useAuth.mockReturnValue({ user: { uid: 't1' }, role: 'teacher', loading: false })
    renderRoute('?teacher=true&present=true')
    expect(screen.getByText(/StudentView/)).toHaveTextContent('"teacherPresentation":true')
  })

  it('redirects an unauthenticated visitor away from ?preview=true', () => {
    useAuth.mockReturnValue({ user: null, role: null, loading: false })
    renderRoute('?preview=true')
    expect(screen.getByText('login page')).toBeInTheDocument()
  })

  it('redirects a signed-in student away from ?preview=true', () => {
    useAuth.mockReturnValue({ user: { uid: 's1' }, role: 'student', loading: false })
    renderRoute('?preview=true')
    expect(screen.getByText('login page')).toBeInTheDocument()
  })

  it('renders an ephemeral, unrestricted solo StudentView for an authorised teacher with ?preview=true', () => {
    useAuth.mockReturnValue({ user: { uid: 't1' }, role: 'teacher', loading: false })
    renderRoute('?preview=true')
    const el = screen.getByText(/StudentView/)
    expect(el).toHaveTextContent('"forceSolo":true')
    expect(el).toHaveTextContent('"previewMode":true')
    expect(el).toHaveTextContent('"allowUnrestrictedTaskNavigation":true')
  })

  it('also allows an authorised admin to use ?preview=true', () => {
    useAuth.mockReturnValue({ user: { uid: 'a1' }, role: 'admin', loading: false })
    renderRoute('?preview=true')
    expect(screen.getByText(/StudentView/)).toHaveTextContent('"previewMode":true')
  })
})
