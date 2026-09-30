import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import TaskSlideTransition, {
  TASK_TRANSITION_MS,
  getTaskSlideDirection,
  useIsLeavingTaskSlide,
} from '../TaskSlideTransition'
import { MOTION_MS } from '../../../shared/motion'

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

    act(() => {
      vi.runAllTimers()
    })

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

  it('marks only the leaving panel as leaving via useIsLeavingTaskSlide', () => {
    function Probe({ label }) {
      return <span>{`${label}:${useIsLeavingTaskSlide() ? 'leaving' : 'active'}`}</span>
    }
    const { rerender } = render(
      <TaskSlideTransition transitionKey="task-1">
        <Probe label="one" />
      </TaskSlideTransition>
    )
    expect(screen.getByText('one:active')).toBeInTheDocument()

    rerender(
      <TaskSlideTransition transitionKey="task-2">
        <Probe label="two" />
      </TaskSlideTransition>
    )
    expect(screen.getByText('one:leaving')).toBeInTheDocument()
    expect(screen.getByText('two:active')).toBeInTheDocument()
  })

  function panelOf(text) {
    return screen.getByText(text).closest('.task-slide-panel')
  }

  it('slides forward when moving to a later task', () => {
    const { rerender } = render(
      <TaskSlideTransition transitionKey="task-1" order={0}>
        <span>Task one</span>
      </TaskSlideTransition>
    )
    rerender(
      <TaskSlideTransition transitionKey="task-2" order={1}>
        <span>Task two</span>
      </TaskSlideTransition>
    )
    expect(panelOf('Task two')).toHaveClass(
      'task-slide-panel--entering',
      'task-slide-panel--forward'
    )
    expect(panelOf('Task one')).toHaveClass(
      'task-slide-panel--leaving',
      'task-slide-panel--forward'
    )
  })

  it('slides backward when moving to an earlier task', () => {
    const { rerender } = render(
      <TaskSlideTransition transitionKey="task-3" order={2}>
        <span>Task three</span>
      </TaskSlideTransition>
    )
    rerender(
      <TaskSlideTransition transitionKey="task-1" order={0}>
        <span>Task one</span>
      </TaskSlideTransition>
    )
    expect(panelOf('Task one')).toHaveClass(
      'task-slide-panel--entering',
      'task-slide-panel--backward'
    )
    expect(panelOf('Task three')).toHaveClass(
      'task-slide-panel--leaving',
      'task-slide-panel--backward'
    )
  })

  it('keeps the entering direction after the leaving panel is removed', () => {
    const { rerender } = render(
      <TaskSlideTransition transitionKey="task-2" order={1}>
        <span>Task two</span>
      </TaskSlideTransition>
    )
    rerender(
      <TaskSlideTransition transitionKey="task-1" order={0}>
        <span>Task one</span>
      </TaskSlideTransition>
    )
    act(() => {
      vi.advanceTimersByTime(TASK_TRANSITION_MS)
    })
    expect(screen.queryByText('Task two')).not.toBeInTheDocument()
    // Swapping the class after the animation ends would restart it.
    expect(panelOf('Task one')).toHaveClass('task-slide-panel--backward')
  })

  it('clips the viewport while sliding and restores the caller overflow after', () => {
    const { container, rerender } = render(
      <TaskSlideTransition transitionKey="task-1" order={0} style={{ overflow: 'auto' }}>
        <span>Task one</span>
      </TaskSlideTransition>
    )
    expect(container.firstChild.style.overflow).toBe('hidden')
    act(() => {
      vi.advanceTimersByTime(TASK_TRANSITION_MS)
    })
    expect(container.firstChild.style.overflow).toBe('auto')

    rerender(
      <TaskSlideTransition transitionKey="task-2" order={1} style={{ overflow: 'auto' }}>
        <span>Task two</span>
      </TaskSlideTransition>
    )
    expect(container.firstChild.style.overflow).toBe('hidden')
    act(() => {
      vi.advanceTimersByTime(TASK_TRANSITION_MS)
    })
    expect(container.firstChild.style.overflow).toBe('auto')
  })

  it('times the leaving panel to the slow motion token', () => {
    expect(TASK_TRANSITION_MS).toBe(MOTION_MS.slow)
  })

  it('treats an unknown or equal order as forward', () => {
    expect(getTaskSlideDirection(2, 1)).toBe('backward')
    expect(getTaskSlideDirection(1, 2)).toBe('forward')
    expect(getTaskSlideDirection(1, 1)).toBe('forward')
    expect(getTaskSlideDirection(null, 0)).toBe('forward')
    expect(getTaskSlideDirection(3, undefined)).toBe('forward')
    expect(getTaskSlideDirection(3, null)).toBe('forward')
  })
})
