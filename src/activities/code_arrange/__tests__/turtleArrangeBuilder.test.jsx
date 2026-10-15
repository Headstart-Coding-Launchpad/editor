import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import CodeArrangeEditor from '../CodeArrangeBuilderEditor.jsx'
import {
  INDENT_CODE_ARRANGE_TASK as INDENT_TASK,
  PYTHON_CODE_ARRANGE_TASK,
} from '../../../test/fixtures/legacyActivityTasks.js'

// The Builder's Arrange composer for a Turtle arrangement (P6-15): Python Turtle is a Language
// choice in both modes, and a Turtle task keeps its course and previews with a picture.
describe('CodeArrangeEditor on Turtle', () => {
  it('offers Python Turtle as a language and switches the task to it', () => {
    const onUpdate = vi.fn()
    render(<CodeArrangeEditor task={PYTHON_CODE_ARRANGE_TASK} onUpdate={onUpdate} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Python Turtle' }))
    expect(onUpdate.mock.lastCall[0]).toMatchObject({ moduleType: 'turtle' })
  })

  it('offers Python and Python Turtle, never HTML, in indent mode', () => {
    const onUpdate = vi.fn()
    render(<CodeArrangeEditor task={INDENT_TASK} onUpdate={onUpdate} />)
    expect(screen.getByRole('radio', { name: 'Python' })).toBeChecked()
    expect(screen.queryByRole('radio', { name: 'HTML' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Python Turtle' }))
    expect(onUpdate.mock.lastCall[0]).toMatchObject({ moduleType: 'turtle', arrangeMode: 'indent' })
  })

  it('keeps a Turtle task on Turtle and shows its picture in the preview', () => {
    const task = {
      ...PYTHON_CODE_ARRANGE_TASK,
      moduleType: 'turtle',
      course: { type: 'grid', map: '#####\n#>.G#\n#####\n' },
      check: { type: 'course_goal_reached' },
    }
    render(<CodeArrangeEditor task={task} onUpdate={vi.fn()} />)
    expect(screen.getByRole('radio', { name: 'Python Turtle' })).toBeChecked()
    expect(screen.getAllByRole('img').length).toBeGreaterThan(0)
  })
})
