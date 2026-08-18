import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import FilesystemTask, { imagePreviewSrc } from '../FilesystemTask'

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
})

describe('imagePreviewSrc', () => {
  it('prefers an authored asset src over inline content', () => {
    const entry = { type: 'file', src: 'avatar.png', content: 'data:image/png;base64,AAAA' }
    expect(imagePreviewSrc('/avatar.png', entry, 'https://assets.example/', [])).toBe('https://assets.example/avatar.png')
  })

  it('resolves a matching lesson asset by name', () => {
    const entry = { type: 'file' }
    expect(imagePreviewSrc('/Pictures/avatar.png', entry, 'https://assets.example/', ['avatar.png'])).toBe('https://assets.example/avatar.png')
  })

  it('falls back to an inline data: URL (e.g. a Paint drawing) when there is no asset', () => {
    const entry = { type: 'file', content: 'data:image/png;base64,AAAA' }
    expect(imagePreviewSrc('/drawing.png', entry, '', [])).toBe('data:image/png;base64,AAAA')
  })

  it('returns empty string when there is no src, no matching asset, and no data: content', () => {
    const entry = { type: 'file', content: 'not an image' }
    expect(imagePreviewSrc('/drawing.png', entry, '', [])).toBe('')
  })
})
