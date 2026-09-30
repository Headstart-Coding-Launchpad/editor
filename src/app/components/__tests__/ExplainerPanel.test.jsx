import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ExplainerPanel from '../ExplainerPanel'
import { resetFirstViews } from '../../../shared/motion'

vi.mock('../../../shared/markdown', () => ({
  MarkdownRenderer: ({ content, disableCopy, animateLists }) => (
    <div
      data-testid="markdown"
      data-disable-copy={String(!!disableCopy)}
      data-animate-lists={String(!!animateLists)}
    >
      {content}
    </div>
  ),
}))

describe('ExplainerPanel', () => {
  it('renders the title', () => {
    render(<ExplainerPanel title="Introduction" content="Some content" />)
    expect(screen.getByRole('heading', { name: 'Introduction' })).toBeInTheDocument()
  })

  it('renders content via MarkdownRenderer', () => {
    render(<ExplainerPanel title="Section" content="Hello world" />)
    expect(screen.getByTestId('markdown')).toHaveTextContent('Hello world')
  })

  it('shows the collapse toggle icon when collapsible', () => {
    render(<ExplainerPanel title="Section" content="Content" collapsible />)
    expect(screen.getByText('▲')).toBeInTheDocument()
  })

  it('hides content after clicking the toggle', () => {
    render(<ExplainerPanel title="Section" content="Hidden content" collapsible />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.queryByTestId('markdown')).not.toBeInTheDocument()
  })

  it('shows down arrow when collapsed', () => {
    render(<ExplainerPanel title="Section" content="Content" collapsible />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('▼')).toBeInTheDocument()
  })

  it('restores content after toggling open again', () => {
    render(<ExplainerPanel title="Section" content="Visible again" collapsible />)
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    fireEvent.click(btn)
    expect(screen.getByTestId('markdown')).toBeInTheDocument()
  })

  it('sets aria-expanded false when collapsed', () => {
    render(<ExplainerPanel title="Section" content="Content" collapsible />)
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    expect(btn).toHaveAttribute('aria-expanded', 'false')
  })

  it('always shows content when collapsible is false', () => {
    render(<ExplainerPanel title="Section" content="Always visible" collapsible={false} />)
    expect(screen.getByTestId('markdown')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders without a title when title is omitted and not collapsible', () => {
    render(<ExplainerPanel content="No title" collapsible={false} />)
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(screen.getByTestId('markdown')).toBeInTheDocument()
  })

  it('does not disable copy by default', () => {
    render(<ExplainerPanel title="Section" content="Content" />)
    expect(screen.getByTestId('markdown')).toHaveAttribute('data-disable-copy', 'false')
  })

  it('passes disableCopy through to the markdown renderer', () => {
    render(<ExplainerPanel title="Section" content="Content" disableCopy />)
    expect(screen.getByTestId('markdown')).toHaveAttribute('data-disable-copy', 'true')
  })

  it('reports its open/closed state via onCollapsedChange when collapsible, including the initial open state', () => {
    const onCollapsedChange = vi.fn()
    render(
      <ExplainerPanel
        title="Section"
        content="Content"
        collapsible
        onCollapsedChange={onCollapsedChange}
      />
    )
    expect(onCollapsedChange).toHaveBeenLastCalledWith(false)

    fireEvent.click(screen.getByRole('button'))
    expect(onCollapsedChange).toHaveBeenLastCalledWith(true)

    fireEvent.click(screen.getByRole('button'))
    expect(onCollapsedChange).toHaveBeenLastCalledWith(false)
  })

  it('does not call onCollapsedChange when not collapsible (e.g. the side-explainer layout)', () => {
    const onCollapsedChange = vi.fn()
    render(
      <ExplainerPanel
        title="Section"
        content="Content"
        collapsible={false}
        onCollapsedChange={onCollapsedChange}
      />
    )
    expect(onCollapsedChange).not.toHaveBeenCalled()
  })
})

describe('ExplainerPanel first-view entrance', () => {
  beforeEach(() => resetFirstViews())

  function panelOf(container) {
    return container.querySelector('.card')
  }

  it("drops in and slides its bullets in on the task's first view", () => {
    const { container } = render(
      <ExplainerPanel title="Section" content="- one" entranceKey="lesson-1:task-1" />
    )
    expect(panelOf(container)).toHaveClass('motion-drop-in')
    expect(screen.getByTestId('markdown')).toHaveAttribute('data-animate-lists', 'true')
  })

  it('does not replay on a revisit or remount of the same task', () => {
    const first = render(
      <ExplainerPanel title="Section" content="- one" entranceKey="lesson-1:task-1" />
    )
    first.unmount()
    const { container } = render(
      <ExplainerPanel title="Section" content="- one" entranceKey="lesson-1:task-1" />
    )
    expect(panelOf(container)).not.toHaveClass('motion-drop-in')
    expect(screen.getByTestId('markdown')).toHaveAttribute('data-animate-lists', 'false')
  })

  it('never animates without an entrance key', () => {
    const { container } = render(<ExplainerPanel title="Section" content="- one" />)
    expect(panelOf(container)).not.toHaveClass('motion-drop-in')
    expect(screen.getByTestId('markdown')).toHaveAttribute('data-animate-lists', 'false')
  })

  it('does not replay when the panel is collapsed and opened again', () => {
    const { container } = render(
      <ExplainerPanel title="Section" content="- one" collapsible entranceKey="lesson-1:task-1" />
    )
    const toggle = screen.getByRole('button')
    fireEvent.click(toggle)
    fireEvent.click(toggle)
    expect(panelOf(container)).not.toHaveClass('motion-drop-in')
    expect(screen.getByTestId('markdown')).toHaveAttribute('data-animate-lists', 'false')
  })

  it("does not replay when the same task's content is edited (the Builder)", () => {
    const { container, rerender } = render(
      <ExplainerPanel title="Section" content="- one" entranceKey="lesson-1:task-1" />
    )
    rerender(
      <ExplainerPanel title="Section" content={'- one\n- two'} entranceKey="lesson-1:task-1" />
    )
    expect(panelOf(container)).not.toHaveClass('motion-drop-in')
    expect(screen.getByTestId('markdown')).toHaveAttribute('data-animate-lists', 'false')
  })

  it('plays again when a panel that stays mounted moves to an unseen task', () => {
    const { container, rerender } = render(
      <ExplainerPanel title="Task 1" content="- one" entranceKey="lesson-1:task-1" />
    )
    rerender(<ExplainerPanel title="Task 2" content="- two" entranceKey="lesson-1:task-2" />)
    expect(panelOf(container)).toHaveClass('motion-drop-in')
    expect(screen.getByTestId('markdown')).toHaveAttribute('data-animate-lists', 'true')
  })

  it('keeps the entrance when content arrives into an empty panel', () => {
    const { container, rerender } = render(
      <ExplainerPanel title="Section" content="" entranceKey="lesson-1:task-1" />
    )
    rerender(<ExplainerPanel title="Section" content="- one" entranceKey="lesson-1:task-1" />)
    expect(panelOf(container)).toHaveClass('motion-drop-in')
  })
})
