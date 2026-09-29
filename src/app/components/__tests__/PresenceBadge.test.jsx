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
})
