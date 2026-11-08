import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SoloPanel from '../SoloPanel'
import { resetAdminSnapshots } from '../adminSnapshots'

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, name) => ({ __collection: name })),
  collectionGroup: vi.fn((_db, name) => ({ __collectionGroup: name })),
  query: vi.fn((q) => q),
  orderBy: vi.fn(),
  limit: vi.fn((n) => ({ __limit: n })),
  onSnapshot: vi.fn(() => vi.fn()),
}))
vi.mock('../../shared/firebase', () => ({ firestore: {} }))
vi.mock('../../app/soloLogService', () => ({ readSoloLog: vi.fn(() => Promise.resolve({})) }))

import { limit, onSnapshot } from 'firebase/firestore'

let errorCallbacks = {}
let nextCallbacks = {}

describe('SoloPanel', () => {
  beforeEach(() => {
    resetAdminSnapshots()
    vi.clearAllMocks()
    errorCallbacks = {}
    nextCallbacks = {}
    onSnapshot.mockImplementation((ref, next, errorCb) => {
      errorCallbacks[ref.__collection ?? ref.__collectionGroup] = errorCb
      nextCallbacks[ref.__collection ?? ref.__collectionGroup] = next
      return vi.fn()
    })
  })

  it('reads the newest 20 session reports for side-quests, with Load more for 20 more', () => {
    render(<SoloPanel />)
    expect(limit).toHaveBeenLastCalledWith(20)

    act(() =>
      nextCallbacks.sessionReports({
        docs: Array.from({ length: 20 }, (_, i) => ({
          id: `r${i}`,
          data: () => ({ startedAt: 100 - i }),
          ref: { parent: { parent: { id: 'lesson-a' } } },
        })),
      })
    )
    fireEvent.click(screen.getByRole('button', { name: 'Load more reports' }))
    expect(limit).toHaveBeenLastCalledWith(40)
  })

  const reportsPage = (n) => ({
    docs: Array.from({ length: n }, (_, i) => ({
      id: `r${i}`,
      data: () => ({ startedAt: 100 - i }),
      ref: { parent: { parent: { id: 'lesson-a' } } },
    })),
  })

  it('keeps Load more when a report is deleted from a full page', () => {
    render(<SoloPanel />)
    act(() => nextCallbacks.sessionReports(reportsPage(20)))
    act(() => nextCallbacks.sessionReports(reportsPage(19)))
    expect(screen.getByRole('button', { name: 'Load more reports' })).toBeInTheDocument()
  })

  it('offers Retry when the bigger page of reports fails, and Retry reads it again', () => {
    render(<SoloPanel />)
    act(() => nextCallbacks.sessionReports(reportsPage(20)))
    fireEvent.click(screen.getByRole('button', { name: 'Load more reports' }))
    act(() => errorCallbacks.sessionReports(new Error('quota')))

    const calls = onSnapshot.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading more reports' }))
    expect(onSnapshot.mock.calls.length).toBe(calls + 1)
    expect(limit).toHaveBeenLastCalledWith(40)
  })

  it('shows an error when the session reports listener fails', async () => {
    render(<SoloPanel />)

    await act(async () => {
      errorCallbacks.sessionReports?.(new Error('reports denied'))
    })

    expect(
      screen.getByText(/Could not load side-quest reports: reports denied/)
    ).toBeInTheDocument()
  })
})
