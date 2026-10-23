import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TutorLiveBanner from '../TutorLiveBanner'

describe('TutorLiveBanner', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('renders nothing when never live', () => {
    render(<TutorLiveBanner active={false} />)
    expect(screen.queryByTestId('tutor-live-banner')).toBeNull()
  })

  it('shows the live message with the task, then an ended note that goes away', () => {
    const { rerender } = render(<TutorLiveBanner active taskLabel="Task 2: Loops" />)
    const text = screen.getByTestId('tutor-live-banner').textContent
    expect(text).toContain('Your tutor is live: watch their screen')
    expect(text).toContain('Task 2: Loops')

    rerender(<TutorLiveBanner active={false} taskLabel="Task 2: Loops" />)
    expect(screen.getByTestId('tutor-live-banner').textContent).toBe(
      'Live has ended, back to your work'
    )
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(screen.queryByTestId('tutor-live-banner')).toBeNull()
  })
})
