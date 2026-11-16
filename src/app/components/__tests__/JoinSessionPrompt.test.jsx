import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import JoinSessionPrompt from '../JoinSessionPrompt'

function renderPrompt(overrides = {}) {
  const props = {
    lessonTitle: 'My Lesson',
    onJoin: vi.fn(),
    onDecline: vi.fn(),
    ...overrides,
  }
  render(<JoinSessionPrompt {...props} />)
  return props
}

describe('JoinSessionPrompt', () => {
  it('renders the lesson title', () => {
    renderPrompt({ lessonTitle: 'Intro to Python' })
    expect(screen.getByRole('heading', { name: 'Intro to Python' })).toBeInTheDocument()
  })

  it('shows the live-session started message', () => {
    renderPrompt()
    expect(screen.getByText(/Your teacher has started a live session/)).toBeInTheDocument()
  })

  it('reassures that solo work has been saved', () => {
    renderPrompt()
    expect(screen.getByText(/Your solo work has been saved/)).toBeInTheDocument()
  })

  it('calls onJoin when "Join Session" is clicked', () => {
    const props = renderPrompt()
    fireEvent.click(screen.getByRole('button', { name: 'Join Session' }))
    expect(props.onJoin).toHaveBeenCalledOnce()
  })

  it('calls onDecline when "Continue Solo" is clicked', () => {
    const props = renderPrompt()
    fireEvent.click(screen.getByRole('button', { name: 'Continue Solo' }))
    expect(props.onDecline).toHaveBeenCalledOnce()
  })

  it('renders the Head Start Coding branding', () => {
    renderPrompt()
    expect(screen.getByText('Head Start Coding - LaunchPad')).toBeInTheDocument()
  })
})
