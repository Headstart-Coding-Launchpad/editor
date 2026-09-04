import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SessionEndedScreen from '../SessionEndedScreen'

describe('SessionEndedScreen', () => {
  it('offers an explicit all-code backup when Python tasks were saved', () => {
    const onDownloadAllCode = vi.fn()
    render(
      <SessionEndedScreen
        savedCodeTaskCount={2}
        onDownloadAllCode={onDownloadAllCode}
        onContinueSolo={vi.fn()}
      />
    )

    expect(screen.getByText(/saved only on this device/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /download all my code/i }))
    expect(onDownloadAllCode).toHaveBeenCalledOnce()
  })

  it('does not show a code download prompt when no Python code was saved', () => {
    render(<SessionEndedScreen onContinueSolo={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /download all my code/i })).not.toBeInTheDocument()
  })

  it('shows a non-downloadable saved-work notice for other module types, without a download button', () => {
    render(<SessionEndedScreen savedOtherTaskCount={3} onContinueSolo={vi.fn()} />)

    expect(screen.getByText(/saved only on this device/i)).toBeInTheDocument()
    expect(
      screen.getByText(/3 other tasks are saved locally too, but isn't downloadable yet/i)
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /download all my code/i })).not.toBeInTheDocument()
  })

  it('shows neither notice when nothing was saved in either category', () => {
    render(<SessionEndedScreen onContinueSolo={vi.fn()} />)
    expect(screen.queryByText(/saved only on this device/i)).not.toBeInTheDocument()
  })
})
