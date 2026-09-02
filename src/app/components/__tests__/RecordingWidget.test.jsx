import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import RecordingWidget from '../RecordingWidget'

class MockPlayer {
  constructor(el, opts) {
    this.el = el
    this.opts = opts
    this.pauseVideo = vi.fn()
    this.playVideo = vi.fn()
    this.destroy = vi.fn()
    MockPlayer.instances.push(this)
  }
}
MockPlayer.instances = []

beforeEach(() => {
  MockPlayer.instances = []
  window.YT = { Player: MockPlayer }
})

afterEach(() => {
  delete window.YT
})

describe('RecordingWidget', () => {
  it('renders nothing when recordingUrl is missing or not a YouTube link', () => {
    const { container: a } = render(<RecordingWidget recordingUrl={null} />)
    expect(a).toBeEmptyDOMElement()

    const { container: b } = render(<RecordingWidget recordingUrl="https://drive.google.com/file/d/abc/view" />)
    expect(b).toBeEmptyDOMElement()
  })

  it('creates a YouTube player for a valid link and shows it by default', async () => {
    render(<RecordingWidget recordingUrl="https://youtu.be/dQw4w9WgXcQ" />)
    await waitFor(() => expect(MockPlayer.instances).toHaveLength(1))
    expect(MockPlayer.instances[0].opts.videoId).toBe('dQw4w9WgXcQ')
    expect(screen.getByText('Class recording')).toBeInTheDocument()
    expect(screen.queryByText('▶ Watch recording')).not.toBeInTheDocument()
  })

  it('pauses and hides on Hide, then resumes and reshows on reopen', async () => {
    const user = userEvent.setup()
    render(<RecordingWidget recordingUrl="https://youtu.be/dQw4w9WgXcQ" />)
    await waitFor(() => expect(MockPlayer.instances).toHaveLength(1))
    const player = MockPlayer.instances[0]

    await user.click(screen.getByRole('button', { name: 'Hide recording' }))
    expect(player.pauseVideo).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: '▶ Watch recording' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '▶ Watch recording' }))
    expect(player.playVideo).toHaveBeenCalledOnce()
    expect(screen.getByText('Class recording')).toBeInTheDocument()
  })

  it('toggles between the small and expanded panel width', async () => {
    const user = userEvent.setup()
    render(<RecordingWidget recordingUrl="https://youtu.be/dQw4w9WgXcQ" />)
    await waitFor(() => expect(MockPlayer.instances).toHaveLength(1))

    const panel = screen.getByText('Class recording').closest('div').parentElement
    expect(panel).toHaveStyle({ width: '320px' })

    await user.click(screen.getByRole('button', { name: 'Make video bigger' }))
    expect(panel).toHaveStyle({ width: '50vw' })

    await user.click(screen.getByRole('button', { name: 'Make video smaller' }))
    expect(panel).toHaveStyle({ width: '320px' })
  })
})
