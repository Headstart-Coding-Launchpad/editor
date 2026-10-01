import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ClassCountdownPill from '../ClassCountdownPill'
import ClassCountdownControl from '../ClassCountdownControl'
import TimesUpBanner from '../TimesUpBanner'
import TeacherSessionControls from '../TeacherSessionControls'

const NOW = 3_000_000

function countdownEndingIn(ms) {
  return { startedAt: NOW, endsAt: NOW + ms, durationMs: Math.max(ms, 1) }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('ClassCountdownPill', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  it('renders nothing without a countdown', () => {
    const { container } = render(<ClassCountdownPill countdown={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('counts down in whole seconds', () => {
    render(<ClassCountdownPill countdown={countdownEndingIn(125_000)} />)
    expect(screen.getByRole('timer', { name: 'Time left' })).toHaveTextContent('2:05')
    act(() => vi.advanceTimersByTime(5000))
    expect(screen.getByRole('timer')).toHaveTextContent('2:00')
  })

  it('turns amber in the last minute and reads Time’s up at zero', () => {
    render(<ClassCountdownPill countdown={countdownEndingIn(61_000)} />)
    const pill = screen.getByTestId('class-countdown')
    expect(pill).not.toHaveClass('class-countdown--warning')
    act(() => vi.advanceTimersByTime(2000))
    expect(screen.getByTestId('class-countdown')).toHaveClass('class-countdown--warning')
    act(() => vi.advanceTimersByTime(60_000))
    const expired = screen.getByTestId('class-countdown')
    expect(expired).toHaveClass('class-countdown--expired')
    expect(expired).toHaveTextContent('Time’s up')
  })

  it('uses a large variant on the presentation window', () => {
    render(<ClassCountdownPill countdown={countdownEndingIn(60_000)} variant="presentation" />)
    expect(screen.getByTestId('class-countdown')).toHaveClass('class-countdown--presentation')
  })
})

describe('TimesUpBanner', () => {
  it('renders nothing until shown', () => {
    const { container } = render(<TimesUpBanner shownAt={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('announces politely without blocking the page', () => {
    render(<TimesUpBanner shownAt={123} />)
    const banner = screen.getByTestId('times-up-banner')
    expect(banner).toHaveAttribute('role', 'status')
    expect(banner).toHaveTextContent('Time’s up!')
    expect(banner).toHaveClass('motion-pop-in')
    expect(banner.parentElement).toHaveClass('times-up-banner-wrap')
  })

  it('is larger on the presentation window', () => {
    render(<TimesUpBanner shownAt={123} presentation />)
    expect(screen.getByTestId('times-up-banner')).toHaveClass('times-up-banner--presentation')
  })
})

describe('ClassCountdownControl', () => {
  function renderControl(overrides = {}) {
    const props = {
      countdown: null,
      serverTimeOffset: 0,
      onStart: vi.fn(() => Promise.resolve()),
      onAddTime: vi.fn(() => Promise.resolve()),
      onClear: vi.fn(() => Promise.resolve()),
      ...overrides,
    }
    render(<ClassCountdownControl {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Class countdown' }))
    return props
  }

  it('starts a preset countdown', async () => {
    const props = renderControl()
    fireEvent.click(screen.getByRole('button', { name: '5 min' }))
    await waitFor(() => expect(props.onStart).toHaveBeenCalledWith(5 * 60_000))
  })

  it('starts a custom countdown', async () => {
    const props = renderControl()
    fireEvent.change(screen.getByLabelText('Custom countdown minutes'), {
      target: { value: '3' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    await waitFor(() => expect(props.onStart).toHaveBeenCalledWith(3 * 60_000))
  })

  it('rejects an unusable custom value', async () => {
    const props = renderControl()
    fireEvent.change(screen.getByLabelText('Custom countdown minutes'), {
      target: { value: '0' },
    })
    fireEvent.submit(screen.getByLabelText('Custom countdown minutes').closest('form'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a number of minutes')
    expect(props.onStart).not.toHaveBeenCalled()
  })

  it('adds a minute and stops a running countdown', async () => {
    const props = renderControl({ countdown: { startedAt: 1, endsAt: 2, durationMs: 1 } })
    fireEvent.click(screen.getByRole('button', { name: '+1 min' }))
    await waitFor(() => expect(props.onAddTime).toHaveBeenCalledWith(60_000))
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    await waitFor(() => expect(props.onClear).toHaveBeenCalled())
  })

  it('hides +1 min and Stop when nothing is running', () => {
    renderControl()
    expect(screen.queryByRole('button', { name: '+1 min' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Stop' })).not.toBeInTheDocument()
  })
})

describe('TeacherSessionControls countdown button', () => {
  const baseProps = {
    onOpenPresentationWindow: vi.fn(),
    onOpenFeedback: vi.fn(),
    onOpenReports: vi.fn(),
    onOpenEditLesson: vi.fn(),
    onStartSession: vi.fn(),
    onEndSession: vi.fn(),
    onRestartSession: vi.fn(),
    onReturnToAdmin: vi.fn(),
    onStartClassCountdown: vi.fn(),
    onAddClassCountdownTime: vi.fn(),
    onClearClassCountdown: vi.fn(),
  }

  it('shows the countdown button while the session runs, even in the narrow layout', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 900 })
    render(<TeacherSessionControls {...baseProps} session={{ state: 'active' }} />)
    expect(screen.getByRole('button', { name: 'Class countdown' })).toBeInTheDocument()
  })

  it('hides it before the session starts', () => {
    render(<TeacherSessionControls {...baseProps} session={{ state: 'waiting' }} />)
    expect(screen.queryByRole('button', { name: 'Class countdown' })).not.toBeInTheDocument()
  })
})
