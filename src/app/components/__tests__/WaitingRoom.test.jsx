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

  it('says the tutor is getting ready, in fixed words that never show a stray ".."', () => {
    vi.useFakeTimers()
    render(<WaitingRoom lessonTitle="Lesson" />)
    const message = screen.getByText('Your tutor is getting ready')
    expect(message).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(1800)
    })
    expect(message).toHaveTextContent(/^Your tutor is getting ready$/)
    // The live "still waiting" cue is three animated dots, hidden from screen readers.
    const dots = message.querySelector('.activity-dots')
    expect(dots).toHaveAttribute('aria-hidden', 'true')
    expect(dots.children).toHaveLength(3)
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
