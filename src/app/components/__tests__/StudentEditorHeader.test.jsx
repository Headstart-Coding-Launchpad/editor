import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import StudentEditorHeader from '../StudentEditorHeader'

function renderHeader(overrides = {}) {
  const props = {
    task: { interactionMode: 'run' },
    running: false,
    onRun: vi.fn(),
    onSubmit: vi.fn(),
    onReset: vi.fn(),
    ...overrides,
  }
  render(<StudentEditorHeader {...props} />)
  return props
}

describe('StudentEditorHeader', () => {
  describe('run mode (interactionMode = run)', () => {
    it('renders a Run button', () => {
      renderHeader()
      expect(screen.getByRole('button', { name: /run/i })).toBeInTheDocument()
    })

    it('calls onRun when Run is clicked', async () => {
      const { onRun } = renderHeader()
      await userEvent.click(screen.getByRole('button', { name: /run/i }))
      expect(onRun).toHaveBeenCalledTimes(1)
    })

    it('shows Running… and disables the button while running', () => {
      renderHeader({ running: true })
      const btn = screen.getByRole('button', { name: /running/i })
      expect(btn).toBeDisabled()
    })
  })

  describe('submit mode (interactionMode = submit)', () => {
    it('renders a Submit button', () => {
      renderHeader({ task: { interactionMode: 'submit' } })
      expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument()
    })

    it('calls onSubmit when Submit is clicked', async () => {
      const { onSubmit } = renderHeader({ task: { interactionMode: 'submit' } })
      await userEvent.click(screen.getByRole('button', { name: /submit/i }))
      expect(onSubmit).toHaveBeenCalledTimes(1)
    })
  })

  describe('Reset Code button', () => {
    it('renders the Reset Code button', () => {
      renderHeader()
      expect(screen.getByRole('button', { name: /reset code/i })).toBeInTheDocument()
    })

    it('calls onReset when clicked', async () => {
      const { onReset } = renderHeader()
      await userEvent.click(screen.getByRole('button', { name: /reset code/i }))
      expect(onReset).toHaveBeenCalledTimes(1)
    })
  })

  it('renders the Code title label', () => {
    renderHeader()
    expect(screen.getByText('Code')).toBeInTheDocument()
  })

  it('applies the sv-editor-header and ui-tabs classes to the wrapper', () => {
    const { container } = render(
      <StudentEditorHeader
        task={{ interactionMode: 'run' }}
        running={false}
        onRun={vi.fn()}
        onSubmit={vi.fn()}
        onReset={vi.fn()}
      />
    )
    expect(container.firstChild).toHaveClass('sv-editor-header')
    expect(container.firstChild).toHaveClass('ui-tabs')
  })
})
