import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import FileManagerApp from '../FileManagerApp.jsx'

function baseState() {
  return {
    fs: {
      '/': { type: 'dir' },
      '/Documents/': { type: 'dir' },
      '/Documents/notes.txt': { type: 'file', content: 'hello' },
    },
    recycleBin: [],
    windows: [],
  }
}

describe('FileManagerApp', () => {
  it('deleting a file moves it to the recycle bin instead of removing it permanently', () => {
    const state = baseState()
    const onStateChange = vi.fn()
    render(<FileManagerApp state={state} onStateChange={onStateChange} startsInDir="/Documents/" />)

    fireEvent.click(screen.getByText('notes.txt'))
    fireEvent.click(screen.getByRole('button', { name: /delete/i }))

    expect(onStateChange).toHaveBeenCalledTimes(1)
    const next = onStateChange.mock.calls[0][0]
    expect(next.fs['/Documents/notes.txt']).toBeUndefined()
    expect(next.recycleBin).toHaveLength(1)
    expect(next.recycleBin[0].path).toBe('/Documents/notes.txt')
  })

  it('restoring from the recycle bin panel puts the file back', () => {
    const state = {
      ...baseState(),
      fs: { '/': { type: 'dir' }, '/Documents/': { type: 'dir' } },
      recycleBin: [{
        path: '/Documents/notes.txt',
        entries: { '/Documents/notes.txt': { type: 'file', content: 'hello' } },
        originalParent: '/Documents/',
        deletedAt: 1,
      }],
    }
    const onStateChange = vi.fn()
    render(<FileManagerApp state={state} onStateChange={onStateChange} startsInDir="/Documents/" />)

    fireEvent.click(screen.getByRole('button', { name: /recycle bin/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }))

    const next = onStateChange.mock.calls[0][0]
    expect(next.fs['/Documents/notes.txt']).toEqual({ type: 'file', content: 'hello' })
    expect(next.recycleBin).toHaveLength(0)
  })

  it('searching finds a file by name and jumps to its folder on click', () => {
    const state = baseState()
    render(<FileManagerApp state={state} onStateChange={vi.fn()} startsInDir="/" />)

    fireEvent.change(screen.getByLabelText('Search files'), { target: { value: 'notes' } })
    expect(screen.getByText('/Documents/notes.txt')).toBeInTheDocument()

    fireEvent.click(screen.getByText('/Documents/notes.txt'))
    expect(screen.getByText('notes.txt')).toBeInTheDocument()
  })

  it('does not offer delete/rename/recycle-bin restore controls when disabled', () => {
    const state = {
      ...baseState(),
      recycleBin: [{ path: '/x.txt', entries: {}, originalParent: '/', deletedAt: 1 }],
    }
    render(<FileManagerApp state={state} onStateChange={vi.fn()} disabled startsInDir="/" />)
    fireEvent.click(screen.getByRole('button', { name: /recycle bin/i }))
    expect(screen.queryByRole('button', { name: 'Restore' })).not.toBeInTheDocument()
  })
})
