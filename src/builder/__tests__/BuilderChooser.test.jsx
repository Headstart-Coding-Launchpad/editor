import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
    { id: 'l2', type: 'composed', title: 'Second lesson', draft: true, tasks: [] },
  ]),
}))
vi.mock('../views/BuilderView', () => ({
  default: ({ lesson, advanced }) => (
    <div data-testid="builder-view" data-advanced={String(advanced)}>
      {lesson.id}
    </div>
  ),
}))
vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ user: { uid: 't1' }, role: 'teacher', loading: false }),
}))

import BuilderApp from '../App'

function renderAt(entries) {
  return render(
    <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
      <Routes>
        <Route path="/builder" element={<BuilderApp />} />
        <Route path="/account" element={<div>Account page</div>} />
        <Route path="/lesson/:id" element={<div>Lesson page</div>} />
        <Route path="/" element={<div>Home page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('Lesson Builder start screen', () => {
  beforeEach(() => localStorage.clear())

  it('opens straight on the lesson in ?load= with no lesson step', async () => {
    renderAt(['/builder?load=l1'])
    const view = await screen.findByTestId('builder-view')
    expect(view).toHaveTextContent('l1')
    expect(view).toHaveAttribute('data-advanced', 'false')
    expect(screen.queryByText('Open a lesson')).not.toBeInTheDocument()
  })

  it('with no lesson shows a plain list with draft flags, and opens a lesson from it', async () => {
    const user = userEvent.setup()
    renderAt(['/builder'])
    expect(await screen.findByText(/First lesson/)).toBeInTheDocument()
    expect(screen.getByText('Draft')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /First lesson/ }))
    await waitFor(() => expect(screen.getByTestId('builder-view')).toHaveTextContent('l1'))
  })

  it('hides blank-lesson, upload and several-module options by default', async () => {
    renderAt(['/builder'])
    await screen.findByText(/First lesson/)
    expect(screen.queryByRole('button', { name: 'New blank lesson' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /JSON/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/several module types|composed/i)).not.toBeInTheDocument()
  })

  it('shows them with ?advanced=1', async () => {
    renderAt(['/builder?advanced=1'])
    await screen.findByText(/First lesson/)
    expect(screen.getByRole('button', { name: 'New blank lesson' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Open a lesson file/ })).toBeInTheDocument()
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
})
