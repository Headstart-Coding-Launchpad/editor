import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TeacherTimers, { formatClock } from '../TeacherTimers'

afterEach(() => {
  vi.useRealTimers()
})

describe('formatClock', () => {
  it('formats short and hour-long durations', () => {
    expect(formatClock(125)).toBe('2:05')
    expect(formatClock(3725)).toBe('1:02:05')
  })
})

describe('TeacherTimers', () => {
  it('shows elapsed lesson time, planned total, and task remaining time', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_130_000)
    render(
      <TeacherTimers
        session={{ state: 'active', startedAt: 1_000_000, currentTaskStartedAt: 1_000_000 }}
        task={{ id: 1, estimatedMinutes: 5 }}
        tasks={[
          { id: 1, estimatedMinutes: 5 },
          { id: 2, estimatedMinutes: 10 },
        ]}
      />
    )

    expect(screen.getByText('2:10')).toBeInTheDocument()
    expect(screen.getByText('planned 15 min')).toBeInTheDocument()
    expect(screen.getByText('2:50')).toBeInTheDocument()
  })

  it('flashes a task timer after the estimate has expired', () => {
    vi.useFakeTimers()
    vi.setSystemTime(2_000_000)
    const { container } = render(
      <TeacherTimers
        session={{ state: 'active', startedAt: 2_000_000, currentTaskStartedAt: 2_000_000 }}
        task={{ id: 1, estimatedMinutes: 1 }}
        tasks={[{ id: 1, estimatedMinutes: 1 }]}
      />
    )

    act(() => {
      vi.advanceTimersByTime(61_000)
    })

    expect(screen.getByText('Time up')).toBeInTheDocument()
    expect(container.querySelector('.teacher-timer-card--expired')).toBeInTheDocument()
  })

  it('keeps lesson elapsed visible without a countdown in sandbox mode', () => {
    vi.useFakeTimers()
    vi.setSystemTime(3_030_000)
    render(
      <TeacherTimers
        session={{ state: 'sandbox', startedAt: 3_000_000, currentTaskStartedAt: 3_000_000 }}
        task={{ id: 1, estimatedMinutes: 5 }}
        tasks={[{ id: 1, estimatedMinutes: 5 }]}
      />
    )

    expect(screen.getByText('0:30')).toBeInTheDocument()
    expect(screen.queryByText('Task time')).not.toBeInTheDocument()
  })
})
