import React from 'react'
import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import WaitingRoom from '../WaitingRoom'

afterEach(() => vi.useRealTimers())

describe('WaitingRoom', () => {
  it('renders the lesson title', () => {
    render(<WaitingRoom lessonTitle="Intro to Python" />)
    expect(screen.getByRole('heading', { name: 'Intro to Python' })).toBeInTheDocument()
  })

  it('renders the lesson description when provided', () => {
    render(<WaitingRoom lessonTitle="Lesson" lessonDescription="Learn the basics." />)
    expect(screen.getByText('Learn the basics.')).toBeInTheDocument()
  })

  it('does not render description element when lessonDescription is absent', () => {
    render(<WaitingRoom lessonTitle="Lesson" />)
    expect(screen.queryByText(/Learn the basics/)).not.toBeInTheDocument()
  })

  it('shows the initial waiting message with one dot', () => {
    vi.useFakeTimers()
    render(<WaitingRoom lessonTitle="Lesson" />)
    expect(screen.getByText('Your teacher is getting ready.')).toBeInTheDocument()
  })

  it('advances the dot animation after each interval', () => {
    vi.useFakeTimers()
    render(<WaitingRoom lessonTitle="Lesson" />)
    act(() => { vi.advanceTimersByTime(600) })
    expect(screen.getByText('Your teacher is getting ready..')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(600) })
    expect(screen.getByText('Your teacher is getting ready...')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(600) })
    expect(screen.getByText('Your teacher is getting ready.')).toBeInTheDocument()
  })

  it('renders the sit-tight sub-message', () => {
    render(<WaitingRoom lessonTitle="Lesson" />)
    expect(screen.getByText(/Sit tight/)).toBeInTheDocument()
  })

  it('shows the Headstart Coding branding', () => {
    render(<WaitingRoom lessonTitle="Lesson" />)
    expect(screen.getByText('Headstart Coding - LaunchPad')).toBeInTheDocument()
  })

  describe('video call link', () => {
    it('does not render a video call section when videoCallLink is absent', () => {
      render(<WaitingRoom lessonTitle="Lesson" />)
      expect(screen.queryByRole('link', { name: /Join Video Call/ })).not.toBeInTheDocument()
    })

    it('renders a Join Video Call link when videoCallLink is provided', () => {
      render(<WaitingRoom lessonTitle="Lesson" videoCallLink="https://zoom.us/j/123" />)
      const link = screen.getByRole('link', { name: /Join Video Call/ })
      expect(link).toHaveAttribute('href', 'https://zoom.us/j/123')
    })
  })
})
