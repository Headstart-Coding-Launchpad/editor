import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import FileDialog from '../FileDialog.jsx'

const fs = {
  '/': { type: 'dir' },
  '/Documents/': { type: 'dir' },
  '/notes.txt': { type: 'file', content: 'hi' },
  '/photo.png': { type: 'file', content: '' },
}

describe('FileDialog', () => {
  it('open mode lists files filtered by extension and confirms on double-click', () => {
    const onConfirm = vi.fn()
    render(<FileDialog fs={fs} mode="open" filterExtensions={['.png']} onConfirm={onConfirm} onCancel={() => {}} />)
    expect(screen.queryByText('notes.txt')).not.toBeInTheDocument()
    fireEvent.doubleClick(screen.getByText('photo.png'))
    expect(onConfirm).toHaveBeenCalledWith('/photo.png')
  })

  it('open mode requires a selection before confirming', () => {
    const onConfirm = vi.fn()
    render(<FileDialog fs={fs} mode="open" onConfirm={onConfirm} onCancel={() => {}} />)
    fireEvent.click(screen.getByText('Open'))
    expect(onConfirm).not.toHaveBeenCalled()
    expect(screen.getByText('Choose a file to open')).toBeInTheDocument()
  })

  it('saveAs mode confirms with the typed file name in the current folder', () => {
    const onConfirm = vi.fn()
    render(<FileDialog fs={fs} mode="saveAs" defaultFileName="draft.txt" onConfirm={onConfirm} onCancel={() => {}} />)
    fireEvent.click(screen.getByText('Save'))
    expect(onConfirm).toHaveBeenCalledWith('/draft.txt')
  })

  it('New Folder creates a folder via onFsChange', () => {
    const onFsChange = vi.fn()
    render(<FileDialog fs={fs} mode="saveAs" onFsChange={onFsChange} onConfirm={() => {}} onCancel={() => {}} />)
    fireEvent.click(screen.getByText('+ New Folder'))
    fireEvent.change(screen.getByPlaceholderText('Folder name'), { target: { value: 'Projects' } })
    fireEvent.click(screen.getByText('Create'))
    expect(onFsChange).toHaveBeenCalledWith(expect.objectContaining({ '/Projects/': { type: 'dir' } }))
  })

  it('navigating into a folder updates the path bar', () => {
    render(<FileDialog fs={fs} mode="open" onConfirm={() => {}} onCancel={() => {}} />)
    fireEvent.click(screen.getByText('Documents'))
    expect(screen.getByText('/Documents/')).toBeInTheDocument()
  })
})
