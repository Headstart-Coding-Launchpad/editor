import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TaskRatingPanel from '../TaskRatingPanel'

describe('TaskRatingPanel', () => {
  it('starts collapsed with no rating shown', () => {
    render(<TaskRatingPanel taskId={1} taskTitle="Task One" existingRating={null} onSave={vi.fn()} />)
    expect(screen.getByText('Rate This Task — Task One')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Rated \d out of 5 stars/)).not.toBeInTheDocument()
    expect(screen.queryByText("How's this task going?")).not.toBeInTheDocument()
  })

  it('shows the existing rating in the collapsed header', () => {
    render(
      <TaskRatingPanel
        taskId={1}
        taskTitle="Task One"
        existingRating={{ rating: 4, whatWorkedWell: '', whatDidntWork: '' }}
        onSave={vi.fn()}
      />
    )
    expect(screen.getByLabelText('Rated 4 out of 5 stars')).toBeInTheDocument()
  })

  it('expands to reveal the rating form and saves the entered values', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<TaskRatingPanel taskId={1} taskTitle="Task One" existingRating={null} onSave={onSave} />)

    fireEvent.click(screen.getByText('Rate This Task — Task One'))
    fireEvent.click(screen.getByRole('radio', { name: '3 stars' }))
    fireEvent.change(screen.getByLabelText('What worked well?'), {
      target: { value: 'Went smoothly' },
    })
    fireEvent.change(screen.getByLabelText("What didn't work, or was broken?"), {
      target: { value: 'Check was flaky' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save Rating' }))

    expect(onSave).toHaveBeenCalledWith(1, {
      rating: 3,
      whatWorkedWell: 'Went smoothly',
      whatDidntWork: 'Check was flaky',
    })
  })

  it('keeps the header pinned to the top of the scroll area once expanded', () => {
    render(<TaskRatingPanel taskId={1} taskTitle="Task One" existingRating={null} onSave={vi.fn()} />)

    const header = screen.getByText('Rate This Task — Task One').closest('button')
    // Sticky (not just scrolled-into-view) so the header can't be pushed out of
    // view by its own body expanding below it, no matter where the teacher had
    // scrolled TeacherView's <main> before opening this panel.
    expect(header).toHaveStyle({ position: 'sticky', top: '0px' })

    fireEvent.click(header)
    expect(header).toHaveStyle({ position: 'sticky', top: '0px' })
  })

  it('resets the form to the new task\'s rating when taskId changes', () => {
    const { rerender } = render(
      <TaskRatingPanel
        taskId={1}
        taskTitle="Task One"
        existingRating={{ rating: 5, whatWorkedWell: '', whatDidntWork: '' }}
        onSave={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText(/Task One/))
    expect(screen.getByRole('radio', { name: '5 stars', checked: true })).toBeInTheDocument()

    rerender(
      <TaskRatingPanel taskId={2} taskTitle="Task Two" existingRating={null} onSave={vi.fn()} />
    )
    // Panel stays expanded across the task switch (same component instance); the
    // form fields reset to the new task's (empty) rating via the taskId effect.
    expect(screen.getByRole('radio', { name: '5 stars', checked: false })).toBeInTheDocument()
  })
})
