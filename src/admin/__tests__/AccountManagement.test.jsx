import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AccountManagement from '../AccountManagement.jsx'

const accounts = [
  { id: 'a1', displayName: 'Alice', email: 'alice@example.com', role: 'teacher', disabled: false },
  { id: 'a2', displayName: '', email: 'bob@example.com', role: 'admin', disabled: true },
]

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  onSnapshot: (col, next) => {
    next({ docs: accounts.map(a => ({ id: a.id, data: () => a })) })
    return () => {}
  },
}))
vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => vi.fn()),
}))
vi.mock('../../shared/firebase', () => ({
  firestore: {},
  functions: {},
}))
vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'current-admin' } }),
}))

describe('AccountManagement — table migration to shared AdminUi primitives', () => {
  it('renders every account with its email, role, and status', () => {
    render(<AccountManagement />)

    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(screen.getByText('bob@example.com')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Disabled')).toBeInTheDocument()
  })
})
