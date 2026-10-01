import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TaskRatingPanel from '../TaskRatingPanel'

function openPopover() {
  fireEvent.click(screen.getByRole('button', { name: /Rate this task/ }))
  return screen.getByRole('dialog', { name: /Rate this task/ })
}

describe('TaskRatingPanel', () => {
  it('renders a closed "Rate this task" button with no popover', () => {
    render(
      <TaskRatingPanel taskId={1} taskTitle="Task One" existingRating={null} onSave={vi.fn()} />
    )
    const button = screen.getByRole('button', { name: 'Rate this task' })
    expect(button).toHaveTextContent('⭐ Rate this task')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByText("How's this task going?")).not.toBeInTheDocument()
  })

  it('shows the existing rating on the button', () => {
    render(
      <TaskRatingPanel
        taskId={1}
        taskTitle="Task One"
        existingRating={{ rating: 4, whatWorkedWell: '', whatDidntWork: '' }}
        onSave={vi.fn()}
      />
    )
    const button = screen.getByRole('button', { name: 'Rate this task (rated 4 out of 5)' })
    expect(button).toHaveTextContent('⭐ 4')
  })

  it('opens a popover portalled to <body> and moves focus into it', () => {
    const { container } = render(
      <TaskRatingPanel taskId={1} taskTitle="Task One" existingRating={null} onSave={vi.fn()} />
    )
    const dialog = openPopover()

    expect(screen.getByRole('button', { name: /Rate this task/ })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
    expect(dialog).toHaveTextContent('Rate This Task — Task One')
    // Out of the render container (and so out of any overflow-clipping workspace).
    expect(container.contains(dialog)).toBe(false)
    expect(dialog).toHaveStyle({ position: 'fixed' })
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it('saves the entered values via onSave and closes, returning focus to the button', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <TaskRatingPanel taskId={1} taskTitle="Task One" existingRating={null} onSave={onSave} />
    )

    openPopover()
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
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Rate this task/ })).toHaveFocus()
  })

  it('closes on Escape and returns focus to the button', () => {
    render(
      <TaskRatingPanel taskId={1} taskTitle="Task One" existingRating={null} onSave={vi.fn()} />
    )
    const dialog = openPopover()

    fireEvent.keyDown(dialog, { key: 'Escape' })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const button = screen.getByRole('button', { name: /Rate this task/ })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).toHaveFocus()
  })

  it('closes on an outside click but not on a click inside the popover', () => {
    render(
      <div>
        <p>Elsewhere</p>
        <TaskRatingPanel taskId={1} taskTitle="Task One" existingRating={null} onSave={vi.fn()} />
      </div>
    )
    openPopover()

    fireEvent.mouseDown(screen.getByLabelText('What worked well?'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.mouseDown(screen.getByText('Elsewhere'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes when the teacher moves to another task', () => {
    const { rerender } = render(
      <TaskRatingPanel taskId={1} taskTitle="Task One" existingRating={null} onSave={vi.fn()} />
    )
    openPopover()

    rerender(
      <TaskRatingPanel taskId={2} taskTitle="Task Two" existingRating={null} onSave={vi.fn()} />
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not wipe unsaved edits when existingRating is re-fetched with unchanged content', () => {
    const { rerender } = render(
      <TaskRatingPanel
        taskId={1}
        taskTitle="Task One"
        existingRating={{ rating: 2, whatWorkedWell: '', whatDidntWork: '' }}
        onSave={vi.fn()}
      />
    )
    openPopover()
    fireEvent.change(screen.getByLabelText('What worked well?'), {
      target: { value: 'Still typing this' },
    })

    // Simulates the live session listener firing again with a new object
    // reference but the same saved content (e.g. a student did something
    // unrelated to this rating).
    rerender(
      <TaskRatingPanel
        taskId={1}
        taskTitle="Task One"
        existingRating={{ rating: 2, whatWorkedWell: '', whatDidntWork: '' }}
        onSave={vi.fn()}
      />
    )

    expect(screen.getByLabelText('What worked well?')).toHaveValue('Still typing this')
  })

  it("resets the form to the new task's rating when taskId changes", () => {
    const { rerender } = render(
      <TaskRatingPanel
        taskId={1}
        taskTitle="Task One"
        existingRating={{ rating: 5, whatWorkedWell: '', whatDidntWork: '' }}
        onSave={vi.fn()}
      />
    )
    openPopover()
    expect(screen.getByRole('radio', { name: '5 stars', checked: true })).toBeInTheDocument()

    rerender(
      <TaskRatingPanel taskId={2} taskTitle="Task Two" existingRating={null} onSave={vi.fn()} />
    )
    // The task switch closes the popover; reopening shows the new task's (empty) rating.
    openPopover()
    expect(screen.getByRole('radio', { name: '5 stars', checked: false })).toBeInTheDocument()
  })
})
