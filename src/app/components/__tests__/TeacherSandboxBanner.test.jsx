import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TeacherSandboxBanner from '../TeacherSandboxBanner'

function renderBanner(overrides = {}) {
  const props = {
    staging: true,
    onCancel: vi.fn(),
    onReset: vi.fn(),
    onGoLive: vi.fn(),
    onPush: vi.fn(),
    onDeactivate: vi.fn(),
    sandboxExplainer: '',
    onPushExplainer: vi.fn(),
    ...overrides,
  }
  render(<TeacherSandboxBanner {...props} />)
  return props
}

describe('TeacherSandboxBanner — staging mode', () => {
  it('shows staging message', () => {
    renderBanner({ staging: true })
    expect(screen.getByText(/Sandbox preview — students are still on the lesson/)).toBeInTheDocument()
  })

  it('renders Cancel, Reset and Go Live buttons', () => {
    renderBanner({ staging: true })
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reset to Sandbox Starter' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Go Live/i })).toBeInTheDocument()
  })

  it('does not render Deactivate, Push to All or explainer in staging mode', () => {
    renderBanner({ staging: true })
    expect(screen.queryByRole('button', { name: 'Deactivate Sandbox' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Push to All' })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('calls onCancel, onReset and onGoLive', () => {
    const props = renderBanner({ staging: true })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reset to Sandbox Starter' }))
    fireEvent.click(screen.getByRole('button', { name: /Go Live/i }))
    expect(props.onCancel).toHaveBeenCalledOnce()
    expect(props.onReset).toHaveBeenCalledOnce()
    expect(props.onGoLive).toHaveBeenCalledOnce()
  })
})

describe('TeacherSandboxBanner — live mode', () => {
  it('shows live message', () => {
    renderBanner({ staging: false })
    expect(screen.getByText(/Sandbox is LIVE/)).toBeInTheDocument()
  })

  it('renders Push to All, Reset and Deactivate buttons for all lesson types', () => {
    renderBanner({ staging: false })
    expect(screen.getByRole('button', { name: 'Push to All' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reset to Sandbox Starter' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Deactivate Sandbox' })).toBeInTheDocument()
  })

  it('calls onPush, onReset and onDeactivate', () => {
    const props = renderBanner({ staging: false })
    fireEvent.click(screen.getByRole('button', { name: 'Push to All' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reset to Sandbox Starter' }))
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate Sandbox' }))
    expect(props.onPush).toHaveBeenCalledOnce()
    expect(props.onReset).toHaveBeenCalledOnce()
    expect(props.onDeactivate).toHaveBeenCalledOnce()
  })

  it('renders explainer textarea and Push Explainer button', () => {
    renderBanner({ staging: false })
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Push Explainer' })).toBeInTheDocument()
  })

  it('calls onPushExplainer with typed text', () => {
    const props = renderBanner({ staging: false })
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Try printing a list!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Push Explainer' }))
    expect(props.onPushExplainer).toHaveBeenCalledWith('Try printing a list!')
  })
})
