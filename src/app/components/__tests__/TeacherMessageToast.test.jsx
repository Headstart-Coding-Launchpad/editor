import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import TeacherMessageToast from '../TeacherMessageToast'

describe('TeacherMessageToast', () => {
  it('shows nothing when no message or pushedAt', () => {
    const { container } = render(<TeacherMessageToast />)
    expect(container.firstChild).toBeNull()
  })

  it('shows nothing when pushedAt is provided but message is empty', () => {
    const { container } = render(<TeacherMessageToast pushedAt={Date.now()} message="" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the message when pushedAt and message are provided', () => {
    render(<TeacherMessageToast message="Nice work!" pushedAt={1000} />)
    expect(screen.getByText('Nice work!')).toBeInTheDocument()
    expect(screen.getByText('Message from your teacher')).toBeInTheDocument()
  })

  it('dismisses when the button is clicked', () => {
    render(<TeacherMessageToast message="Hello!" pushedAt={1000} />)
    expect(screen.getByText('Hello!')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /got it/i }))
    expect(screen.queryByText('Hello!')).not.toBeInTheDocument()
  })

  it('shows a new message when pushedAt changes', () => {
    const { rerender } = render(<TeacherMessageToast message="First" pushedAt={1000} />)
    expect(screen.getByText('First')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /got it/i }))
    expect(screen.queryByText('First')).not.toBeInTheDocument()

    rerender(<TeacherMessageToast message="Second" pushedAt={2000} />)
    expect(screen.getByText('Second')).toBeInTheDocument()
  })
})
