import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import VideoCallPrompt from '../VideoCallPrompt'

describe('VideoCallPrompt', () => {
  it('renders a Join Video Call link pointing at videoCallLink', () => {
    render(<VideoCallPrompt videoCallLink="https://zoom.us/j/123" onDismiss={vi.fn()} />)
    const link = screen.getByRole('link', { name: /Join Video Call/ })
    expect(link).toHaveAttribute('href', 'https://zoom.us/j/123')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('calls onDismiss when Not now is clicked', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    render(<VideoCallPrompt videoCallLink="https://zoom.us/j/123" onDismiss={onDismiss} />)
    await user.click(screen.getByRole('button', { name: 'Not now' }))
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('calls onDismiss when the Join Video Call link is clicked', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    render(<VideoCallPrompt videoCallLink="https://zoom.us/j/123" onDismiss={onDismiss} />)
    await user.click(screen.getByRole('link', { name: /Join Video Call/ }))
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})
