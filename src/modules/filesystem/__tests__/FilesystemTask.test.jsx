import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import FilesystemTask from '../FilesystemTask'

const fs = {
  '/': { type: 'dir' },
  '/Pictures/': { type: 'dir' },
  '/Pictures/avatar.png': { type: 'file', src: 'avatar.png' },
}

function gridItem(name) {
  return screen.getAllByText(name).find(element => element.parentElement?.draggable).parentElement
}

describe('FilesystemTask', () => {
  it('navigates up to the parent folder', () => {
    render(<FilesystemTask fs={fs} onFsChange={vi.fn()} />)

    const up = screen.getByRole('button', { name: 'Go up one folder' })
    expect(up).toBeDisabled()

    fireEvent.doubleClick(gridItem('Pictures'))
    expect(up).toBeEnabled()

    fireEvent.click(up)
    expect(up).toBeDisabled()
  })

  it('renders an asset-backed image preview and reports browse interactions', () => {
    const onInteraction = vi.fn()
    render(
      <FilesystemTask
        fs={fs}
        onFsChange={vi.fn()}
        onInteraction={onInteraction}
        assetsPath="https://assets.example/lesson/"
        assets={['avatar.png']}
      />,
    )

    fireEvent.doubleClick(gridItem('Pictures'))
    fireEvent.click(screen.getByText('avatar.png'))

    expect(screen.getByAltText('avatar.png')).toHaveAttribute('src', 'https://assets.example/lesson/avatar.png')
    expect(onInteraction).toHaveBeenLastCalledWith({ currentDir: '/Pictures/', openFile: '/Pictures/avatar.png' })
  })

  it('shows a status message and does not call onFsChange when a rename collides by name, case-insensitively', () => {
    const fsWithTwo = {
      '/': { type: 'dir' },
      '/Pictures/': { type: 'dir' },
      '/Pictures/avatar.png': { type: 'file', content: '' },
      '/Pictures/AVATAR2.png': { type: 'file', content: '' },
    }
    const onFsChange = vi.fn()
    render(<FilesystemTask fs={fsWithTwo} onFsChange={onFsChange} />)

    fireEvent.doubleClick(gridItem('Pictures'))
    fireEvent.click(gridItem('avatar.png'))
    fireEvent.click(screen.getByRole('button', { name: /Rename/ }))

    const input = screen.getByDisplayValue('avatar.png')
    fireEvent.change(input, { target: { value: 'avatar2.png' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onFsChange).not.toHaveBeenCalled()
    expect(screen.getByText(/already exists here/)).toBeInTheDocument()
  })
})
