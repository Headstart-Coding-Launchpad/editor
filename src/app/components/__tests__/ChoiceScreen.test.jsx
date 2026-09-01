import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import ChoiceScreen from '../ChoiceScreen'

describe('ChoiceScreen', () => {
  it('renders the lesson title', () => {
    render(<ChoiceScreen lessonTitle="Intro to Python" onJoinLive={vi.fn()} onGoSolo={vi.fn()} />)
    expect(screen.getByText('Intro to Python')).toBeInTheDocument()
  })

  it('renders the lesson description when provided', () => {
    render(<ChoiceScreen lessonTitle="Lesson" lessonDescription="Learn the basics." onJoinLive={vi.fn()} onGoSolo={vi.fn()} />)
    expect(screen.getByText('Learn the basics.')).toBeInTheDocument()
  })

  it('does not render description element when lessonDescription is absent', () => {
    render(<ChoiceScreen lessonTitle="Lesson" onJoinLive={vi.fn()} onGoSolo={vi.fn()} />)
    expect(screen.queryByText(/Learn the basics/)).not.toBeInTheDocument()
  })

  it('renders both the Wait for Teacher and Start Solo buttons', () => {
    render(<ChoiceScreen lessonTitle="Lesson" onJoinLive={vi.fn()} onGoSolo={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Wait for Teacher' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start Solo' })).toBeInTheDocument()
  })

  it('calls onJoinLive when Wait for Teacher is clicked', async () => {
    const user = userEvent.setup()
    const onJoinLive = vi.fn()
    render(<ChoiceScreen lessonTitle="Lesson" onJoinLive={onJoinLive} onGoSolo={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Wait for Teacher' }))
    expect(onJoinLive).toHaveBeenCalledOnce()
  })

  it('calls onGoSolo when Start Solo is clicked', async () => {
    const user = userEvent.setup()
    const onGoSolo = vi.fn()
    render(<ChoiceScreen lessonTitle="Lesson" onJoinLive={vi.fn()} onGoSolo={onGoSolo} />)
    await user.click(screen.getByRole('button', { name: 'Start Solo' }))
    expect(onGoSolo).toHaveBeenCalledOnce()
  })
})
