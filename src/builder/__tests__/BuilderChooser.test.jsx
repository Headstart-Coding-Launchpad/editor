import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authState = { user: { uid: 't1' }, role: 'teacher', loading: false }

vi.mock('../../shared/firebase', () => ({ db: {}, auth: {}, firestore: {} }))
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, _col, id) => ({ id })),
  getDoc: vi.fn(async (ref) => ({
    exists: () => true,
    data: () => ({ id: ref.id, type: 'composed', title: `Lesson ${ref.id}`, tasks: [] }),
  })),
}))
vi.mock('../../shared/lessonService', () => ({
  fetchLessonList: vi.fn(async () => [
    { id: 'l1', type: 'composed', title: 'First lesson', tasks: [] },
  ]),
}))
vi.mock('../views/BuilderView', () => ({
  default: ({ lesson, advanced, onNew }) => (
    <div data-testid="builder-view" data-advanced={String(advanced)}>
      {lesson.id || 'blank'}
      <button type="button" onClick={onNew}>
        All lessons
      </button>
    </div>
  ),
}))
vi.mock('../../auth/useAuth', () => ({ useAuth: () => authState }))

import { fetchLessonList } from '../../shared/lessonService'
import BuilderApp from '../App'

function renderAt(entries) {
  return render(
    <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
      <Routes>
        <Route path="/builder" element={<BuilderApp />} />
        <Route path="/account" element={<div>Account page</div>} />
        <Route path="/admin/:tab?" element={<div>Admin lessons page</div>} />
        <Route path="/lesson/:id" element={<div>Lesson page</div>} />
        <Route path="/" element={<div>Home page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('Lesson Builder start screen', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    authState.role = 'teacher'
  })

  it('opens straight on the lesson in ?load= with no start step', async () => {
    renderAt(['/builder?load=l1'])
    const view = await screen.findByTestId('builder-view')
    expect(view).toHaveTextContent('l1')
    expect(view).toHaveAttribute('data-advanced', 'false')
    expect(screen.queryByRole('button', { name: 'New lesson' })).not.toBeInTheDocument()
  })

  it('is a calm start screen: New lesson, Upload lesson file and a pointer to Admin, no lesson list', async () => {
    renderAt(['/builder'])
    expect(await screen.findByRole('button', { name: 'New lesson' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Upload lesson file' })).toBeInTheDocument()
    expect(screen.getByText(/To edit an existing lesson, open it from Admin/)).toBeInTheDocument()
    expect(screen.queryByText(/First lesson/)).not.toBeInTheDocument()
    expect(screen.queryByText('Open a lesson')).not.toBeInTheDocument()
    expect(fetchLessonList).not.toHaveBeenCalled()
  })

  it('New lesson opens a blank lesson in the Builder', async () => {
    const user = userEvent.setup()
    renderAt(['/builder?advanced=1'])
    await user.click(await screen.findByRole('button', { name: 'New lesson' }))
    const view = await screen.findByTestId('builder-view')
    expect(view).toHaveTextContent('blank')
    expect(view).toHaveAttribute('data-advanced', 'true')
  })

  it('has a way back and an account link', async () => {
    const user = userEvent.setup()
    renderAt(['/builder'])
    await user.click(screen.getByRole('button', { name: 'Account' }))
    expect(screen.getByText('Account page')).toBeInTheDocument()
  })

  it('Back returns to where the tutor came from', async () => {
    const user = userEvent.setup()
    const length = vi.spyOn(window.history, 'length', 'get').mockReturnValue(2)
    try {
      renderAt(['/lesson/abc', '/builder'])
      await user.click(screen.getByRole('button', { name: 'Back' }))
      expect(screen.getByText('Lesson page')).toBeInTheDocument()
    } finally {
      length.mockRestore()
    }
  })

  it('the toolbar All lessons takes an admin back to Admin > Lessons', async () => {
    authState.role = 'admin'
    const user = userEvent.setup()
    renderAt(['/builder?load=l1'])
    await user.click(await screen.findByRole('button', { name: 'All lessons' }))
    expect(await screen.findByText('Admin lessons page')).toBeInTheDocument()
  })

  it('All lessons still asks first when there are unsaved changes', async () => {
    authState.role = 'admin'
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    localStorage.setItem('headstart_builder_current', JSON.stringify({ id: 'l9', tasks: [] }))
    const user = userEvent.setup()
    try {
      renderAt(['/builder'])
      await user.click(await screen.findByRole('button', { name: 'Restore' }))
      await user.click(await screen.findByRole('button', { name: 'All lessons' }))
      expect(confirm).toHaveBeenCalledTimes(1)
      expect(screen.getByTestId('builder-view')).toHaveTextContent('l9')
      await waitFor(() => expect(screen.queryByText('Admin lessons page')).not.toBeInTheDocument())
    } finally {
      confirm.mockRestore()
    }
  })
})
