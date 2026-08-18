import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LiveActivityToast from '../LiveActivityToast'

describe('LiveActivityToast', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('briefly reports a recent clipboard activity', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-26T12:00:00Z'))
    render(<LiveActivityToast activity={{ type: 'copy', at: Date.now() }} />)

    expect(screen.getByRole('status')).toHaveTextContent('Copied text')

    act(() => vi.advanceTimersByTime(1400))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('does not show local click activity when clicks are disabled', () => {
    render(<LiveActivityToast activity={{ type: 'click', at: Date.now() }} showClicks={false} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('does not replay stale activity when a viewer opens', () => {
    render(<LiveActivityToast activity={{ type: 'paste', at: Date.now() - 3000 }} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('reports Scratch block/sprite activity types', () => {
    render(<LiveActivityToast activity={{ type: 'green_flag', at: Date.now() }} />)
    expect(screen.getByRole('status')).toHaveTextContent('Clicked green flag')
  })
})
