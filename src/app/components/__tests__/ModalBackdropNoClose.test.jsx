import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import MustSeeSkipDialog from '../MustSeeSkipDialog.jsx'
import TeacherEndSessionModal from '../TeacherEndSessionModal'
import { OverrideFailModal } from '../student-modal/OverrideDropdown.jsx'

// Ryan 5 Nov: pop-ups close only from their own exit button (or Escape), never from a stray click
// on the dimmed area around them.
describe('modals ignore backdrop clicks', () => {
  it('MustSeeSkipDialog: backdrop does nothing; Cancel and Escape close', () => {
    const onClose = vi.fn()
    render(
      <MustSeeSkipDialog taskTitle="T" onGoToIt={() => {}} onSkip={() => {}} onClose={onClose} />
    )
    const backdrop = screen.getByTestId('must-see-skip-dialog')
    fireEvent.click(backdrop)
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(backdrop, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('TeacherEndSessionModal: backdrop does nothing; Cancel closes', () => {
    const onClose = vi.fn()
    render(<TeacherEndSessionModal onClose={onClose} onEnd={() => {}} onEndAndGoHome={() => {}} />)
    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('OverrideFailModal: backdrop does nothing; Close closes', () => {
    const onCancel = vi.fn()
    const { container } = render(<OverrideFailModal onApply={() => {}} onCancel={onCancel} />)
    fireEvent.click(container.firstChild)
    expect(onCancel).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
