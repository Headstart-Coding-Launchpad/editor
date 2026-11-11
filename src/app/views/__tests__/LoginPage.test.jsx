import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('firebase/auth', () => ({ signInWithEmailAndPassword: vi.fn() }))
vi.mock('../../../shared/firebase', () => ({ auth: {} }))
vi.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams()],
  useNavigate: () => vi.fn(),
}))
vi.mock('../../../auth/useAuth', () => ({ useAuth: () => ({ user: null }) }))

import LoginPage from '../LoginPage'

// The tutor sign-in on the shared purple card: one heading and three controls, nothing else.
describe('LoginPage', () => {
  it('shows "Tutor sign in" with Email, Password and Sign in only', () => {
    render(<LoginPage />)

    expect(screen.getByRole('heading', { name: 'Tutor sign in' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email')
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Sign in' })).toHaveAttribute('type', 'submit')
    expect(screen.getAllByRole('textbox')).toHaveLength(1)
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })
})
