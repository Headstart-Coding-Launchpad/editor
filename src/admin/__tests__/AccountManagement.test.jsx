import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AccountManagement from '../AccountManagement.jsx'

const accounts = [
  {
    id: 'a1',
    displayName: 'Alice',
    email: 'alice@example.com',
    role: 'teacher',
    handle: 'alice',
    disabled: false,
  },
  { id: 'a2', displayName: '', email: 'bob@example.com', role: 'admin', disabled: true },
]

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  onSnapshot: (col, next) => {
    next({ docs: accounts.map((a) => ({ id: a.id, data: () => a })) })
    return () => {}
  },
}))
const callables = vi.hoisted(() => ({}))
vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn((_functions, name) => {
    callables[name] ??= vi.fn(() => Promise.resolve({}))
    return callables[name]
  }),
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

  it('shows each tutor handle and saves an edited one through setUserHandle', async () => {
    render(<AccountManagement />)
    const input = screen.getByLabelText('Handle for Alice')
    expect(input).toHaveValue('alice')
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    fireEvent.change(input, { target: { value: 'ally' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(callables.setUserHandle).toHaveBeenCalledWith({ uid: 'a1', handle: 'ally' })
    )
  })
})
