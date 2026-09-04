import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TeacherSessionControls from '../TeacherSessionControls'

// Simulate a wide desktop viewport so secondary buttons render directly
// rather than being collapsed into the Menu dropdown (threshold: 1300px).
beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1400 })
})

function renderControls(overrides = {}) {
  const props = {
    session: { state: 'active', isPaused: false },
    onOpenPresentationWindow: vi.fn(),
    onOpenFeedback: vi.fn(),
    onOpenReports: vi.fn(),
    onOpenEditLesson: vi.fn(),
    onStartSession: vi.fn(),
    onEndSession: vi.fn(),
    onRestartSession: vi.fn(),
    onReturnToAdmin: vi.fn(),
    ...overrides,
  }
  render(<TeacherSessionControls {...props} />)
  return props
}

describe('TeacherSessionControls', () => {
  it('shows session status and static actions', () => {
    renderControls()

    expect(screen.getByText('Session: active')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Presentation Window' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Admin' })).toBeInTheDocument()
  })

  it('delegates return to admin', () => {
    const props = renderControls()
    fireEvent.click(screen.getByRole('button', { name: 'Admin' }))
    expect(props.onReturnToAdmin).toHaveBeenCalledOnce()
  })

  it('shows waiting-session Start Session button', () => {
    const props = renderControls({ session: { state: 'waiting' } })

    fireEvent.click(screen.getByRole('button', { name: 'Start Session' }))

    expect(props.onStartSession).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: 'End Session' })).not.toBeInTheDocument()
  })

  it('shows active-session End Session and Feedback buttons', () => {
    const props = renderControls({ session: { state: 'active' } })

    expect(screen.getByRole('button', { name: 'Feedback' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'End Session' }))

    expect(props.onEndSession).toHaveBeenCalledOnce()
  })

  it('delegates opening the reports panel', () => {
    const props = renderControls()
    fireEvent.click(screen.getByRole('button', { name: 'Reports' }))
    expect(props.onOpenReports).toHaveBeenCalledOnce()
  })

  it('delegates opening the edit lesson modal', () => {
    const props = renderControls()
    fireEvent.click(screen.getByRole('button', { name: 'Edit Lesson' }))
    expect(props.onOpenEditLesson).toHaveBeenCalledOnce()
  })

  it('shows ended-session Restart Session button', () => {
    const props = renderControls({ session: { state: 'ended' } })

    fireEvent.click(screen.getByRole('button', { name: 'Restart Session' }))

    expect(props.onRestartSession).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: 'End Session' })).not.toBeInTheDocument()
  })

  describe('video call link', () => {
    it('does not show the video call button when onUpdateVideoCallLink is not provided', () => {
      renderControls()
      expect(screen.queryByRole('button', { name: /Video Call/ })).not.toBeInTheDocument()
    })

    it('shows "Add Video Call" when no link is set yet', () => {
      renderControls({ onUpdateVideoCallLink: vi.fn() })
      expect(screen.getByRole('button', { name: '📹 Add Video Call' })).toBeInTheDocument()
    })

    it('shows "Video Call" when a link is already set', () => {
      renderControls({
        session: { state: 'active', videoCallLink: 'https://zoom.us/j/123' },
        onUpdateVideoCallLink: vi.fn(),
      })
      expect(screen.getByRole('button', { name: '📹 Video Call' })).toBeInTheDocument()
    })

    it('saves a new link via onUpdateVideoCallLink', async () => {
      const onUpdateVideoCallLink = vi.fn().mockResolvedValue(undefined)
      renderControls({ onUpdateVideoCallLink })

      fireEvent.click(screen.getByRole('button', { name: '📹 Add Video Call' }))
      fireEvent.change(screen.getByPlaceholderText('https://zoom.us/j/…'), {
        target: { value: 'https://zoom.us/j/123' },
      })
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      await waitFor(() =>
        expect(onUpdateVideoCallLink).toHaveBeenCalledWith('https://zoom.us/j/123')
      )
    })

    it('shows an error message when onUpdateVideoCallLink rejects', async () => {
      const onUpdateVideoCallLink = vi
        .fn()
        .mockRejectedValue(new Error('Video call link must be a valid http(s) URL.'))
      renderControls({ onUpdateVideoCallLink })

      fireEvent.click(screen.getByRole('button', { name: '📹 Add Video Call' }))
      fireEvent.change(screen.getByPlaceholderText('https://zoom.us/j/…'), {
        target: { value: 'not-a-url' },
      })
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      expect(
        await screen.findByText('Video call link must be a valid http(s) URL.')
      ).toBeInTheDocument()
    })

    it('clears the link and saves via onUpdateVideoCallLink', async () => {
      const onUpdateVideoCallLink = vi.fn().mockResolvedValue(undefined)
      renderControls({
        session: { state: 'active', videoCallLink: 'https://zoom.us/j/123' },
        onUpdateVideoCallLink,
      })

      fireEvent.click(screen.getByRole('button', { name: '📹 Video Call' }))
      fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      await waitFor(() => expect(onUpdateVideoCallLink).toHaveBeenCalledWith(''))
    })
  })
})
