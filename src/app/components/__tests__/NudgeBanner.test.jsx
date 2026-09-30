import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NudgePermissionPrompt } from '../NudgeBanner'

describe('NudgePermissionPrompt', () => {
  const originalNotification = window.Notification

  beforeEach(() => {
    localStorage.clear()
    window.Notification = { permission: 'default', requestPermission: vi.fn(async () => 'denied') }
  })

  afterEach(() => {
    if (originalNotification === undefined) delete window.Notification
    else window.Notification = originalNotification
  })

  it('uses the light-surface button style for "Not now" so it is readable on the white prompt', () => {
    render(<NudgePermissionPrompt />)
    const notNow = screen.getByRole('button', { name: 'Not now' })
    expect(notNow).toHaveClass('btn-ghost-outline')
    expect(notNow).not.toHaveClass('btn-ghost')
  })

  it('hides for good after "Not now"', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<NudgePermissionPrompt />)
    await user.click(screen.getByRole('button', { name: 'Not now' }))
    expect(screen.queryByRole('region', { name: 'Allow notifications' })).not.toBeInTheDocument()
    unmount()
    render(<NudgePermissionPrompt />)
    expect(screen.queryByRole('region', { name: 'Allow notifications' })).not.toBeInTheDocument()
  })
})
