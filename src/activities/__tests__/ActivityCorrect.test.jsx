import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ActivityCorrect, { SpinTick } from '../ui/ActivityCorrect.jsx'

describe('ActivityCorrect', () => {
  it('renders "✓ Correct" as a status line with a ✓ that spins once', () => {
    render(<ActivityCorrect />)
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('✓ Correct')
    expect(status).toHaveClass('act-result', 'act-result--pass')
    expect(screen.getByText('✓')).toHaveClass('act-correct-tick', 'motion-spin-once')
  })

  it('takes custom text', () => {
    render(<ActivityCorrect>Well done!</ActivityCorrect>)
    expect(screen.getByRole('status')).toHaveTextContent('✓ Well done!')
  })

  it('exports the spinning tick on its own', () => {
    render(<SpinTick />)
    expect(screen.getByText('✓')).toHaveClass('motion-spin-once')
  })
})
