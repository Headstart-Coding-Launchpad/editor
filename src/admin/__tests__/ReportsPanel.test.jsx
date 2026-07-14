import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ReportsPanel from '../ReportsPanel'

const firestoreMocks = vi.hoisted(() => ({
  collectionGroup: vi.fn(() => ({ __cg: 'sessionReports' })),
  query: vi.fn(q => q),
  orderBy: vi.fn(),
  onSnapshot: vi.fn(),
}))

vi.mock('firebase/firestore', () => ({
  collectionGroup: (...args) => firestoreMocks.collectionGroup(...args),
  query: (...args) => firestoreMocks.query(...args),
  orderBy: (...args) => firestoreMocks.orderBy(...args),
  onSnapshot: (...args) => firestoreMocks.onSnapshot(...args),
}))

vi.mock('../../shared/firebase', () => ({ firestore: {} }))

function makeDoc({ lessonId, id, data }) {
  return {
    id,
    data: () => data,
    ref: { parent: { parent: { id: lessonId } } },
  }
}

describe('ReportsPanel', () => {
  let snapshotCallback = null
  let errorCallback = null

  beforeEach(() => {
    vi.clearAllMocks()
    snapshotCallback = null
    errorCallback = null
    firestoreMocks.onSnapshot.mockImplementation((_q, onNext, onError) => {
      snapshotCallback = onNext
      errorCallback = onError
      return vi.fn()
    })
  })

  it('shows an empty state when there are no reports', async () => {
    render(<ReportsPanel />)
    act(() => snapshotCallback({ docs: [] }))
    await waitFor(() => {
      expect(screen.getByText(/No session reports yet/)).toBeInTheDocument()
    })
  })

  it('lists reports across lessons and opens one on View', async () => {
    render(<ReportsPanel />)
    act(() => snapshotCallback({
      docs: [
        makeDoc({
          lessonId: 'python-1', id: '1000',
          data: {
            lessonTitle: 'Intro to Python', startedAt: 1000, endedAt: 2000,
            students: [{ anonymousId: 'a', displayName: 'A', tasks: [] }], taskSummary: [],
          },
        }),
      ],
    }))
    await waitFor(() => {
      expect(screen.getByText('Intro to Python')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'View' }))
    expect(screen.getAllByText('Intro to Python').length).toBeGreaterThan(0)
  })

  it('filters reports by lesson title or id', async () => {
    render(<ReportsPanel />)
    act(() => snapshotCallback({
      docs: [
        makeDoc({ lessonId: 'python-1', id: '1000', data: { lessonTitle: 'Intro to Python', startedAt: 1000, endedAt: 2000, students: [], taskSummary: [] } }),
        makeDoc({ lessonId: 'html-1', id: '2000', data: { lessonTitle: 'HTML Basics', startedAt: 1500, endedAt: 2500, students: [], taskSummary: [] } }),
      ],
    }))
    await waitFor(() => expect(screen.getByText('Intro to Python')).toBeInTheDocument())
    fireEvent.change(screen.getByPlaceholderText(/Filter by lesson/), { target: { value: 'html' } })
    expect(screen.queryByText('Intro to Python')).not.toBeInTheDocument()
    expect(screen.getByText('HTML Basics')).toBeInTheDocument()
  })

  it('surfaces a fetch error', async () => {
    render(<ReportsPanel />)
    act(() => errorCallback(new Error('permission-denied')))
    await waitFor(() => {
      expect(screen.getByText(/Could not load reports: permission-denied/)).toBeInTheDocument()
    })
  })
})
