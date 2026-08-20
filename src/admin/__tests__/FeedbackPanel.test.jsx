import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi, afterEach } from 'vitest'
import FeedbackPanel from '../FeedbackPanel.jsx'

const updateDocMock = vi.fn()

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  collectionGroup: vi.fn(() => ({ kind: 'lessonFeedback' })),
  doc: vi.fn((...args) => args),
  orderBy: vi.fn(() => ({})),
  query: vi.fn(() => ({ kind: 'platform' })),
  updateDoc: (...args) => updateDocMock(...args),
  onSnapshot: (q, next) => {
    if (q?.kind === 'lessonFeedback') {
      next({ docs: [] })
    } else {
      next({
        docs: [
          { id: 'fb1', data: () => ({ teacherEmail: 't@example.com', submittedAt: Date.now(), text: 'Great platform!', archived: false }) },
        ],
      })
    }
    return () => {}
  },
}))
vi.mock('../../shared/firebase', () => ({ firestore: {} }))

describe('FeedbackPanel — destructive delete confirmation', () => {
  afterEach(() => {
    updateDocMock.mockClear()
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
})
