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
    render(
      <ChoiceScreen
        lessonTitle="Lesson"
        lessonDescription="Learn the basics."
        onJoinLive={vi.fn()}
        onGoSolo={vi.fn()}
      />
    )
    expect(screen.getByText('Learn the basics.')).toBeInTheDocument()
  })

  it('does not render description element when lessonDescription is absent', () => {
    render(<ChoiceScreen lessonTitle="Lesson" onJoinLive={vi.fn()} onGoSolo={vi.fn()} />)
    expect(screen.queryByText(/Learn the basics/)).not.toBeInTheDocument()
  })

  it('renders both the Join Live Lesson and Start Solo buttons', () => {
    render(<ChoiceScreen lessonTitle="Lesson" onJoinLive={vi.fn()} onGoSolo={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Join Live Lesson' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start Solo' })).toBeInTheDocument()
  })

  it('calls onJoinLive when Join Live Lesson is clicked', async () => {
    const user = userEvent.setup()
    const onJoinLive = vi.fn()
    render(<ChoiceScreen lessonTitle="Lesson" onJoinLive={onJoinLive} onGoSolo={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Join Live Lesson' }))
    expect(onJoinLive).toHaveBeenCalledOnce()
  })

  it('calls onGoSolo when Start Solo is clicked', async () => {
    const user = userEvent.setup()
    const onGoSolo = vi.fn()
    render(<ChoiceScreen lessonTitle="Lesson" onJoinLive={vi.fn()} onGoSolo={onGoSolo} />)
    await user.click(screen.getByRole('button', { name: 'Start Solo' }))
    expect(onGoSolo).toHaveBeenCalledOnce()
  })

  it('makes joining live the main (primary) choice and solo the quieter one', () => {
    render(<ChoiceScreen lessonTitle="Lesson" onJoinLive={vi.fn()} onGoSolo={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Join Live Lesson' })).toHaveClass('btn-primary')
    expect(screen.getByRole('button', { name: 'Start Solo' })).toHaveClass('btn-ghost-outline')
  })
})
