import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ClassCountdownEndedStrip from '../ClassCountdownEndedStrip'

const NOW = 5_000_000

function countdownEndingIn(ms) {
  return { startedAt: NOW - 60_000, endsAt: NOW + ms, durationMs: 60_000 + ms }
}

describe('ClassCountdownEndedStrip', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })
  afterEach(() => vi.useRealTimers())

  it('stays hidden while the countdown runs and appears at zero with three choices', () => {
    const handlers = { onAddMinute: vi.fn(), onClear: vi.fn(), onNextTask: vi.fn() }
    render(<ClassCountdownEndedStrip countdown={countdownEndingIn(3000)} {...handlers} />)
    expect(screen.queryByTestId('countdown-ended-strip')).not.toBeInTheDocument()

    act(() => vi.advanceTimersByTime(3500))
    const strip = screen.getByTestId('countdown-ended-strip')
    expect(strip).toHaveTextContent('Time’s up')
    expect(screen.getByRole('button', { name: '+1 min' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear: stay here' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next task →' })).toBeInTheDocument()
    // Nothing moves by itself.
    act(() => vi.advanceTimersByTime(60_000))
    expect(handlers.onAddMinute).not.toHaveBeenCalled()
    expect(handlers.onClear).not.toHaveBeenCalled()
    expect(handlers.onNextTask).not.toHaveBeenCalled()
  })

  it('runs only the choice clicked', async () => {
    const handlers = { onAddMinute: vi.fn(), onClear: vi.fn(), onNextTask: vi.fn() }
    render(<ClassCountdownEndedStrip countdown={countdownEndingIn(-1000)} {...handlers} />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Clear: stay here' })))
    expect(handlers.onClear).toHaveBeenCalledTimes(1)
    expect(handlers.onNextTask).not.toHaveBeenCalled()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: '+1 min' })))
    expect(handlers.onAddMinute).toHaveBeenCalledTimes(1)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Next task →' })))
    expect(handlers.onNextTask).toHaveBeenCalledTimes(1)
  })

  it('disables Next task on the last task and shows a note', () => {
    render(
      <ClassCountdownEndedStrip
        countdown={countdownEndingIn(-1000)}
        onAddMinute={vi.fn()}
        onClear={vi.fn()}
        onNextTask={null}
        note="Task 6 of 6"
      />
    )
    expect(screen.getByRole('button', { name: 'Next task →' })).toBeDisabled()
    expect(screen.getByTestId('countdown-ended-strip')).toHaveTextContent('Task 6 of 6')
  })

  it('renders nothing without a countdown', () => {
    const { container } = render(<ClassCountdownEndedStrip countdown={null} />)
    expect(container).toBeEmptyDOMElement()
  })
})
