import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ExplainerPanel from '../ExplainerPanel'

vi.mock('../../../shared/markdown', () => ({
  MarkdownRenderer: ({ content, disableCopy }) => (
    <div data-testid="markdown" data-disable-copy={String(!!disableCopy)}>
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
