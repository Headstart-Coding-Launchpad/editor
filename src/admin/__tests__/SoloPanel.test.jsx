import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SoloPanel from '../SoloPanel'

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

describe('SoloPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    errorCallbacks = {}
    onSnapshot.mockImplementation((ref, _next, errorCb) => {
      errorCallbacks[ref.__collection ?? ref.__collectionGroup] = errorCb
      return vi.fn()
    })
  })

  it('reads only the newest 300 session reports for side-quests', () => {
    render(<SoloPanel />)

    expect(limit).toHaveBeenCalledWith(300)
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
