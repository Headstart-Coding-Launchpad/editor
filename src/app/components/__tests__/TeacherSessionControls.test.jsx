import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
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
})
