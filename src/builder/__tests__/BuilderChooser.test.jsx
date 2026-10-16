import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../shared/firebase', () => ({ db: {}, auth: {}, firestore: {} }))
vi.mock('firebase/firestore', () => ({ doc: vi.fn(), getDoc: vi.fn() }))
vi.mock('../../shared/lessonService', () => ({ fetchLessonList: vi.fn(async () => []) }))
vi.mock('../views/BuilderView', () => ({ default: () => <div data-testid="builder-view" /> }))
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

  it('uses plain wording for its two ways in', () => {
    renderAt(['/builder'])
    expect(
      screen.getByRole('button', { name: /Create a lesson with several module types/ })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open a lesson file (JSON)' })).toBeInTheDocument()
    expect(screen.queryByText(/composed lesson/)).not.toBeInTheDocument()
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
