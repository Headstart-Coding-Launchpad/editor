import React from 'react'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import SessionsPanel from '../SessionsPanel'

const firebaseDbMocks = vi.hoisted(() => ({
  ref:     vi.fn((_db, path) => ({ path })),
  onValue: vi.fn(),
  remove:  vi.fn(() => Promise.resolve()),
}))

vi.mock('firebase/database', () => ({
  ref:     (...args) => firebaseDbMocks.ref(...args),
  onValue: (...args) => firebaseDbMocks.onValue(...args),
  remove:  (...args) => firebaseDbMocks.remove(...args),
}))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, name) => ({ __collection: name })),
  onSnapshot: vi.fn(() => vi.fn()),
}))

vi.mock('../../shared/firebase', () => ({
  db: {},
  firestore: {},
}))

import { onSnapshot } from 'firebase/firestore'

let sessionsCallback = null

function fireSessions(sessionsById) {
  act(() => {
    sessionsCallback?.({
      exists: () => sessionsById !== null,
      val: () => sessionsById,
    })
  })
}

function fireLessons(lessons) {
  const lessonsCallback = onSnapshot.mock.calls[0]?.[1]
  act(() => {
    lessonsCallback?.({ docs: lessons.map(l => ({ id: l.id, data: () => l })) })
  })
}

describe('SessionsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionsCallback = null

    firebaseDbMocks.onValue.mockImplementation((_ref, successCb) => {
      sessionsCallback = successCb
      return vi.fn()
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows an empty state when there are no open sessions', () => {
    render(<SessionsPanel />)
    fireSessions({})

    expect(screen.getByText(/No sessions are currently open/i)).toBeInTheDocument()
  })

  it('lists sessions that are not ended', () => {
    render(<SessionsPanel />)
    fireSessions({
      'py-intro': { state: 'active', createdAt: Date.now(), students: {} },
      'html-1':   { state: 'ended', createdAt: Date.now(), students: {} },
    })

    expect(screen.getAllByText('py-intro').length).toBeGreaterThan(0)
    expect(screen.queryAllByText('html-1').length).toBe(0)
  })

  it('shows the lesson title when known', () => {
    render(<SessionsPanel />)
    fireLessons([{ id: 'py-intro', title: 'Intro to Python' }])
    fireSessions({ 'py-intro': { state: 'waiting', createdAt: Date.now(), students: {} } })

    expect(screen.getByText('Intro to Python')).toBeInTheDocument()
  })

  it('shows online and joined student counts', () => {
    render(<SessionsPanel />)
    fireSessions({
      'py-intro': {
        state: 'active',
        createdAt: Date.now(),
        students: {
          a: { online: true },
          b: { online: false },
        },
      },
    })

    expect(screen.getByText('1 online · 2 joined')).toBeInTheDocument()
  })

  it('shows a Paused chip for paused sessions', () => {
    render(<SessionsPanel />)
    fireSessions({ 'py-intro': { state: 'active', isPaused: true, createdAt: Date.now(), students: {} } })

    expect(screen.getByText('Paused')).toBeInTheDocument()
  })

  it('closes a session by removing it from Realtime Database', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<SessionsPanel />)
    fireSessions({ 'py-intro': { state: 'active', createdAt: Date.now(), students: {} } })

    await user.click(screen.getByRole('button', { name: 'Close Session' }))

    expect(firebaseDbMocks.remove).toHaveBeenCalledWith({ path: 'sessions/py-intro' })
  })

  it('does not close a session when the confirmation is declined', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<SessionsPanel />)
    fireSessions({ 'py-intro': { state: 'active', createdAt: Date.now(), students: {} } })

    await user.click(screen.getByRole('button', { name: 'Close Session' }))

    expect(firebaseDbMocks.remove).not.toHaveBeenCalled()
  })
})
