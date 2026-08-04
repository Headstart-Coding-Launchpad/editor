import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ImageViewerApp from '../ImageViewerApp.jsx'
import { makeDefaultDesktop } from '../../../desktopState.js'

const fs = {
  '/': { type: 'dir' },
  '/a.png': { type: 'file', content: '', src: 'a.png' },
  '/b.png': { type: 'file', content: '', src: 'b.png' },
  '/notes.txt': { type: 'file', content: 'not an image' },
}

function setup(filePath) {
  let state = makeDefaultDesktop(['imageViewer'])
  state = { ...state, fs }
  const win = { ...state.windows[0], filePath }
  state = { ...state, windows: [win] }
  const onStateChange = vi.fn()
  const onInteraction = vi.fn()
  render(<ImageViewerApp win={win} state={state} onStateChange={onStateChange} disabled={false} onInteraction={onInteraction} assetsPath="/assets" assets={['a.png', 'b.png']} />)
  return { state, win, onStateChange, onInteraction }
}

describe('ImageViewerApp', () => {
  it('shows an empty state with an Open button when no file is loaded', () => {
    setup(null)
    expect(screen.getByText('No image open')).toBeInTheDocument()
  })

  it('shows the current file name and enables Prev/Next when siblings exist', () => {
    setup('/a.png')
    expect(screen.getByText('a.png')).toBeInTheDocument()
    expect(screen.getByText('Next ▶')).not.toBeDisabled()
  })

  it('Next cycles to the next sibling image and reports it via onInteraction', () => {
    const { onStateChange, onInteraction } = setup('/a.png')
    fireEvent.click(screen.getByText('Next ▶'))
    const nextState = onStateChange.mock.calls[0][0]
    expect(nextState.windows[0].filePath).toBe('/b.png')
    expect(onInteraction).toHaveBeenCalledWith({ currentDir: '/', openFile: '/b.png' })
  })

  it('zoom controls change the displayed percentage', () => {
    setup('/a.png')
    expect(screen.getByText('100%')).toBeInTheDocument()
    fireEvent.click(screen.getByText('+'))
    expect(screen.getByText('125%')).toBeInTheDocument()
  })
})
