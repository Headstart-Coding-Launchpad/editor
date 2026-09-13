import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import LessonCompleteScreen from '../LessonCompleteScreen'

describe('LessonCompleteScreen', () => {
  it('shows the lesson title in the completion message', () => {
    render(<LessonCompleteScreen lessonTitle="Intro to Python" />)
    expect(screen.getByText(/Well done finishing Intro to Python/i)).toBeInTheDocument()
  })

  it('offers to replay the lesson when onReplayLesson is provided', () => {
    const onReplayLesson = vi.fn()
    render(<LessonCompleteScreen onReplayLesson={onReplayLesson} />)

    fireEvent.click(screen.getByRole('button', { name: 'Go Through the Lesson Again' }))
    expect(onReplayLesson).toHaveBeenCalledOnce()
  })

  it('does not show the solo challenge or playground buttons when neither is available', () => {
    render(<LessonCompleteScreen onReplayLesson={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /Try the Solo Challenge/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Open Playground/i })).not.toBeInTheDocument()
  })

  it('offers the linked solo challenge when one exists', () => {
    const onTrySoloChallenge = vi.fn()
    render(
      <LessonCompleteScreen
        soloCompanion={{ id: 'py-intro-solo', title: 'Python Challenge' }}
        onTrySoloChallenge={onTrySoloChallenge}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Try the Solo Challenge' }))
    expect(onTrySoloChallenge).toHaveBeenCalledOnce()
  })

  it('does not offer the solo challenge without a matching handler', () => {
    render(<LessonCompleteScreen soloCompanion={{ id: 'py-intro-solo', title: 'Python Challenge' }} />)
    expect(screen.queryByRole('button', { name: /Try the Solo Challenge/i })).not.toBeInTheDocument()
  })

  it('offers the playground when one is available for the lesson type', () => {
    const onOpenPlayground = vi.fn()
    render(<LessonCompleteScreen onOpenPlayground={onOpenPlayground} />)

    fireEvent.click(screen.getByRole('button', { name: 'Open Playground' }))
    expect(onOpenPlayground).toHaveBeenCalledOnce()
  })
})
