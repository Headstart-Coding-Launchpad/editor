import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TeacherPreviewBanner from '../TeacherPreviewBanner'

function renderBanner(overrides = {}) {
  const props = {
    taskNumber: 3,
    taskTitle: 'Variables',
    classTaskNumber: 2,
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
    ...overrides,
  }
  render(<TeacherPreviewBanner {...props} />)
  return props
}

describe('TeacherPreviewBanner', () => {
  it('says which task is previewed and where the class still is', () => {
    renderBanner()
    expect(screen.getByTestId('teacher-preview-banner')).toHaveTextContent(
      'Previewing task 3 · Variables. The class is still on task 2.'
    )
  })

  it('leaves the title out when there is none', () => {
    renderBanner({ taskTitle: undefined })
    expect(screen.getByTestId('teacher-preview-banner')).toHaveTextContent(
      'Previewing task 3. The class is still on task 2.'
    )
  })

  it('calls onCancel when Back is clicked', () => {
    const props = renderBanner()
    fireEvent.click(screen.getByRole('button', { name: 'Back to task 2' }))
    expect(props.onCancel).toHaveBeenCalledOnce()
  })

  it('calls onConfirm when Move class here is clicked', () => {
    const props = renderBanner()
    fireEvent.click(screen.getByRole('button', { name: 'Move class here' }))
    expect(props.onConfirm).toHaveBeenCalledOnce()
  })

  it('says Next still skips a greyed optional task', () => {
    renderBanner({ skippedByNext: true })
    expect(screen.getByTestId('teacher-preview-banner')).toHaveTextContent(
      'Skip optional tasks is on, so Next skips this task'
    )
  })
})
