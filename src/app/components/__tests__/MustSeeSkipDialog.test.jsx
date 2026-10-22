import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import MustSeeSkipDialog from '../MustSeeSkipDialog.jsx'

describe('MustSeeSkipDialog', () => {
  it('names the task and offers Go to it and Skip anyway', () => {
    const onGoToIt = vi.fn()
    const onSkip = vi.fn()
    render(
      <MustSeeSkipDialog
        taskTitle="See the error"
        onGoToIt={onGoToIt}
        onSkip={onSkip}
        onClose={() => {}}
      />
    )
    expect(screen.getByRole('dialog')).toHaveTextContent('Skip “See the error”?')
    expect(screen.getByText(/marked must-see/)).toBeTruthy()
    fireEvent.click(screen.getByText('Go to it'))
    expect(onGoToIt).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByText('Skip anyway'))
    expect(onSkip).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape without skipping', () => {
    const onClose = vi.fn()
    const onSkip = vi.fn()
    render(
      <MustSeeSkipDialog taskTitle="T" onGoToIt={() => {}} onSkip={onSkip} onClose={onClose} />
    )
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
    expect(onSkip).not.toHaveBeenCalled()
  })
})
