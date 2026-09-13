import React, { useEffect } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import LessonRoute from '../LessonRoute'
import { useAuth } from '../../../auth/useAuth'

vi.mock('../../../auth/useAuth', () => ({ useAuth: vi.fn() }))

vi.mock('../TeacherView', () => ({
  default: ({ lessonId }) => <div>TeacherView {lessonId}</div>,
}))

const studentViewMounts = []

// Mount-only (empty deps): records a fresh instance, not a re-render with new props —
// this is what actually distinguishes a remount (local state reset, e.g.
// `viewingCompletionScreen`) from React Router reusing the same StudentView instance
// across a lessonId param change (see the `key={lessonId}` fix in LessonRoute.jsx).
function MockStudentView(props) {
  useEffect(() => {
    studentViewMounts.push(props.lessonId)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally mount-only
  }, [])
  return <div>StudentView {JSON.stringify(props)}</div>
}

vi.mock('../StudentView', () => ({
  default: MockStudentView,
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

// Renders LessonRoute alongside a link that navigates to a different lesson's URL
// (same route pattern, different :lessonId) — the exact shape of the "Try the Solo
// Challenge" navigation, which sets window.location.hash to a different /lesson/:id.
function NavigateLink({ to }) {
  const navigate = useNavigate()
  return (
    <button type="button" onClick={() => navigate(to)}>
      Navigate
    </button>
  )
}

function renderRouteWithNavigation(from, to) {
  return render(
    <MemoryRouter initialEntries={[from]}>
      <Routes>
        <Route
          path="/lesson/:lessonId"
          element={
            <>
              <LessonRoute />
              <NavigateLink to={to} />
            </>
          }
        />
      </Routes>
    </MemoryRouter>
  )
}

describe('LessonRoute', () => {
  beforeEach(() => {
    studentViewMounts.length = 0
  })

  it('remounts StudentView (resetting its local state) when navigating to a different lesson id', async () => {
    useAuth.mockReturnValue({ user: null, role: null, loading: false })
    renderRouteWithNavigation('/lesson/parent-1', '/lesson/companion-1')

    expect(studentViewMounts).toEqual(['parent-1'])

    fireEvent.click(screen.getByText('Navigate'))

    await waitFor(() => expect(studentViewMounts).toEqual(['parent-1', 'companion-1']))
  })

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
