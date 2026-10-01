import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../nudgeAlert', () => ({ playBadgeChime: vi.fn() }))

import ThumbsUpToast from '../ThumbsUpToast'
import useThumbsUp, { THUMBS_UP_VISIBLE_MS } from '../../hooks/useThumbsUp'

function Harness({ pushedAt }) {
  const { thumbsUpAt } = useThumbsUp({ ready: true, enabled: true, pushedAt })
  return <ThumbsUpToast shownAt={thumbsUpAt} />
}

describe('ThumbsUpToast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders nothing without a 👍', () => {
    const { container } = render(<ThumbsUpToast shownAt={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('pops in as a polite, non-blocking status with no button', () => {
    render(<ThumbsUpToast shownAt={1000} />)
    const toast = screen.getByRole('status')
    expect(toast).toHaveTextContent("You're on the right track!")
    expect(toast).toHaveClass('motion-pop-in')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('appears on a new push and auto-dismisses', () => {
    const { rerender } = render(<Harness pushedAt={null} />)
    expect(screen.queryByTestId('thumbs-up-toast')).not.toBeInTheDocument()
    rerender(<Harness pushedAt={1_000_000} />)
    expect(screen.getByTestId('thumbs-up-toast')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(THUMBS_UP_VISIBLE_MS))
    expect(screen.queryByTestId('thumbs-up-toast')).not.toBeInTheDocument()
  })
})
