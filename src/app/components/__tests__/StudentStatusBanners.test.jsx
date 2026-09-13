import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import StudentStatusBanners from '../StudentStatusBanners'

describe('StudentStatusBanners — cross-tab conflict', () => {
  it('shows a dismissible warning when the lesson is open in another tab', () => {
    const onDismissOtherTab = vi.fn()
    render(<StudentStatusBanners otherTabOpen onDismissOtherTab={onDismissOtherTab} />)

    expect(screen.getByText(/open in another tab/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(onDismissOtherTab).toHaveBeenCalledOnce()
  })

  it('does not show the warning when no other tab is open', () => {
    render(<StudentStatusBanners otherTabOpen={false} />)
    expect(screen.queryByText(/open in another tab/i)).not.toBeInTheDocument()
  })
})
