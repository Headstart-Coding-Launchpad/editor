import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TemplateActivityStudentView } from '../ui.jsx'
import definition from '../definition.js'
import { renderActivityUi } from '../../../test/activityUiHarness.jsx'

// UI tests for the Template Activity StudentView with local state (src/test/activityUiHarness.jsx).
// jsdom can't prove pointer, drag or touch behaviour: check those in a real browser too.
// TODO(new-activity): cover every control, keyboard use, readOnly and the device fallbacks.

const TASK = {
  id: 1,
  taskType: 'activity',
  activityType: 'template_activity',
  items: [
    { id: 'a', prompt: 'What is 2 + 2?', answer: '4' },
    { id: 'b', prompt: 'Name the colour of grass.', answer: 'green' },
  ],
}

function renderView(options = {}) {
  return renderActivityUi(TemplateActivityStudentView, {
    task: TASK,
    initialState: definition.initialState(TASK),
    ...options,
  })
}

describe('Template Activity UI', () => {
  it('stores what the student types for the current item', () => {
    const { state } = renderView()
    expect(screen.getByText('What is 2 + 2?')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: '4' } })
    expect(state().items).toEqual({ a: { answer: '4' }, b: { answer: '' } })
  })

  it('has no Check button or in-task navigation, and shows round progress', () => {
    renderView()
    expect(screen.queryByRole('button', { name: 'Check my work' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Next|Previous/ })).not.toBeInTheDocument()
    expect(screen.getByText('0 of 2 done')).toBeInTheDocument()
  })

  it('ticks a right answer straight away, then moves on by itself', async () => {
    renderView()
    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: '4' } })
    expect(screen.getByText('Correct')).toBeInTheDocument()
    expect(screen.getByText('1 of 2 done')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Name the colour of grass.')).toBeInTheDocument(), {
      timeout: 3000,
    })
  })

  it('shows no hint or wrong mark to a student while an answer is not right yet', () => {
    renderView()
    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: '5' } })
    expect(screen.queryByText(/Type your answer first/)).not.toBeInTheDocument()
    expect(screen.queryByText('Correct')).not.toBeInTheDocument()
  })

  it('is read-only for a teacher view', () => {
    renderView({ readOnly: true, initialState: definition.solutionState(TASK) })
    expect(screen.getByLabelText('Your answer')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Check my work' })).not.toBeInTheDocument()
    expect(screen.getByText('Correct')).toBeInTheDocument()
  })
})
