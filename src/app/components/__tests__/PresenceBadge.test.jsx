import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import PresenceBadge from '../PresenceBadge'

const ACTIVE = { state: 'active' }

describe('PresenceBadge', () => {
  it('shows Away for a connected student whose window is unfocused', () => {
    render(<PresenceBadge student={{ online: true, windowFocused: false }} session={ACTIVE} />)
    expect(screen.getByText('Away')).toBeInTheDocument()
  })

  it('shows Online, Offline and Waiting as before', () => {
    const { rerender } = render(<PresenceBadge student={{ online: true }} session={ACTIVE} />)
    expect(screen.getByText('Online')).toBeInTheDocument()
    rerender(<PresenceBadge student={{ online: false, windowFocused: false }} session={ACTIVE} />)
    expect(screen.getByText('Offline')).toBeInTheDocument()
    rerender(
      <PresenceBadge
        student={{ online: true, windowFocused: false }}
        session={{ state: 'waiting' }}
      />
    )
    expect(screen.getByText('Waiting')).toBeInTheDocument()
  })

  it('shows Waiting with the real presence on the dot while the session waits', () => {
    const WAITING = { state: 'waiting' }
    const { rerender } = render(<PresenceBadge student={{ online: true }} session={WAITING} />)
    let badge = screen.getByText('Waiting')
    expect(badge).toHaveAttribute('data-presence', 'online')
    expect(badge).toHaveClass('presence-badge--waiting', 'presence-badge--dot-online')
    expect(badge).toHaveAttribute('title', expect.stringContaining('Online'))

    rerender(<PresenceBadge student={{ online: true, windowFocused: false }} session={WAITING} />)
    badge = screen.getByText('Waiting')
    expect(badge).toHaveAttribute('data-presence', 'away')
    expect(badge).toHaveClass('presence-badge--dot-away')

    rerender(<PresenceBadge student={{ online: false }} session={WAITING} />)
    badge = screen.getByText('Waiting')
    expect(badge).toHaveAttribute('data-presence', 'offline')
    expect(badge).toHaveAttribute('title', expect.stringContaining('Offline'))
  })
})
