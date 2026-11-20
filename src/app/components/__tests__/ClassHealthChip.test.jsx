import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ClassHealthChip from '../ClassHealthChip'

const NOW = 9_000_000

function beacon(overrides = {}) {
  return {
    appVersion: '1.0.985',
    pythonStatus: 'ready',
    pythonLoadMs: 3000,
    errorCount: 0,
    connectionDrops: 0,
    updatedAt: NOW - 12_000,
    ...overrides,
  }
}

function student(id, name, healthBeacon, extra = {}) {
  return { anonymousId: id, displayName: name, online: true, healthBeacon, ...extra }
}

function renderChip(students, overrides = {}) {
  const props = {
    students,
    appVersion: '1.0.985',
    onOpenStudent: vi.fn(),
    onNudgeStudent: vi.fn(),
    ...overrides,
  }
  render(<ClassHealthChip {...props} />)
  return props
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ClassHealthChip (Fun moment: the tutor sees whose screen is breaking)', () => {
  it('is green when every screen is fine', () => {
    renderChip([student('a', 'Amy', beacon()), student('b', 'Ben', beacon())])
    const chip = screen.getByRole('button', { name: /class health/i })
    expect(chip).toHaveAttribute('data-level', 'ok')
    expect(within(chip).queryByTestId('class-health-count')).toBeNull()
  })

  it('turns amber with a count when a student has errors', () => {
    renderChip([
      student('a', 'Amy', beacon()),
      student('h', 'Hana', beacon({ errorCount: 3, lastErrorAt: NOW - 40_000 })),
    ])
    const chip = screen.getByRole('button', { name: /class health/i })
    expect(chip).toHaveAttribute('data-level', 'amber')
    expect(within(chip).getByTestId('class-health-count')).toHaveTextContent('1')
  })

  it('turns red when Python failed to load, and the panel lists who needs a look', () => {
    const props = renderChip([
      student('a', 'Amy', beacon()),
      student('d', 'Dev', beacon({ pythonStatus: 'error' })),
      student('h', 'Hana', beacon({ errorCount: 3, lastErrorAt: NOW - 40_000 })),
      student('i', 'Ivo', beacon({ connectionDrops: 4, lastDropAt: NOW - 60_000, appVersion: '1.0.900' })),
    ])
    const chip = screen.getByRole('button', { name: /class health/i })
    expect(chip).toHaveAttribute('data-level', 'red')
    expect(within(chip).getByTestId('class-health-count')).toHaveTextContent('3')

    fireEvent.click(chip)
    const panel = screen.getByRole('dialog', { name: /class health/i })
    expect(within(panel).getByText('3 of 4 students need a look')).toBeInTheDocument()
    // Red first.
    const names = within(panel)
      .getAllByTestId('class-health-row')
      .map((row) => row.getAttribute('data-student'))
    expect(names).toEqual(['d', 'h', 'i'])
    expect(within(panel).getByText('Python failed to load')).toBeInTheDocument()
    expect(within(panel).getByText('3 errors')).toBeInTheDocument()
    expect(within(panel).getByText('Connection dropped 4 times')).toBeInTheDocument()
    expect(within(panel).getByText(/older version/)).toBeInTheDocument()
    expect(within(panel).getByText('1 student fine')).toBeInTheDocument()
    expect(within(panel).getByText(/3 of 4 match/)).toBeInTheDocument()

    fireEvent.click(within(panel).getByRole('button', { name: "Open Dev's screen" }))
    expect(props.onOpenStudent).toHaveBeenCalledWith('d')
    fireEvent.click(chip)
    fireEvent.click(
      within(screen.getByRole('dialog')).getAllByRole('button', { name: 'Nudge' })[1]
    )
    expect(props.onNudgeStudent).toHaveBeenCalledWith('h')
  })

  it('leaves out offline students and old errors', () => {
    renderChip([
      student('d', 'Dev', beacon({ pythonStatus: 'error' }), { online: false }),
      student('h', 'Hana', beacon({ errorCount: 2, lastErrorAt: NOW - 60 * 60_000 })),
    ])
    expect(screen.getByRole('button', { name: /class health/i })).toHaveAttribute(
      'data-level',
      'ok'
    )
  })

  it("counts the existing screen-health field (Python stuck) when there's no beacon yet", () => {
    renderChip([student('d', 'Dev', undefined, { health: 'python_stuck' })])
    expect(screen.getByRole('button', { name: /class health/i })).toHaveAttribute(
      'data-level',
      'red'
    )
  })
})
