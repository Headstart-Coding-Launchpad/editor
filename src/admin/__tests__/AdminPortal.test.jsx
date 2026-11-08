import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authState = { user: { uid: 'tutor-a', email: 'a@example.test' } }

vi.mock('firebase/auth', () => ({ signOut: vi.fn(() => Promise.resolve()) }))
vi.mock('../../shared/firebase', () => ({ auth: {} }))
vi.mock('../../auth/useAuth', () => ({ useAuth: () => authState }))
vi.mock('../adminSnapshots', () => ({ watchAdminSnapshotsAuth: vi.fn() }))
// Panels are lazy; keep them out of this test.
vi.mock('../LessonPanel', () => ({ default: () => <p>lessons panel</p> }))
vi.mock('../AppVersionFooter', () => ({ default: () => null }))

import { signOut } from 'firebase/auth'
import { watchAdminSnapshotsAuth } from '../adminSnapshots'
import AdminPortal from '../AdminPortal'

function renderPortal() {
  return render(
    <MemoryRouter initialEntries={['/admin/lessons']}>
      <Routes>
        <Route path="/admin/:tab?/:subtab?" element={<AdminPortal />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('AdminPortal and the shared Admin listeners', () => {
  beforeEach(() => vi.clearAllMocks())

  it('hands the shared listeners to the auth watch once mounted, never while rendering', () => {
    let calledDuringRender = false
    function Probe() {
      calledDuringRender = watchAdminSnapshotsAuth.mock.calls.length > 0
      return null
    }
    render(
      <>
        <MemoryRouter initialEntries={['/admin/lessons']}>
          <Routes>
            <Route path="/admin/:tab?/:subtab?" element={<AdminPortal />} />
          </Routes>
        </MemoryRouter>
        {/* Renders after the portal, before any effect runs. */}
        <Probe />
      </>
    )
    expect(calledDuringRender).toBe(false)
    expect(watchAdminSnapshotsAuth).toHaveBeenCalled()
  })

  it('Sign out signs out of Firebase (the auth watch then drops the cache)', async () => {
    renderPortal()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Sign out' })))
    expect(signOut).toHaveBeenCalledTimes(1)
  })
})
