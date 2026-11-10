import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RenderErrorBoundary from '../RenderErrorBoundary'

const mocks = vi.hoisted(() => ({ crashing: false }))

function Pane({ text = 'pane ok' }) {
  if (mocks.crashing) throw new Error('boom')
  return <p>{text}</p>
}

describe('RenderErrorBoundary', () => {
  beforeEach(() => {
    mocks.crashing = false
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('renders its children untouched when nothing breaks', () => {
    render(
      <RenderErrorBoundary>
        <Pane />
      </RenderErrorBoundary>
    )
    expect(screen.getByText('pane ok')).toBeInTheDocument()
    expect(screen.queryByTestId('render-error-fallback')).toBeNull()
  })

  it('keeps a sibling outside the boundary on screen', () => {
    mocks.crashing = true
    render(
      <div>
        <p>task card</p>
        <RenderErrorBoundary>
          <Pane />
        </RenderErrorBoundary>
      </div>
    )
    expect(screen.getByText('task card')).toBeInTheDocument()
    expect(screen.getByTestId('render-error-fallback')).toHaveTextContent('Something went wrong.')
    // The child card has exactly one control.
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('promises the code is safe only when the pane is a code pane', () => {
    mocks.crashing = true
    const { unmount } = render(
      <RenderErrorBoundary>
        <Pane />
      </RenderErrorBoundary>
    )
    expect(screen.getByTestId('render-error-fallback')).toHaveTextContent(
      'Something went wrong.Tap to try again.'
    )
    expect(screen.getByTestId('render-error-fallback')).not.toHaveTextContent('Your code is safe')
    unmount()
    render(
      <RenderErrorBoundary codeSafe>
        <Pane />
      </RenderErrorBoundary>
    )
    expect(screen.getByTestId('render-error-fallback')).toHaveTextContent(
      'Tap to try again. Your code is safe 💾'
    )
  })

  it('shows tutors a plain line naming the pane, with the same retry', async () => {
    mocks.crashing = true
    const user = userEvent.setup()
    render(
      <RenderErrorBoundary variant="tutor" label="Mia's card" compact>
        <Pane />
      </RenderErrorBoundary>
    )
    const fallback = screen.getByTestId('render-error-fallback')
    expect(fallback).toHaveTextContent("Mia's card hit an error.")
    expect(fallback).not.toHaveTextContent('Something went wrong.')
    mocks.crashing = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByText('pane ok')).toBeInTheDocument()
  })

  it('clears the error by itself when the reset key changes (another task)', () => {
    mocks.crashing = true
    const { rerender } = render(
      <RenderErrorBoundary resetKey="task-1">
        <Pane />
      </RenderErrorBoundary>
    )
    expect(screen.getByTestId('render-error-fallback')).toBeInTheDocument()
    mocks.crashing = false
    rerender(
      <RenderErrorBoundary resetKey="task-2">
        <Pane text="task 2" />
      </RenderErrorBoundary>
    )
    expect(screen.getByText('task 2')).toBeInTheDocument()
  })

  it('shows the fallback again if the pane breaks again after Try again', async () => {
    mocks.crashing = true
    const user = userEvent.setup()
    render(
      <RenderErrorBoundary>
        <Pane />
      </RenderErrorBoundary>
    )
    await user.click(screen.getByRole('button', { name: 'Try again 🔄' }))
    expect(screen.getByTestId('render-error-fallback')).toBeInTheDocument()
  })
  it('tells onError when the fallback shows and onRecover on Try again (R3 health)', async () => {
    mocks.crashing = true
    const onError = vi.fn()
    const onRecover = vi.fn()
    render(
      <RenderErrorBoundary onError={onError} onRecover={onRecover}>
        <Pane />
      </RenderErrorBoundary>
    )
    expect(onError).toHaveBeenCalledTimes(1)
    mocks.crashing = false
    await userEvent.setup().click(screen.getByRole('button', { name: /Try again/ }))
    expect(onRecover).toHaveBeenCalledTimes(1)
    expect(screen.getByText('pane ok')).toBeInTheDocument()
  })
})
