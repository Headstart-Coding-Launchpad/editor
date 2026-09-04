import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TeacherEndSessionModal from '../TeacherEndSessionModal'

function renderModal(overrides = {}) {
  const props = {
    onClose: vi.fn(),
    onEnd: vi.fn(),
    onEndAndGoHome: vi.fn(),
    ...overrides,
  }
  render(<TeacherEndSessionModal {...props} />)
  return props
}

describe('TeacherEndSessionModal', () => {
  it('renders the confirmation heading and message', () => {
    renderModal()
    expect(screen.getByRole('heading', { name: 'End Session?' })).toBeInTheDocument()
    expect(screen.getByText(/end the session for all students/i)).toBeInTheDocument()
  })

  it('calls onClose when Cancel is clicked', () => {
    const props = renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(props.onClose).toHaveBeenCalledOnce()
  })

  it('calls onEnd when End Session is clicked', () => {
    const props = renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'End Session' }))
    expect(props.onEnd).toHaveBeenCalledOnce()
  })

  it('calls onEndAndGoHome when End & Go to Home is clicked', () => {
    const props = renderModal()
    fireEvent.click(screen.getByRole('button', { name: /End.*Go to Home/i }))
    expect(props.onEndAndGoHome).toHaveBeenCalledOnce()
  })

  it('calls onClose when the overlay backdrop is clicked', () => {
    const props = renderModal()
    fireEvent.click(
      screen.getByRole('button', { name: 'Cancel' }).closest('.teacher-end-modal__overlay')
    )
    expect(props.onClose).toHaveBeenCalledOnce()
  })
})
