import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, afterEach } from 'vitest'
import FeedbackPanel from '../FeedbackPanel.jsx'
import { resetAdminSnapshots } from '../adminSnapshots'

const updateDocMock = vi.fn()
const snapshotErrors = { current: null }
const platformDocs = { current: null }
const limitMock = vi.fn((n) => ({ limit: n }))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({ kind: 'platform' })),
  collectionGroup: vi.fn(() => ({ kind: 'lessonFeedback' })),
  doc: vi.fn((...args) => args),
  orderBy: vi.fn(() => ({})),
  query: vi.fn((q) => q),
  limit: (...args) => limitMock(...args),
  updateDoc: (...args) => updateDocMock(...args),
  onSnapshot: (q, next, onError) => {
    if (snapshotErrors.current) {
      onError?.(new Error(snapshotErrors.current))
    } else if (q?.kind === 'lessonFeedback') {
      next({ docs: [] })
    } else if (platformDocs.current) {
      next({ docs: platformDocs.current })
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
    resetAdminSnapshots()
    updateDocMock.mockReset()
    limitMock.mockClear()
    platformDocs.current = null
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

describe('FeedbackPanel — reads a page at a time', () => {
  afterEach(() => {
    resetAdminSnapshots()
    limitMock.mockClear()
    platformDocs.current = null
  })

  it('reads the newest 30 platform feedback items, with Load more for 30 more', () => {
    platformDocs.current = Array.from({ length: 30 }, (_, i) => ({
      id: `fb${i}`,
      data: () => ({ teacherEmail: 't@example.com', submittedAt: 1000 - i, text: `Note ${i}` }),
    }))
    render(<FeedbackPanel subtab="platform" onSubtabChange={vi.fn()} />)
    expect(limitMock).toHaveBeenLastCalledWith(30)

    fireEvent.click(screen.getByRole('button', { name: 'Load more feedback' }))
    expect(limitMock).toHaveBeenLastCalledWith(60)
  })

  it('offers no Load more when everything fits', () => {
    render(<FeedbackPanel subtab="platform" onSubtabChange={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Load more feedback' })).not.toBeInTheDocument()
  })
})
