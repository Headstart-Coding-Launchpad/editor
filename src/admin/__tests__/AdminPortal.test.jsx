import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authState = { user: { uid: 'tutor-a', email: 'a@example.test' } }

vi.mock('firebase/auth', () => ({ signOut: vi.fn(() => Promise.resolve()) }))
vi.mock('../../shared/firebase', () => ({ auth: {} }))
vi.mock('../../auth/useAuth', () => ({ useAuth: () => authState }))
vi.mock('../adminSnapshots', () => ({
  resetAdminSnapshots: vi.fn(),
  setAdminSnapshotsUser: vi.fn(),
}))
// Panels are lazy; keep them out of this test.
vi.mock('../LessonPanel', () => ({ default: () => <p>lessons panel</p> }))
vi.mock('../AppVersionFooter', () => ({ default: () => null }))

import { resetAdminSnapshots, setAdminSnapshotsUser } from '../adminSnapshots'
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

  it("ties the shared listeners to the signed-in user, so another account never sees the last one's data", () => {
    renderPortal()
    expect(setAdminSnapshotsUser).toHaveBeenCalledWith('tutor-a')
  })

  it('drops every cached Admin result on Sign out', async () => {
    renderPortal()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Sign out' })))
    expect(resetAdminSnapshots).toHaveBeenCalledTimes(1)
  })
})
