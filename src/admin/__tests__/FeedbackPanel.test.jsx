import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, afterEach } from 'vitest'
import FeedbackPanel from '../FeedbackPanel.jsx'

const updateDocMock = vi.fn()
const limitMock = vi.fn((n) => ({ __limit: n }))
const snapshotErrors = { current: null }

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({ kind: 'platform' })),
  collectionGroup: vi.fn(() => ({ kind: 'lessonFeedback' })),
  doc: vi.fn((...args) => args),
  orderBy: vi.fn(() => ({})),
  limit: (n) => limitMock(n),
  query: vi.fn((q) => q),
  updateDoc: (...args) => updateDocMock(...args),
  onSnapshot: (q, next, onError) => {
    if (snapshotErrors.current) {
      onError?.(new Error(snapshotErrors.current))
    } else if (q?.kind === 'lessonFeedback') {
      next({ docs: [] })
    } else {
      next({
        docs: [
          {
            id: 'fb1',
            data: () => ({
              teacherEmail: 't@example.com',
              submittedAt: Date.now(),
              text: 'Great platform!',
              archived: false,
            }),
          },
        ],
      })
    }
    return () => {}
  },
}))
vi.mock('../../shared/firebase', () => ({ firestore: {} }))

describe('FeedbackPanel — destructive delete confirmation', () => {
  afterEach(() => {
    updateDocMock.mockReset()
    limitMock.mockClear()
    snapshotErrors.current = null
    vi.restoreAllMocks()
  })

  it('does not archive feedback when the confirmation is cancelled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<FeedbackPanel subtab="platform" onSubtabChange={vi.fn()} />)

    fireEvent.click(screen.getByTitle('Archive feedback'))

    expect(window.confirm).toHaveBeenCalled()
    expect(updateDocMock).not.toHaveBeenCalled()
  })

  it('archives feedback once the confirmation is accepted', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<FeedbackPanel subtab="platform" onSubtabChange={vi.fn()} />)

    fireEvent.click(screen.getByTitle('Archive feedback'))

    expect(updateDocMock).toHaveBeenCalledTimes(1)
  })

  it('limits the lesson feedback listener to the newest 500 items', () => {
    render(<FeedbackPanel subtab="lesson" onSubtabChange={vi.fn()} />)

    expect(limitMock).toHaveBeenCalledWith(500)
  })

  it('shows an error instead of an empty list when a listener fails', () => {
    snapshotErrors.current = 'Missing or insufficient permissions.'
    render(<FeedbackPanel subtab="platform" onSubtabChange={vi.fn()} />)

    expect(
      screen.getByText(/Could not load platform feedback: Missing or insufficient/)
    ).toBeInTheDocument()
  })

  it('shows an error when archiving fails', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    updateDocMock.mockRejectedValue(new Error('permission-denied'))
    render(<FeedbackPanel subtab="platform" onSubtabChange={vi.fn()} />)

    fireEvent.click(screen.getByTitle('Archive feedback'))

    await waitFor(() =>
      expect(
        screen.getByText(/Could not archive the feedback: permission-denied/)
      ).toBeInTheDocument()
    )
  })
})
