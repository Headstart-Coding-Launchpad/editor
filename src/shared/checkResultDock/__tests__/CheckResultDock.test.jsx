import React from 'react'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import CheckFeedbackBanner from '../../../app/components/CheckFeedbackBanner'
import { HELP_BUTTON_LABEL } from '../../../app/components/peerHelp/helpLabel'
import { CheckResultDockProvider, CheckResultSlot, useCheckResultWaiting } from '../CheckResultDock'

function Waiting() {
  return <span data-testid="waiting">{String(useCheckResultWaiting())}</span>
}

describe('check result dock', () => {
  it('renders no slot outside a provider', () => {
    render(<CheckResultSlot />)
    expect(screen.queryByTestId('check-result-slot')).not.toBeInTheDocument()
  })

  it('docks the banner inside the output panel slot, not as a floating corner popup', () => {
    render(
      <CheckResultDockProvider>
        <div data-testid="output-panel" style={{ position: 'relative' }}>
          <CheckResultSlot />
        </div>
        <CheckFeedbackBanner passed={false} suggestion="Check your quotes." />
      </CheckResultDockProvider>
    )
    const panel = screen.getByTestId('output-panel')
    const status = screen.getByRole('status')
    expect(panel).toContainElement(status)
    expect(status).toHaveClass('check-feedback-popup--docked')
    expect(status.closest('.check-result-slot')).not.toBeNull()
  })

  it('falls back to the floating popup when no output panel registered a slot', () => {
    render(
      <CheckResultDockProvider>
        <CheckFeedbackBanner passed={false} />
      </CheckResultDockProvider>
    )
    expect(screen.getByRole('status')).not.toHaveClass('check-feedback-popup--docked')
  })

  it('stays docked past the auto-dismiss time until dismissed', async () => {
    vi.useFakeTimers()
    render(
      <CheckResultDockProvider>
        <CheckResultSlot />
        <CheckFeedbackBanner passed />
      </CheckResultDockProvider>
    )
    act(() => {
      vi.advanceTimersByTime(120000)
    })
    expect(screen.getByRole('status')).toBeInTheDocument()
    vi.useRealTimers()
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('reports a waiting result while docked, and clears it on dismiss', async () => {
    render(
      <CheckResultDockProvider>
        <Waiting />
        <CheckResultSlot />
        <CheckFeedbackBanner passed={false} />
      </CheckResultDockProvider>
    )
    expect(screen.getByTestId('waiting')).toHaveTextContent('true')
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.getByTestId('waiting')).toHaveTextContent('false')
  })

  it('names the Help button by its real label', () => {
    render(<CheckFeedbackBanner passed={false} />)
    expect(screen.getByText(new RegExp(`Tap .${HELP_BUTTON_LABEL}.`))).toBeInTheDocument()
    expect(screen.queryByText(/Tap .?Need Help/)).not.toBeInTheDocument()
  })
})
