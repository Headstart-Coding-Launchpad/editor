import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SharedAssetsPanel from '../SharedAssetsPanel'

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, col, id) => ({ __collection: col, __id: id })),
  onSnapshot: vi.fn(() => vi.fn()),
  setDoc: vi.fn(() => Promise.resolve()),
  updateDoc: vi.fn(() => Promise.resolve()),
}))
vi.mock('firebase/storage', () => ({
  ref: vi.fn(() => ({})),
  uploadBytesResumable: vi.fn(),
  getDownloadURL: vi.fn(() => Promise.resolve('https://example.test/a.png')),
  deleteObject: vi.fn(() => Promise.resolve()),
}))
vi.mock('../../shared/firebase', () => ({ firestore: {}, storage: {} }))

import { onSnapshot, updateDoc } from 'firebase/firestore'
import { deleteObject } from 'firebase/storage'

const ASSET = { name: 'a.png', url: 'https://example.test/a.png', showInEditor: false }

describe('SharedAssetsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows an error when the shared assets listener fails', () => {
    onSnapshot.mockImplementation((_ref, _next, errorCb) => {
      errorCb(new Error('assets denied'))
      return vi.fn()
    })
    render(<SharedAssetsPanel subtab="python" onSubtabChange={vi.fn()} />)

    expect(screen.getByText(/Could not load shared assets: assets denied/)).toBeInTheDocument()
  })

  it('shows an error instead of looking saved when a save fails', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    onSnapshot.mockImplementation((_ref, next) => {
      next({ exists: () => true, data: () => ({ storageAssets: [ASSET] }) })
      return vi.fn()
    })
    updateDoc.mockRejectedValueOnce(new Error('write denied'))
    render(<SharedAssetsPanel subtab="python" onSubtabChange={vi.fn()} />)

    await user.click(screen.getByTitle('Delete'))

    await waitFor(() =>
      expect(screen.getByText(/Could not save changes: write denied/)).toBeInTheDocument()
    )
    expect(deleteObject).toHaveBeenCalled()
  })
})
