import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import TaskSlideTransition from '../TaskSlideTransition'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('TaskSlideTransition', () => {
  it('renders the entering panel on initial mount', () => {
    render(
      <TaskSlideTransition transitionKey="task-1">
        <span>Task one content</span>
      </TaskSlideTransition>
    )
    expect(screen.getByText('Task one content')).toBeInTheDocument()
  })

  it('renders the new content immediately on key change', () => {
    const { rerender } = render(
      <TaskSlideTransition transitionKey="task-1">
        <span>Task one content</span>
      </TaskSlideTransition>
    )

    rerender(
      <TaskSlideTransition transitionKey="task-2">
        <span>Task two content</span>
      </TaskSlideTransition>
    )

    expect(screen.getByText('Task two content')).toBeInTheDocument()
  })

  it('shows leaving panel until timeout clears it', () => {
    const { rerender } = render(
      <TaskSlideTransition transitionKey="task-1">
        <span>Task one content</span>
      </TaskSlideTransition>
    )

    rerender(
      <TaskSlideTransition transitionKey="task-2">
        <span>Task two content</span>
      </TaskSlideTransition>
    )

    expect(screen.getByText('Task one content')).toBeInTheDocument()
    expect(screen.getByText('Task two content')).toBeInTheDocument()

    act(() => { vi.runAllTimers() })

    expect(screen.queryByText('Task one content')).not.toBeInTheDocument()
    expect(screen.getByText('Task two content')).toBeInTheDocument()
  })

  it('hides leaving panel from accessibility with aria-hidden', () => {
    const { rerender } = render(
      <TaskSlideTransition transitionKey="task-1">
        <span>Task one content</span>
      </TaskSlideTransition>
    )
    rerender(
      <TaskSlideTransition transitionKey="task-2">
        <span>Task two content</span>
      </TaskSlideTransition>
    )
    const leavingPanel = screen.getByText('Task one content').closest('[aria-hidden="true"]')
    expect(leavingPanel).toBeInTheDocument()
  })

  it('applies task-slide-viewport class to the wrapper', () => {
    const { container } = render(
      <TaskSlideTransition transitionKey="task-1">
        <span>Content</span>
      </TaskSlideTransition>
    )
    expect(container.firstChild).toHaveClass('task-slide-viewport')
  })

  it('leaves the entering panel unstyled when panelStyle is omitted (default for every other caller)', () => {
    render(
      <TaskSlideTransition transitionKey="task-1">
        <span>Content</span>
      </TaskSlideTransition>
    )
    const enteringPanel = screen.getByText('Content').closest('.task-slide-panel--entering')
    expect(enteringPanel.style.minHeight).toBe('')
  })

  it('does not show a leaving panel when transitionKey is unchanged', () => {
    const { rerender } = render(
      <TaskSlideTransition transitionKey="task-1">
        <span>Content</span>
      </TaskSlideTransition>
    )
    rerender(
      <TaskSlideTransition transitionKey="task-1">
        <span>Updated content</span>
      </TaskSlideTransition>
    )
    const hiddenPanels = document.querySelectorAll('[aria-hidden="true"]')
    expect(hiddenPanels).toHaveLength(0)
  })
})
