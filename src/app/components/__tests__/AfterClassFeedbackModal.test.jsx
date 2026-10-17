import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AfterClassFeedbackModal from '../AfterClassFeedbackModal'

const report = { lessonTitle: 'Demo Lesson' }
const tasks = [{ taskId: 1, title: 'Task One' }]

describe('AfterClassFeedbackModal', () => {
  it('Skip finishes without saving', () => {
    const onSave = vi.fn()
    const onDone = vi.fn()
    render(
      <AfterClassFeedbackModal report={report} tasks={tasks} onSave={onSave} onDone={onDone} />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    expect(onSave).not.toHaveBeenCalled()
    expect(onDone).toHaveBeenCalledOnce()
  })

  it('saves then finishes', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const onDone = vi.fn()
    render(
      <AfterClassFeedbackModal report={report} tasks={tasks} onSave={onSave} onDone={onDone} />
    )
    fireEvent.click(screen.getByRole('radio', { name: '5 stars' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save and go home' }))
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce())
    expect(onSave).toHaveBeenCalledWith({ rating: 5, whatWorkedWell: '', whatDidntWork: '' }, [])
  })
})
